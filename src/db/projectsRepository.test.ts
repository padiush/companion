import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import { insertInstance } from './instancesRepository';
import { getProjects, pruneProjects } from './projectsRepository';

let db: TestDatabase;

const AT = '2026-08-06T10:00:00.000Z';

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

const seedProject = (id: number) =>
  db.runAsync(
    `INSERT INTO projects (id, name, capabilities, updated_at, cached_at) VALUES (?, ?, '{}', ?, ?)`,
    [id, `Project ${id}`, AT, AT],
  );

const seedInstanceIn = (projectId: number) =>
  insertInstance(db, {
    id: `i-${projectId}`,
    formId: 10,
    projectId,
    capturedAt: AT,
    location: null,
    formVersionCursor: null,
    createdAt: AT,
    updatedAt: AT,
  });

const cachedIds = async () => (await getProjects(db)).map((project) => project.id).sort();

describe('pruneProjects', () => {
  it('keeps the projects the user can still record on', async () => {
    await seedProject(1);
    await seedProject(2);

    await pruneProjects(db, [1, 2]);

    await expect(cachedIds()).resolves.toEqual([1, 2]);
  });

  /**
   * Found by running the app: three projects from a previous account stayed
   * listed and tappable after signing in and syncing, because pulls only ever
   * added and nothing ever reconciled.
   */
  it('drops a project the user can no longer record on', async () => {
    await seedProject(1);
    await seedProject(99);

    await pruneProjects(db, [1]);

    await expect(cachedIds()).resolves.toEqual([1]);
  });

  /**
   * Losing access is not a reason to strand work already captured: the
   * interview still has to be visible and sendable, and it carries the project
   * id it will be pushed to.
   */
  it('keeps a project a local interview still belongs to', async () => {
    await seedProject(99);
    await seedInstanceIn(99);

    await pruneProjects(db, []);

    await expect(cachedIds()).resolves.toEqual([99]);
  });

  /**
   * An empty list is meaningful — no access to anything — and must not become
   * an empty IN (), which matches nothing and would keep every stale row.
   */
  it('drops everything when the user can record on nothing', async () => {
    await seedProject(1);
    await seedProject(2);

    await pruneProjects(db, []);

    await expect(cachedIds()).resolves.toEqual([]);
  });

  it('ignores anything in the list that is not an id', async () => {
    await seedProject(1);

    await pruneProjects(db, [1, '2 OR 1=1' as unknown as number]);

    await expect(cachedIds()).resolves.toEqual([1]);
  });
});
