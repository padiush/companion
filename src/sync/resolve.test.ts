import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import { getAnswersForInstance, insertAnswer, setAnswerSyncError } from '../db/answersRepository';
import {
  getInstance,
  insertInstance,
  listDraftInstances,
  setSyncStatus,
} from '../db/instancesRepository';
import { discardRejectedAnswer, retryInstance } from './resolve';

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

const seedAnswer = (clientId: string, itemId: number) =>
  insertAnswer(db, {
    clientId,
    instanceId: 'i-1',
    sectionId: 1,
    itemId,
    repeatableIndex: null,
    value: 'Sábila',
    editedAt: AT,
  });

describe('retryInstance', () => {
  /**
   * A rejected interview sits outside the outbox, which only drains drafts.
   * Without this it stayed there permanently, showing a status and offering
   * nothing — the point of the retry is that the cause is often fixed on the
   * web rather than on the device.
   */
  it('returns a rejected interview to the outbox', async () => {
    await setSyncStatus(db, 'i-1', 'rejected', 'api.sync.form_not_in_project');

    await retryInstance(db, 'i-1');

    await expect(getInstance(db, 'i-1')).resolves.toMatchObject({ sync_status: 'draft' });
    await expect(listDraftInstances(db)).resolves.toHaveLength(1);
  });

  it('clears the stale reason along with the status', async () => {
    await setSyncStatus(db, 'i-1', 'rejected', 'api.sync.form_not_in_project');

    await retryInstance(db, 'i-1');

    await expect(getInstance(db, 'i-1')).resolves.toMatchObject({ sync_error: null });
  });
});

describe('discardRejectedAnswer', () => {
  it('deletes only the refused answer', async () => {
    await seedAnswer('keep', 1);
    await seedAnswer('drop', 2);
    await setAnswerSyncError(db, 'drop', 'api.sync.item_not_in_form');

    await discardRejectedAnswer(db, 'i-1', 'drop');

    const remaining = await getAnswersForInstance(db, 'i-1');
    expect(remaining.map((row) => row.client_id)).toEqual(['keep']);
  });

  /**
   * The whole point: one answer the server will never take was holding back
   * every other answer in the interview.
   */
  it('puts the rest of the interview back in the outbox', async () => {
    await seedAnswer('drop', 2);
    await setSyncStatus(db, 'i-1', 'partial');

    await discardRejectedAnswer(db, 'i-1', 'drop');

    await expect(getInstance(db, 'i-1')).resolves.toMatchObject({ sync_status: 'draft' });
    await expect(listDraftInstances(db)).resolves.toHaveLength(1);
  });

  it('leaves other interviews alone', async () => {
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
    await setSyncStatus(db, 'i-2', 'synced');
    await seedAnswer('drop', 2);

    await discardRejectedAnswer(db, 'i-1', 'drop');

    await expect(getInstance(db, 'i-2')).resolves.toMatchObject({ sync_status: 'synced' });
  });
});
