import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import type { ItemType } from '../api/types';
import {
  clearAnswerSyncErrors,
  getAnswersForInstance,
  setAnswerSyncError,
} from '../db/answersRepository';
import { getForm } from '../db/formsRepository';
import { listDraftInstances, setSyncStatus } from '../db/instancesRepository';
import type { AnswerRow, InstanceRow } from '../db/types';
import { pushDrafts, toInstancePush } from './push';

jest.mock('../api/client', () => ({ api: { syncInstances: jest.fn() } }));
jest.mock('../db/instancesRepository', () => ({
  listDraftInstances: jest.fn(),
  setSyncStatus: jest.fn(),
}));
jest.mock('../db/answersRepository', () => ({
  getAnswersForInstance: jest.fn(),
  setAnswerSyncError: jest.fn(),
  clearAnswerSyncErrors: jest.fn(),
}));
jest.mock('../db/formsRepository', () => ({ getForm: jest.fn() }));

const mockSync = api.syncInstances as jest.Mock;
const mockList = listDraftInstances as jest.Mock;
const mockAnswers = getAnswersForInstance as jest.Mock;
const mockGetForm = getForm as jest.Mock;

const db = {} as SQLiteDatabase;

function instance(overrides: Partial<InstanceRow> = {}): InstanceRow {
  return {
    id: 'inst-1',
    form_id: 27,
    project_id: 9,
    captured_at: '2026-07-13T10:00:00Z',
    location_lat: -12.05,
    location_lng: -77.04,
    location_accuracy_m: 8,
    location_captured_at: '2026-07-13T10:00:00Z',
    form_version_cursor: '2026-07-01T00:00:00Z',
    sync_status: 'draft',
    sync_error: null,
    created_at: '2026-07-13T09:00:00Z',
    updated_at: '2026-07-13T10:00:00Z',
    ...overrides,
  };
}

