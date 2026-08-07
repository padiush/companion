import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import { insertInstance, setSyncStatus } from './instancesRepository';
import { countPendingMedia, listPendingMedia, setMediaUploaded } from './mediaRepository';

let db: TestDatabase;

const AT = '2026-08-06T10:00:00.000Z';

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

async function seedInstance(id: string, status = 'draft') {
  await insertInstance(db, {
    id,
    formId: 10,
    projectId: 1,
    capturedAt: AT,
    location: null,
    formVersionCursor: null,
    createdAt: AT,
    updatedAt: AT,
  });
  if (status !== 'draft') {
    await setSyncStatus(db, id, status);
  }
}

const seedMedia = (clientId: string, instanceId: string, status = 'pending') =>
  db.runAsync(
    `INSERT INTO media (client_id, instance_id, kind, upload_status) VALUES (?, ?, 'photo', ?)`,
    [clientId, instanceId, status],
  );

describe('listPendingMedia', () => {
  /**
   * The server needs the interview to exist before a media intent can be
   * registered against it, so this list is deliberately narrow.
   */
  it('returns only media whose interview has already synced', async () => {
    await seedInstance('sent', 'synced');
    await seedInstance('unsent');
    await seedMedia('ready', 'sent');
    await seedMedia('too-early', 'unsent');

    const pending = await listPendingMedia(db);

    expect(pending.map((row) => row.client_id)).toEqual(['ready']);
  });

  it('skips media that already uploaded', async () => {
    await seedInstance('sent', 'synced');
    await seedMedia('done', 'sent', 'uploaded');

    await expect(listPendingMedia(db)).resolves.toEqual([]);
  });
});

describe('countPendingMedia', () => {
  /**
   * Deliberately broader than listPendingMedia: this drives the outbox, and a
   * photo on a draft becomes uploadable the moment that draft is pushed — in
   * the same send. Counting only the immediately-uploadable ones would hide the
   * Send action in exactly the case that needs it.
   */
  it('counts media on interviews that have not synced yet', async () => {
    await seedInstance('unsent');
    await seedMedia('waiting', 'unsent');

    await expect(countPendingMedia(db)).resolves.toBe(1);
    await expect(listPendingMedia(db)).resolves.toEqual([]);
  });

  it('stops counting media once it has uploaded', async () => {
    await seedInstance('sent', 'synced');
    await seedMedia('m-1', 'sent');
    await seedMedia('m-2', 'sent');

    await setMediaUploaded(db, 'm-1', 'storage/key-1');

    await expect(countPendingMedia(db)).resolves.toBe(1);
  });

  it('counts nothing in an empty store', async () => {
    await expect(countPendingMedia(db)).resolves.toBe(0);
  });
});

describe('setMediaUploaded', () => {
  it('records the storage key the server assigned', async () => {
    await seedInstance('sent', 'synced');
    await seedMedia('m-1', 'sent');

    await setMediaUploaded(db, 'm-1', 'projects/1/media/abc');

    const row = await db.getFirstAsync<{ upload_status: string; storage_key: string }>(
      'SELECT upload_status, storage_key FROM media WHERE client_id = ?',
      ['m-1'],
    );
    expect(row).toEqual({ upload_status: 'uploaded', storage_key: 'projects/1/media/abc' });
  });
});
