import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import { insertAnswer } from './answersRepository';
import {
  countDrafts,
  countDraftsForForm,
  getInstance,
  insertInstance,
  listDraftInstances,
  listInstancesWithMeta,
  recordLocalEdit,
  setSyncStatus,
  updateInstanceLocation,
} from './instancesRepository';

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

const AT = '2026-08-06T10:00:00.000Z';

async function seedForm(id: number, name = 'Uses of plants') {
  await db.runAsync(
    `INSERT INTO forms (id, project_id, name, description, is_active, updated_at, structure, cached_at)
     VALUES (?, 1, ?, NULL, 1, ?, '[]', ?)`,
    [id, name, AT, AT],
  );
}

async function seedInstance(id: string, overrides: { formId?: number; capturedAt?: string } = {}) {
  await insertInstance(db, {
    id,
    formId: overrides.formId ?? 10,
    projectId: 1,
    capturedAt: overrides.capturedAt ?? AT,
    location: null,
    formVersionCursor: null,
    createdAt: overrides.capturedAt ?? AT,
    updatedAt: overrides.capturedAt ?? AT,
  });
}

describe('insertInstance', () => {
  it('stores a draft with its location and cursor', async () => {
    await insertInstance(db, {
      id: 'i-1',
      formId: 10,
      projectId: 1,
      capturedAt: AT,
      location: { lat: 13.7, lng: -89.2, accuracyM: 8.5, capturedAt: AT },
      formVersionCursor: '2026-08-01T00:00:00.000Z',
      createdAt: AT,
      updatedAt: AT,
    });

    const row = await getInstance(db, 'i-1');

    expect(row).toMatchObject({
      id: 'i-1',
      form_id: 10,
      project_id: 1,
      location_lat: 13.7,
      location_lng: -89.2,
      location_accuracy_m: 8.5,
      form_version_cursor: '2026-08-01T00:00:00.000Z',
      sync_status: 'draft',
    });
  });

  it('leaves the location columns null when there was no GPS fix', async () => {
    await seedInstance('i-1');

    const row = await getInstance(db, 'i-1');

    expect(row?.location_lat).toBeNull();
    expect(row?.location_lng).toBeNull();
    expect(row?.location_accuracy_m).toBeNull();
  });

  it('resolves null for an instance that does not exist', async () => {
    await expect(getInstance(db, 'missing')).resolves.toBeNull();
  });
});

describe('the outbox queries', () => {
  it('lists only drafts, oldest first', async () => {
    await seedInstance('newer', { capturedAt: '2026-08-06T12:00:00.000Z' });
    await seedInstance('older', { capturedAt: '2026-08-06T09:00:00.000Z' });
    await seedInstance('sent');
    await setSyncStatus(db, 'sent', 'synced');

    const drafts = await listDraftInstances(db);

    expect(drafts.map((draft) => draft.id)).toEqual(['older', 'newer']);
  });

  it('counts drafts globally and per form', async () => {
    await seedInstance('a', { formId: 10 });
    await seedInstance('b', { formId: 10 });
    await seedInstance('c', { formId: 20 });
    await setSyncStatus(db, 'b', 'synced');

    await expect(countDrafts(db)).resolves.toBe(2);
    await expect(countDraftsForForm(db, 10)).resolves.toBe(1);
    await expect(countDraftsForForm(db, 20)).resolves.toBe(1);
    await expect(countDraftsForForm(db, 99)).resolves.toBe(0);
  });
});

describe('recordLocalEdit', () => {
  it('bumps updated_at', async () => {
    await seedInstance('i-1');

    await recordLocalEdit(db, 'i-1', '2026-08-06T15:00:00.000Z');

    await expect(getInstance(db, 'i-1')).resolves.toMatchObject({
      updated_at: '2026-08-06T15:00:00.000Z',
    });
  });

  /**
   * The gap this closes: an edit to an already-synced interview used to leave
   * the status at 'synced', and the outbox only selects drafts — so the change
   * was saved, shown as saved, and never sent.
   */
  it.each(['synced', 'rejected'])('returns a %s interview to the outbox', async (status) => {
    await seedInstance('i-1');
    await setSyncStatus(db, 'i-1', status);

    await recordLocalEdit(db, 'i-1', '2026-08-06T15:00:00.000Z');

    await expect(getInstance(db, 'i-1')).resolves.toMatchObject({ sync_status: 'draft' });
    await expect(listDraftInstances(db)).resolves.toHaveLength(1);
  });
});

