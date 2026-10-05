import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import { emptyDraft } from './fieldRecord';
import { createFieldRecord } from './fieldRecordService';
import { defaultRecordProject, getLastRecordProject, rememberRecordProject } from './recordProject';

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('the project a new record goes to', () => {
  it('is unknown until a record has been made', async () => {
    expect(await getLastRecordProject(db)).toBeNull();
  });

  it('is the project the last record was made in', async () => {
    await rememberRecordProject(db, 9);
    await rememberRecordProject(db, 12);

    expect(await getLastRecordProject(db)).toBe(12);
  });

  /** Wherever the record was started from: the Registros tab, or an interview. */
  it('is remembered whenever a record is created', async () => {
    await createFieldRecord(db, 12, emptyDraft({ collector: 'R.', today: '2026-10-05' }));

    expect(await getLastRecordProject(db)).toBe(12);
  });

  it('defaults to that project while it is still on the device', () => {
    expect(defaultRecordProject([9, 12], 12)).toBe(12);
    expect(defaultRecordProject([9, 12], 77)).toBe(9);
    expect(defaultRecordProject([9, 12], null)).toBe(9);
    expect(defaultRecordProject([], 12)).toBeNull();
  });
});
