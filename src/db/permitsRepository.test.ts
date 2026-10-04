import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import { insertFieldRecord } from './fieldRecordsRepository';
import { listPermits, replacePermits, type PermitFromApi } from './permitsRepository';

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

function permit(overrides: Partial<PermitFromApi> = {}): PermitFromApi {
  return {
    id: 1,
    authority: 'MARN',
    reference: 'RES-021-2026',
    issued_on: '2026-01-15',
    expires_on: '2027-01-14',
    ...overrides,
  };
}

it('caches what the bundle sent, ordered for a picker', async () => {
  await replacePermits(db, 1, [
    permit({ id: 2, authority: 'SERFOR', reference: 'B' }),
    permit({ id: 1, authority: 'MARN', reference: 'A' }),
  ]);

  const cached = await listPermits(db, 1);

  expect(cached.map((row) => row.authority)).toEqual(['MARN', 'SERFOR']);
  expect(cached[0]).toMatchObject({ id: 1, reference: 'A', issued_on: '2026-01-15' });
});

/**
 * The bundle carries the full set every time, so a permit that stops appearing
 * has been revoked. An upsert-only cache would go on offering it to a record
 * made in the field — the trap `pruneForms` exists to avoid, in miniature.
 */
it('drops a permit the bundle no longer carries', async () => {
  await replacePermits(db, 1, [permit({ id: 1 }), permit({ id: 2, reference: 'RES-022-2026' })]);

  await replacePermits(db, 1, [permit({ id: 1 })]);

  await expect(listPermits(db, 1)).resolves.toHaveLength(1);
});

it('leaves another project’s permits alone', async () => {
  await replacePermits(db, 1, [permit({ id: 1 })]);
  await replacePermits(db, 2, [permit({ id: 9, authority: 'CONAP' })]);

  await replacePermits(db, 1, []);

  await expect(listPermits(db, 1)).resolves.toEqual([]);
  await expect(listPermits(db, 2)).resolves.toHaveLength(1);
});

/**
 * A record stores the permit id as a plain integer, with no foreign key, so a
 * revoked permit leaving the cache cannot strand or delete the record that
 * named it. The server is what validates the id; the device only offers a
 * choice.
 */
it('does not take a record with it when a permit is revoked', async () => {
  await replacePermits(db, 1, [permit({ id: 1 })]);
  await insertFieldRecord(db, {
    clientId: 'fr-1',
    projectId: 1,
    basisOfRecord: 'preserved_specimen',
    collectingPermitId: 1,
    editedAt: '2026-08-23T10:00:00.000Z',
    createdAt: '2026-08-23T10:00:00.000Z',
    updatedAt: '2026-08-23T10:00:00.000Z',
  });

  await replacePermits(db, 1, []);

  await expect(
    db.getFirstAsync('SELECT collecting_permit_id FROM field_records WHERE client_id = ?', ['fr-1'])
  ).resolves.toEqual({ collecting_permit_id: 1 });
});
