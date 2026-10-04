import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import { api } from '../api/client';
import type { FieldRecordSyncRequest } from '../api/types';
import {
  getFieldRecord,
  insertFieldRecord,
  updateFieldRecord,
  type FieldRecordInsert,
} from '../db/fieldRecordsRepository';
import { pushFieldRecords, toFieldRecordPush } from './pushFieldRecords';

jest.mock('../api/client', () => ({ api: { syncRecords: jest.fn() } }));

const mockSync = api.syncRecords as jest.Mock;

const AT = '2026-10-04T10:00:00.000Z';

let db: TestDatabase;

beforeEach(async () => {
  jest.clearAllMocks();
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

function record(overrides: Partial<FieldRecordInsert> = {}): FieldRecordInsert {
  return {
    clientId: 'fr-1',
    projectId: 9,
    basisOfRecord: 'human_observation',
    vernacularName: 'guaba',
    collector: 'M. Menéndez',
    collectedOn: '2026-10-04',
    location: { lat: 13.7, lng: -89.2 },
    permitExemption: 'market',
    editedAt: AT,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

/** Answer every pushed record with the same status, as the server would. */
function respondWith(status: string, extra: Record<string, unknown> = {}) {
  mockSync.mockImplementation(async (_project: number, body: FieldRecordSyncRequest) => ({
    results: body.records.map((pushed, index) => ({
      client_id: pushed.client_id,
      id: status === 'rejected' ? undefined : 100 + index,
      status,
      ...extra,
    })),
  }));
}

describe('the payload', () => {
  /** The server applies only the fields a payload names; a missing key would keep the old value. */
  it('names every recorded field, blank ones as null', async () => {
    await insertFieldRecord(db, record());
    const row = await getFieldRecord(db, 'fr-1');

    expect(toFieldRecordPush(row!)).toEqual({
      client_id: 'fr-1',
      basis_of_record: 'human_observation',
      vernacular_name: 'guaba',
      collection_number: null,
      collector: 'M. Menéndez',
      collected_on: '2026-10-04',
      locality: null,
      notes: null,
      location: { lat: 13.7, lng: -89.2 },
      collecting_permit_id: null,
      permit_exemption: 'market',
      answer_client_id: undefined,
      edited_at: AT,
    });
  });

  it('sends the permit and the exemption together, one of them null', async () => {
    await insertFieldRecord(db, record({ permitExemption: null, collectingPermitId: 5 }));
    const row = await getFieldRecord(db, 'fr-1');

    expect(toFieldRecordPush(row!)).toMatchObject({
      collecting_permit_id: 5,
      permit_exemption: null,
    });
  });

  it('leaves the location out when there is none, and names the answer when there is one', async () => {
    await insertFieldRecord(db, record({ location: null, answerClientId: 'ans-1' }));
    const row = await getFieldRecord(db, 'fr-1');
    const push = toFieldRecordPush(row!);

    expect(push.location).toBeUndefined();
    expect(push.answer_client_id).toBe('ans-1');
  });
});

describe('pushFieldRecords', () => {
  it('sends nothing when nothing is waiting', async () => {
    await expect(pushFieldRecords(db)).resolves.toEqual({ synced: 0, rejected: 0 });
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('sends each project its own records', async () => {
    await insertFieldRecord(db, record({ clientId: 'fr-a', projectId: 9 }));
    await insertFieldRecord(db, record({ clientId: 'fr-b', projectId: 12 }));
    respondWith('created');

    await pushFieldRecords(db);

    const calls = mockSync.mock.calls.map(([project, body]) => [
      project,
      body.records.map((pushed: { client_id: string }) => pushed.client_id),
    ]);
    expect(calls).toEqual(
      expect.arrayContaining([
        [9, ['fr-a']],
        [12, ['fr-b']],
      ])
    );
  });

  it.each(['created', 'updated', 'unchanged'])(
    'marks a %s record sent and keeps the id the server gave it',
    async (status) => {
      await insertFieldRecord(db, record());
      respondWith(status);

      await expect(pushFieldRecords(db)).resolves.toEqual({ synced: 1, rejected: 0 });
      expect(await getFieldRecord(db, 'fr-1')).toMatchObject({
        sync_status: 'synced',
        sync_error: null,
        server_id: 100,
      });
    }
  );

  it('keeps the reason a record was refused, so its screen can say why', async () => {
    await insertFieldRecord(db, record({ permitExemption: null, collectingPermitId: 77 }));
    respondWith('rejected', {
      errors: { collecting_permit_id: ['api.sync.permit_not_in_project'] },
    });

    await expect(pushFieldRecords(db)).resolves.toEqual({ synced: 0, rejected: 1 });
    expect(await getFieldRecord(db, 'fr-1')).toMatchObject({
      sync_status: 'rejected',
      sync_error: 'api.sync.permit_not_in_project',
      server_id: null,
    });
  });

  /**
   * A record edited while its push is in flight carries an edit the server has
   * not seen. Marking it sent would make it read-only with that edit stranded.
   */
  it('leaves a record edited during the push in the outbox, with its server id', async () => {
    await insertFieldRecord(db, record());
    mockSync.mockImplementation(async (_project: number, body: FieldRecordSyncRequest) => {
      const later = '2026-10-04T10:05:00.000Z';
      await updateFieldRecord(db, 'fr-1', {
        basisOfRecord: 'human_observation',
        vernacularName: 'guayaba',
        permitExemption: 'market',
        editedAt: later,
        updatedAt: later,
      });
      return { results: [{ client_id: body.records[0].client_id, id: 41, status: 'created' }] };
    });

    await pushFieldRecords(db);

    expect(await getFieldRecord(db, 'fr-1')).toMatchObject({
      vernacular_name: 'guayaba',
      sync_status: 'draft',
      server_id: 41,
    });
  });

  it('sends no more than the server takes in one call', async () => {
    for (let index = 0; index < 101; index += 1) {
      await insertFieldRecord(db, record({ clientId: `fr-${index}` }));
    }
    respondWith('created');

    await expect(pushFieldRecords(db)).resolves.toEqual({ synced: 101, rejected: 0 });
    expect(mockSync.mock.calls.map(([, body]) => body.records.length)).toEqual([100, 1]);
  });

  it('leaves everything queued when the server cannot be reached', async () => {
    await insertFieldRecord(db, record());
    mockSync.mockRejectedValue(new TypeError('Network request failed'));

    await expect(pushFieldRecords(db)).rejects.toThrow('Network request failed');
    expect((await getFieldRecord(db, 'fr-1'))?.sync_status).toBe('draft');
  });
});
