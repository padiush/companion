import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import {
  deleteAnswersForSet,
  findAnswer,
  getAnswersForInstance,
  insertAnswer,
  updateAnswerValue,
} from './answersRepository';
import { insertInstance } from './instancesRepository';

let db: TestDatabase;

const AT = '2026-08-06T10:00:00.000Z';

beforeEach(async () => {
  db = await createTestDatabase();
  await insertInstance(db, {
    id: 'i-1',
    formId: 10,
    projectId: 1,
    capturedAt: AT,
    location: null,
    formVersionCursor: null,
    createdAt: AT,
    updatedAt: AT,
  });
});

afterEach(async () => {
  await db.closeAsync();
});

const answer = (overrides: Partial<Parameters<typeof insertAnswer>[1]> = {}) => ({
  clientId: 'a-1',
  instanceId: 'i-1',
  sectionId: 1,
  itemId: 1,
  repeatableIndex: null,
  value: 'Sábila',
  editedAt: AT,
  ...overrides,
});

describe('findAnswer', () => {
  /**
   * SQLite's `=` never matches NULL, so a non-repeatable slot has to be looked
   * up with `IS NULL`. Getting this wrong inserts a second row on every save
   * instead of updating the first — silently duplicating answers.
   */
  it('matches a non-repeatable slot, whose index is NULL', async () => {
    await insertAnswer(db, answer());

    const found = await findAnswer(db, 'i-1', 1, null);

    expect(found?.client_id).toBe('a-1');
  });

  it('does not confuse a NULL slot with set 0', async () => {
    await insertAnswer(db, answer({ clientId: 'plain', repeatableIndex: null }));
    await insertAnswer(db, answer({ clientId: 'set-0', repeatableIndex: 0 }));

    await expect(findAnswer(db, 'i-1', 1, null)).resolves.toMatchObject({ client_id: 'plain' });
    await expect(findAnswer(db, 'i-1', 1, 0)).resolves.toMatchObject({ client_id: 'set-0' });
  });

  it('keeps repeatable sets apart', async () => {
    await insertAnswer(db, answer({ clientId: 'set-0', repeatableIndex: 0, value: 'Primero' }));
    await insertAnswer(db, answer({ clientId: 'set-1', repeatableIndex: 1, value: 'Segundo' }));

    await expect(findAnswer(db, 'i-1', 1, 1)).resolves.toMatchObject({ value: 'Segundo' });
  });

  it('scopes the lookup to one instance', async () => {
    await insertInstance(db, {
      id: 'i-2',
      formId: 10,
      projectId: 1,
      capturedAt: AT,
      location: null,
      formVersionCursor: null,
      createdAt: AT,
      updatedAt: AT,
    });
    await insertAnswer(db, answer({ clientId: 'other', instanceId: 'i-2' }));

    await expect(findAnswer(db, 'i-1', 1, null)).resolves.toBeNull();
  });

  it('resolves null when the slot has no answer yet', async () => {
    await expect(findAnswer(db, 'i-1', 99, null)).resolves.toBeNull();
  });
});

describe('updateAnswerValue', () => {
  it('replaces the value and stamps a new edit time', async () => {
    await insertAnswer(db, answer());

    await updateAnswerValue(db, 'a-1', 'Aloe vera', '2026-08-06T11:00:00.000Z');

    const found = await findAnswer(db, 'i-1', 1, null);
    expect(found).toMatchObject({ value: 'Aloe vera', edited_at: '2026-08-06T11:00:00.000Z' });
  });

  it('can clear a value without deleting the row', async () => {
    await insertAnswer(db, answer());

    await updateAnswerValue(db, 'a-1', null, AT);

    await expect(findAnswer(db, 'i-1', 1, null)).resolves.toMatchObject({ value: null });
  });
});

describe('deleteAnswersForSet', () => {
  it('removes one set and leaves the others intact', async () => {
    await insertAnswer(db, answer({ clientId: 's0-i1', itemId: 1, repeatableIndex: 0 }));
    await insertAnswer(db, answer({ clientId: 's0-i2', itemId: 2, repeatableIndex: 0 }));
    await insertAnswer(db, answer({ clientId: 's1-i1', itemId: 1, repeatableIndex: 1 }));

    await deleteAnswersForSet(db, 'i-1', 1, 0);

    const remaining = await getAnswersForInstance(db, 'i-1');
    expect(remaining.map((row) => row.client_id)).toEqual(['s1-i1']);
  });

  it('only touches the named section', async () => {
    await insertAnswer(db, answer({ clientId: 'sec-1', sectionId: 1, repeatableIndex: 0 }));
    await insertAnswer(db, answer({ clientId: 'sec-2', sectionId: 2, repeatableIndex: 0 }));

    await deleteAnswersForSet(db, 'i-1', 1, 0);

    const remaining = await getAnswersForInstance(db, 'i-1');
    expect(remaining.map((row) => row.client_id)).toEqual(['sec-2']);
  });
});