describe('listInstancesWithMeta', () => {
  beforeEach(async () => {
    await seedForm(10);
  });

  it('joins the form name and counts answers and media', async () => {
    await seedInstance('i-1');
    await insertAnswer(db, {
      clientId: 'a-1',
      instanceId: 'i-1',
      sectionId: 1,
      itemId: 1,
      repeatableIndex: null,
      value: 'Sábila',
      editedAt: AT,
    });
    await insertAnswer(db, {
      clientId: 'a-2',
      instanceId: 'i-1',
      sectionId: 1,
      itemId: 2,
      repeatableIndex: null,
      value: 'Medicinal',
      editedAt: AT,
    });
    await db.runAsync(
      `INSERT INTO media (client_id, instance_id, kind, upload_status) VALUES (?, ?, 'photo', 'pending')`,
      ['m-1', 'i-1'],
    );

    const [row] = await listInstancesWithMeta(db);

    expect(row).toMatchObject({
      id: 'i-1',
      form_name: 'Uses of plants',
      answer_count: 2,
      media_count: 1,
      preview: 'Sábila',
    });
  });

  it('keeps an interview whose form is no longer cached', async () => {
    await seedInstance('orphan', { formId: 999 });

    const [row] = await listInstancesWithMeta(db);

    expect(row.id).toBe('orphan');
    expect(row.form_name).toBeNull();
  });

  it('previews the first plain answer, skipping blanks and encoded multi-selects', async () => {
    await seedInstance('i-1');
    await insertAnswer(db, {
      clientId: 'a-1',
      instanceId: 'i-1',
      sectionId: 1,
      itemId: 1,
      repeatableIndex: null,
      value: '',
      editedAt: AT,
    });
    await insertAnswer(db, {
      clientId: 'a-2',
      instanceId: 'i-1',
      sectionId: 1,
      itemId: 2,
      repeatableIndex: null,
      value: '["Medicinal","Ritual"]',
      editedAt: AT,
    });
    await insertAnswer(db, {
      clientId: 'a-3',
      instanceId: 'i-1',
      sectionId: 1,
      itemId: 3,
      repeatableIndex: null,
      value: 'Cecropia',
      editedAt: AT,
    });

    const [row] = await listInstancesWithMeta(db);

    expect(row.preview).toBe('Cecropia');
  });

  it('orders newest first', async () => {
    await seedInstance('old', { capturedAt: '2026-08-01T00:00:00.000Z' });
    await seedInstance('new', { capturedAt: '2026-08-06T00:00:00.000Z' });

    const rows = await listInstancesWithMeta(db);

    expect(rows.map((row) => row.id)).toEqual(['new', 'old']);
  });
});

describe('cascading deletes', () => {
  it('removes an instance’s answers and media with it', async () => {
    await seedInstance('i-1');
    await insertAnswer(db, {
      clientId: 'a-1',
      instanceId: 'i-1',
      sectionId: 1,
      itemId: 1,
      repeatableIndex: null,
      value: 'Sábila',
      editedAt: AT,
    });
    await db.runAsync(
      `INSERT INTO media (client_id, instance_id, kind, upload_status) VALUES (?, ?, 'photo', 'pending')`,
      ['m-1', 'i-1'],
    );
    await db.runAsync('INSERT INTO media_blobs (client_id, seq, data) VALUES (?, 0, ?)', [
      'm-1',
      new Uint8Array([1, 2, 3]),
    ]);

    await db.runAsync('DELETE FROM instances WHERE id = ?', ['i-1']);

    await expect(db.getAllAsync('SELECT * FROM answers')).resolves.toEqual([]);
    await expect(db.getAllAsync('SELECT * FROM media')).resolves.toEqual([]);
    // media_blobs cascades through media, so the bytes go too — informant
    // audio must never outlive the interview it belongs to.
    await expect(db.getAllAsync('SELECT * FROM media_blobs')).resolves.toEqual([]);
  });
});

describe('updateInstanceLocation', () => {
  /**
   * Capture never waits for a fix, so the coordinate arrives after the
   * interview already exists — often after answers have been recorded.
   */
  it('attaches a fix to an interview that already exists', async () => {
    await seedInstance('i-1');

    await updateInstanceLocation(db, 'i-1', {
      lat: 13.7,
      lng: -89.2,
      accuracyM: 8.5,
      capturedAt: AT,
    });

    await expect(getInstance(db, 'i-1')).resolves.toMatchObject({
      location_lat: 13.7,
      location_lng: -89.2,
      location_accuracy_m: 8.5,
      location_captured_at: AT,
    });
  });

  it('accepts a fix with no accuracy reported', async () => {
    await seedInstance('i-1');

    await updateInstanceLocation(db, 'i-1', { lat: 13.7, lng: -89.2 });

    await expect(getInstance(db, 'i-1')).resolves.toMatchObject({
      location_lat: 13.7,
      location_accuracy_m: null,
    });
  });

  /** Acquiring a coordinate is not the recorder editing anything. */
  it('leaves the sync status alone', async () => {
    await seedInstance('i-1');
    await setSyncStatus(db, 'i-1', 'synced');

    await updateInstanceLocation(db, 'i-1', { lat: 13.7, lng: -89.2 });

    await expect(getInstance(db, 'i-1')).resolves.toMatchObject({ sync_status: 'synced' });
  });
});
