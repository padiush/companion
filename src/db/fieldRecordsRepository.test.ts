import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import {
  countDraftFieldRecords,
  getFieldRecord,
  insertFieldRecord,
  listDraftFieldRecords,
  listFieldRecords,
  setFieldRecordSyncResult,
  updateFieldRecord,
  type FieldRecordInsert,
} from './fieldRecordsRepository';
import { insertMedia } from './mediaRepository';

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

const AT = '2026-08-23T10:00:00.000Z';

function record(overrides: Partial<FieldRecordInsert> = {}): FieldRecordInsert {
  return {
    clientId: 'fr-1',
    projectId: 1,
    basisOfRecord: 'human_observation',
    vernacularName: 'guaba',
    collectionNumber: 'RA-014',
    collector: 'R. Arévalo',
    collectedOn: '2026-08-20',
    locality: 'cafetal above the school',
    location: { lat: 13.7, lng: -89.2 },
    notes: 'flowering',
    editedAt: AT,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

describe('field records', () => {
  it('stores what the device authored and starts as a draft', async () => {
    await insertFieldRecord(db, record());

    const stored = await getFieldRecord(db, 'fr-1');

    expect(stored).toMatchObject({
      client_id: 'fr-1',
      project_id: 1,
      basis_of_record: 'human_observation',
      vernacular_name: 'guaba',
      collection_number: 'RA-014',
      location_lat: 13.7,
      sync_status: 'draft',
      // Not known until the push answers with it.
      server_id: null,
    });
  });

  it('defaults the basis to a collection, as everything recorded before it was', async () => {
    await db.runAsync(
      `INSERT INTO field_records (client_id, project_id, created_at, updated_at)
       VALUES ('fr-bare', 1, ?, ?)`,
      [AT, AT]
    );

    await expect(getFieldRecord(db, 'fr-bare')).resolves.toMatchObject({
      basis_of_record: 'preserved_specimen',
    });
  });

  it('refuses a permit and an exemption together', async () => {
    await expect(
      insertFieldRecord(db, record({ collectingPermitId: 7, permitExemption: 'cultivated' }))
    ).rejects.toThrow(/never both/);

    await expect(countDraftFieldRecords(db)).resolves.toBe(0);
  });

  it('refuses the pairing on an edit too, not only on capture', async () => {
    await insertFieldRecord(db, record({ collectingPermitId: 7 }));

    await expect(
      updateFieldRecord(db, 'fr-1', {
        ...record({ collectingPermitId: 7, permitExemption: 'market' }),
        editedAt: AT,
        updatedAt: AT,
      })
    ).rejects.toThrow(/never both/);
  });

  it('keeps a record it came out of an interview', async () => {
    await insertFieldRecord(db, record({ answerClientId: 'answer-9' }));

    await expect(getFieldRecord(db, 'fr-1')).resolves.toMatchObject({
      answer_client_id: 'answer-9',
    });
  });

  /**
   * The same trap `recordLocalEdit` exists for on interviews: the outbox
   * selects drafts, so an edit to a record that had already synced would be
   * saved, reported as saved, and never sent.
   */
  it('puts an edited record back in the outbox', async () => {
    await insertFieldRecord(db, record());
    await setFieldRecordSyncResult(db, 'fr-1', { status: 'synced', serverId: 42 });
    await expect(countDraftFieldRecords(db)).resolves.toBe(0);

    await updateFieldRecord(db, 'fr-1', {
      ...record({ collectionNumber: 'RA-015' }),
      editedAt: '2026-08-23T11:00:00.000Z',
      updatedAt: '2026-08-23T11:00:00.000Z',
    });

    await expect(countDraftFieldRecords(db)).resolves.toBe(1);
    await expect(getFieldRecord(db, 'fr-1')).resolves.toMatchObject({
      collection_number: 'RA-015',
      // …and the server id it already learned is not thrown away.
      server_id: 42,
    });
  });

  it('keeps the server id a push handed back, and the reason a push refused it', async () => {
    await insertFieldRecord(db, record());

    await setFieldRecordSyncResult(db, 'fr-1', { status: 'synced', serverId: 42 });
    await expect(getFieldRecord(db, 'fr-1')).resolves.toMatchObject({
      server_id: 42,
      sync_error: null,
    });

    await setFieldRecordSyncResult(db, 'fr-1', {
      status: 'rejected',
      error: 'api.sync.answer_not_found',
    });
    await expect(getFieldRecord(db, 'fr-1')).resolves.toMatchObject({
      sync_status: 'rejected',
      sync_error: 'api.sync.answer_not_found',
      // A rejection does not un-learn an id the server already gave.
      server_id: 42,
    });
  });

  it('lists a project’s records newest first, and only that project’s', async () => {
    await insertFieldRecord(db, record({ clientId: 'fr-old', createdAt: AT }));
    await insertFieldRecord(
      db,
      record({ clientId: 'fr-new', createdAt: '2026-08-23T12:00:00.000Z' })
    );
    await insertFieldRecord(db, record({ clientId: 'fr-other', projectId: 2 }));

    const listed = await listFieldRecords(db, 1);

    expect(listed.map((row) => row.client_id)).toEqual(['fr-new', 'fr-old']);
  });

  it('sends only what the server has not accepted', async () => {
    await insertFieldRecord(db, record({ clientId: 'fr-1' }));
    await insertFieldRecord(db, record({ clientId: 'fr-2' }));
    await setFieldRecordSyncResult(db, 'fr-2', { status: 'synced', serverId: 7 });

    const drafts = await listDraftFieldRecords(db);

    expect(drafts.map((row) => row.client_id)).toEqual(['fr-1']);
    await expect(countDraftFieldRecords(db)).resolves.toBe(1);
  });
});

describe('media on a field record', () => {
  it('attaches with no interview at all', async () => {
    await insertFieldRecord(db, record());

    await insertMedia(db, {
      clientId: 'm-1',
      fieldRecordId: 'fr-1',
      kind: 'photo',
      contentType: 'image/jpeg',
      byteSize: 1234,
      capturedAt: AT,
    });

    await expect(
      db.getFirstAsync('SELECT instance_id, field_record_id FROM media WHERE client_id = ?', [
        'm-1',
      ])
    ).resolves.toEqual({ instance_id: null, field_record_id: 'fr-1' });
  });

  it('refuses media that belongs to both, or to neither', async () => {
    await insertFieldRecord(db, record());

    const base = {
      clientId: 'm-x',
      kind: 'photo' as const,
      contentType: 'image/jpeg',
      byteSize: 1,
      capturedAt: AT,
    };

    await expect(
      insertMedia(db, { ...base, instanceId: 'i-1', fieldRecordId: 'fr-1' })
    ).rejects.toThrow(/exactly one/);
    await expect(insertMedia(db, base)).rejects.toThrow(/exactly one/);
  });

  /**
   * For a record of something never collected the photograph *is* the record,
   * so deleting the record must not leave its only evidence orphaned.
   */
  it('goes when the record goes', async () => {
    await insertFieldRecord(db, record());
    await insertMedia(db, {
      clientId: 'm-1',
      fieldRecordId: 'fr-1',
      kind: 'photo',
      contentType: 'image/jpeg',
      byteSize: 1234,
      capturedAt: AT,
    });

    await db.runAsync('DELETE FROM field_records WHERE client_id = ?', ['fr-1']);

    await expect(
      db.getFirstAsync('SELECT COUNT(*) AS count FROM media WHERE client_id = ?', ['m-1'])
    ).resolves.toEqual({ count: 0 });
  });
});