function answer(overrides: Partial<AnswerRow> = {}): AnswerRow {
  return {
    client_id: 'a1',
    instance_id: 'inst-1',
    section_id: 1,
    item_id: 10,
    repeatable_index: 0,
    value: 'guaba',
    edited_at: '2026-07-13T10:00:00Z',
    sync_error: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('toInstancePush', () => {
  it('maps the instance, its location, and decodes multi-select answers', () => {
    const itemTypes = new Map<number, ItemType>([
      [10, 'text'],
      [11, 'multi'],
    ]);

    const push = toInstancePush(
      instance(),
      [answer(), answer({ client_id: 'a2', item_id: 11, value: '["food","medicine"]' })],
      itemTypes
    );

    expect(push.id).toBe('inst-1');
    expect(push.interview_form_id).toBe(27);
    expect(push.location).toEqual({
      lat: -12.05,
      lng: -77.04,
      accuracy_m: 8,
      captured_at: '2026-07-13T10:00:00Z',
    });
    expect(push.answers[0]).toEqual({
      client_id: 'a1',
      interview_section_id: 1,
      interview_item_id: 10,
      repeatable_index: 0,
      value: 'guaba',
      edited_at: '2026-07-13T10:00:00Z',
    });
    expect(push.answers[1].value).toEqual(['food', 'medicine']);
  });

  it('omits location when there is no GPS fix', () => {
    const push = toInstancePush(
      instance({ location_lat: null, location_lng: null }),
      [],
      new Map()
    );

    expect(push.location).toBeUndefined();
  });
});

describe('pushDrafts', () => {
  beforeEach(() => {
    mockAnswers.mockResolvedValue([]);
    mockGetForm.mockResolvedValue({ sections: [] });
  });

  it('pushes a project batch and marks each instance by its result', async () => {
    mockList.mockResolvedValue([
      instance({ id: 'i1', project_id: 9 }),
      instance({ id: 'i2', project_id: 9 }),
    ]);
    mockSync.mockResolvedValue({
      results: [
        { id: 'i1', status: 'created' },
        { id: 'i2', status: 'rejected' },
      ],
    });

    const summary = await pushDrafts(db);

    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ instances: expect.any(Array) })
    );
    expect(setSyncStatus).toHaveBeenCalledWith(db, 'i1', 'synced');
    expect(setSyncStatus).toHaveBeenCalledWith(db, 'i2', 'rejected', null);
    expect(summary).toEqual({ synced: 1, partial: 0, rejected: 1 });
  });

  it('sends a separate batch per project', async () => {
    mockList.mockResolvedValue([
      instance({ id: 'i1', project_id: 9 }),
      instance({ id: 'i2', project_id: 5 }),
    ]);
    mockSync
      .mockResolvedValueOnce({ results: [{ id: 'i1', status: 'created' }] })
      .mockResolvedValueOnce({ results: [{ id: 'i2', status: 'unchanged' }] });

    const summary = await pushDrafts(db);

    expect(mockSync).toHaveBeenCalledTimes(2);
    expect(mockSync).toHaveBeenCalledWith(9, expect.anything());
    expect(mockSync).toHaveBeenCalledWith(5, expect.anything());
    expect(summary).toEqual({ synced: 2, partial: 0, rejected: 0 });
  });

  it('leaves drafts untouched when the push fails', async () => {
    mockList.mockResolvedValue([instance({ id: 'i1', project_id: 9 })]);
    mockSync.mockRejectedValue(new Error('offline'));

    await expect(pushDrafts(db)).rejects.toThrow('offline');
    expect(setSyncStatus).not.toHaveBeenCalled();
  });

  describe('answers the server refused', () => {
    /**
     * The gap this closes: the server can create or update an interview while
     * refusing individual answers — an item deleted on the web, say. Reading
     * only the top-level status marked all of it synced, so the refused answer
     * was never retried and never shown. It just disappeared.
     */
    it('does not call an interview synced when answers were refused', async () => {
      mockList.mockResolvedValue([instance({ id: 'i1', project_id: 9 })]);
      mockSync.mockResolvedValue({
        results: [
          {
            id: 'i1',
            status: 'created',
            errors: { answers: [{ client_id: 'a-9', error: 'api.sync.item_not_in_form' }] },
          },
        ],
      });

      const summary = await pushDrafts(db);

      expect(setSyncStatus).toHaveBeenCalledWith(db, 'i1', 'partial');
      expect(summary).toEqual({ synced: 0, partial: 1, rejected: 0 });
    });

    it('records the reason against the answer it belongs to', async () => {
      mockList.mockResolvedValue([instance({ id: 'i1', project_id: 9 })]);
      mockSync.mockResolvedValue({
        results: [
          {
            id: 'i1',
            status: 'updated',
            errors: {
              answers: [
                { client_id: 'a-1', error: 'api.sync.item_not_in_form' },
                { client_id: 'a-2', error: 'api.sync.section_mismatch' },
              ],
            },
          },
        ],
      });

      await pushDrafts(db);

      expect(setAnswerSyncError).toHaveBeenCalledWith(db, 'a-1', 'api.sync.item_not_in_form');
      expect(setAnswerSyncError).toHaveBeenCalledWith(db, 'a-2', 'api.sync.section_mismatch');
    });

    it('clears the previous attempt’s errors before applying the new result', async () => {
      mockList.mockResolvedValue([instance({ id: 'i1', project_id: 9 })]);
      mockSync.mockResolvedValue({ results: [{ id: 'i1', status: 'updated' }] });

      await pushDrafts(db);

      // Otherwise an answer fixed on this attempt keeps the last one's error.
      expect(clearAnswerSyncErrors).toHaveBeenCalledWith(db, 'i1');
      expect(setAnswerSyncError).not.toHaveBeenCalled();
      expect(setSyncStatus).toHaveBeenCalledWith(db, 'i1', 'synced');
    });

    it('skips a refusal the server could not attribute to an answer', async () => {
      mockList.mockResolvedValue([instance({ id: 'i1', project_id: 9 })]);
      mockSync.mockResolvedValue({
        results: [
          {
            id: 'i1',
            status: 'created',
            errors: { answers: [{ client_id: null, error: 'api.sync.item_not_in_form' }] },
          },
        ],
      });

      const summary = await pushDrafts(db);

      expect(setAnswerSyncError).not.toHaveBeenCalled();
      // Still not a clean sync — the interview is short an answer either way.
      expect(summary).toEqual({ synced: 0, partial: 1, rejected: 0 });
    });

    it('keeps the reason a whole interview was rejected', async () => {
      mockList.mockResolvedValue([instance({ id: 'i1', project_id: 9 })]);
      mockSync.mockResolvedValue({
        results: [
          {
            id: 'i1',
            status: 'rejected',
            errors: { interview_form_id: ['api.sync.form_not_in_project'] },
          },
        ],
      });

      await pushDrafts(db);

      expect(setSyncStatus).toHaveBeenCalledWith(
        db,
        'i1',
        'rejected',
        'api.sync.form_not_in_project'
      );
    });
  });
});
