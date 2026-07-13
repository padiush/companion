import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import type { ItemType } from '../api/types';
import { getAnswersForInstance } from '../db/answersRepository';
import { getForm } from '../db/formsRepository';
import { listDraftInstances, setSyncStatus } from '../db/instancesRepository';
import type { AnswerRow, InstanceRow } from '../db/types';
import { pushDrafts, toInstancePush } from './push';

jest.mock('../api/client', () => ({ api: { syncInstances: jest.fn() } }));
jest.mock('../db/instancesRepository', () => ({
  listDraftInstances: jest.fn(),
  setSyncStatus: jest.fn(),
}));
jest.mock('../db/answersRepository', () => ({ getAnswersForInstance: jest.fn() }));
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
    expect(setSyncStatus).toHaveBeenCalledWith(db, 'i2', 'rejected');
    expect(summary).toEqual({ synced: 1, rejected: 1 });
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
    expect(summary).toEqual({ synced: 2, rejected: 0 });
  });

  it('leaves drafts untouched when the push fails', async () => {
    mockList.mockResolvedValue([instance({ id: 'i1', project_id: 9 })]);
    mockSync.mockRejectedValue(new Error('offline'));

    await expect(pushDrafts(db)).rejects.toThrow('offline');
    expect(setSyncStatus).not.toHaveBeenCalled();
  });
});
