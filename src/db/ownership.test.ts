import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import { insertInstance, setSyncStatus } from './instancesRepository';
import { claimOwner, countPendingWork, hasPendingWork, readOwner } from './ownership';

let db: TestDatabase;

const AT = '2026-08-06T10:00:00.000Z';

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

const seedInstance = (id: string) =>
  insertInstance(db, {
    id,
    formId: 10,
    projectId: 1,
    capturedAt: AT,
    location: null,
    formVersionCursor: null,
    createdAt: AT,
    updatedAt: AT,
  });

const seedMedia = (clientId: string, instanceId: string, status: string) =>
  db.runAsync(
    `INSERT INTO media (client_id, instance_id, kind, upload_status) VALUES (?, ?, 'photo', ?)`,
    [clientId, instanceId, status],
  );

describe('ownership', () => {
  it('reports no owner for a fresh store', async () => {
    await expect(readOwner(db)).resolves.toBeNull();
  });

  it('round-trips the owning account', async () => {
    await claimOwner(db, 42);

    await expect(readOwner(db)).resolves.toBe(42);
  });

  it('replaces the owner rather than accumulating rows', async () => {
    await claimOwner(db, 42);
    await claimOwner(db, 7);

    await expect(readOwner(db)).resolves.toBe(7);
  });

  it('treats a corrupted owner value as unowned', async () => {
    await db.runAsync("INSERT INTO sync_meta (key, value) VALUES ('owner_user_id', 'nonsense')");

    await expect(readOwner(db)).resolves.toBeNull();
  });
});

describe('countPendingWork', () => {
  it('counts nothing in an empty store', async () => {
    await expect(countPendingWork(db)).resolves.toEqual({ interviews: 0, media: 0 });
  });

  it('counts interviews the server has not accepted', async () => {
    await seedInstance('draft');
    await seedInstance('rejected');
    await setSyncStatus(db, 'rejected', 'rejected');
    await seedInstance('sent');
    await setSyncStatus(db, 'sent', 'synced');

    // A rejected interview is unsent work too — it still exists only here.
    await expect(countPendingWork(db)).resolves.toMatchObject({ interviews: 2 });
  });

  /**
   * Media is counted independently of its interview: an interview can be fully
   * synced while its photos and audio never left the device, and wiping would
   * still destroy them.
   */
  it('counts media that never uploaded, even under a synced interview', async () => {
    await seedInstance('sent');
    await setSyncStatus(db, 'sent', 'synced');
    await seedMedia('m-1', 'sent', 'pending');
    await seedMedia('m-2', 'sent', 'uploaded');

    await expect(countPendingWork(db)).resolves.toEqual({ interviews: 0, media: 1 });
  });
});

describe('hasPendingWork', () => {
  it.each([
    [{ interviews: 0, media: 0 }, false],
    [{ interviews: 1, media: 0 }, true],
    [{ interviews: 0, media: 1 }, true],
  ])('%j -> %s', (work, expected) => {
    expect(hasPendingWork(work)).toBe(expected);
  });
});
