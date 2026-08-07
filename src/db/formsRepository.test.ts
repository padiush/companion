import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import { getForm, getFormsForProject, pruneForms } from './formsRepository';
import { insertInstance } from './instancesRepository';

let db: TestDatabase;

const AT = '2026-08-06T10:00:00.000Z';

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

const seedForm = (id: number, projectId = 1) =>
  db.runAsync(
    `INSERT INTO forms (id, project_id, name, description, is_active, updated_at, structure, cached_at)
     VALUES (?, ?, ?, NULL, 1, ?, '[]', ?)`,
    [id, projectId, `Form ${id}`, AT, AT],
  );

const seedInstanceFor = (formId: number) =>
  insertInstance(db, {
    id: `i-${formId}`,
    formId,
    projectId: 1,
    capturedAt: AT,
    location: null,
    formVersionCursor: null,
    createdAt: AT,
    updatedAt: AT,
  });

const cachedIds = async () =>
  (await getFormsForProject(db, 1)).map((form) => form.id).sort((a, b) => a - b);

describe('pruneForms', () => {
  it('keeps the forms the server still lists', async () => {
    await seedForm(10);
    await seedForm(20);

    await pruneForms(db, 1, [10, 20]);

    await expect(cachedIds()).resolves.toEqual([10, 20]);
  });

  /**
   * The gap this closes: a form deactivated on the web stopped appearing in the
   * bundle, the device kept its cached copy marked active, and went on
   * recording interviews against a retired instrument.
   */
  it('removes a form the server no longer lists', async () => {
    await seedForm(10);
    await seedForm(99);

    await pruneForms(db, 1, [10]);

    await expect(cachedIds()).resolves.toEqual([10]);
  });

  /**
   * The structure is what renders an existing interview and what its unsent
   * answers are pushed against, so a referenced form is retired in place
   * rather than deleted.
   */
  it('deactivates rather than deletes a form a local interview still needs', async () => {
    await seedForm(99);
    await seedInstanceFor(99);

    await pruneForms(db, 1, []);

    const form = await getForm(db, 99);
    expect(form).not.toBeNull();
    expect(form?.isActive).toBe(false);
  });

  it('deletes an unreferenced form outright', async () => {
    await seedForm(99);

    await pruneForms(db, 1, []);

    await expect(getForm(db, 99)).resolves.toBeNull();
  });

  /**
   * An empty list is meaningful — the project has no active forms left — and
   * must not be turned into an empty IN (), which matches nothing and would
   * silently keep every retired form.
   */
  it('retires everything when the project has no active forms left', async () => {
    await seedForm(10);
    await seedForm(20);

    await pruneForms(db, 1, []);

    await expect(cachedIds()).resolves.toEqual([]);
  });

  it('leaves other projects alone', async () => {
    await seedForm(10, 1);
    await seedForm(30, 2);

    await pruneForms(db, 1, []);

    await expect(getForm(db, 30)).resolves.not.toBeNull();
  });

  it('ignores anything in the list that is not an id', async () => {
    await seedForm(10);

    // Nothing but a number may reach the inlined statement.
    await pruneForms(db, 1, [10, '20 OR 1=1' as unknown as number]);

    await expect(cachedIds()).resolves.toEqual([10]);
  });
});
