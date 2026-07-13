import type { SQLiteDatabase } from 'expo-sqlite';

import { findAnswer, insertAnswer, updateAnswerValue } from '../db/answersRepository';
import { insertInstance, touchInstance } from '../db/instancesRepository';
import type { AnswerRow } from '../db/types';
import { createDraft, saveAnswer } from './captureService';

jest.mock('../db/instancesRepository', () => ({
  insertInstance: jest.fn(),
  touchInstance: jest.fn(),
}));
jest.mock('../db/answersRepository', () => ({
  findAnswer: jest.fn(),
  insertAnswer: jest.fn(),
  updateAnswerValue: jest.fn(),
}));

let mockCounter = 0;
jest.mock('../ids', () => ({
  uuid: jest.fn(() => `uuid-${++mockCounter}`),
}));

const mockFindAnswer = findAnswer as jest.MockedFunction<typeof findAnswer>;
const db = {} as SQLiteDatabase;

beforeEach(() => {
  jest.clearAllMocks();
  mockCounter = 0;
});

describe('createDraft', () => {
  it('inserts a draft instance with a generated id', async () => {
    const id = await createDraft(db, { formId: 27, projectId: 9 });

    expect(id).toBe('uuid-1');
    expect(insertInstance).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: 'uuid-1', formId: 27, projectId: 9 })
    );
  });
});

describe('saveAnswer', () => {
  const params = {
    instanceId: 'inst-1',
    sectionId: 1,
    itemId: 10,
    repeatableIndex: 0,
    value: 'guaba',
  };

  it('inserts a new answer with a client id when none exists', async () => {
    mockFindAnswer.mockResolvedValue(null);

    await saveAnswer(db, params);

    expect(insertAnswer).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ clientId: 'uuid-1', itemId: 10, value: 'guaba' })
    );
    expect(updateAnswerValue).not.toHaveBeenCalled();
    expect(touchInstance).toHaveBeenCalledWith(db, 'inst-1', expect.any(String));
  });

  it('updates the existing answer instead of inserting a duplicate', async () => {
    mockFindAnswer.mockResolvedValue({ client_id: 'existing' } as AnswerRow);

    await saveAnswer(db, { ...params, value: 'guaba colorada' });

    expect(updateAnswerValue).toHaveBeenCalledWith(
      db,
      'existing',
      'guaba colorada',
      expect.any(String)
    );
    expect(insertAnswer).not.toHaveBeenCalled();
  });

  it('JSON-encodes multi-select values', async () => {
    mockFindAnswer.mockResolvedValue(null);

    await saveAnswer(db, { ...params, itemId: 11, value: ['food', 'medicine'] });

    expect(insertAnswer).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ value: '["food","medicine"]' })
    );
  });
});
