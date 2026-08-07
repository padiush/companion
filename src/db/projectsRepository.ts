import type { SQLiteDatabase } from 'expo-sqlite';

import type { ProjectSummary } from '../api/types';
import { projectFromRecord, projectRecordFromApi } from './mappers';
import type { CachedProject, ProjectRecord } from './types';

/** Insert or update the cached projects from a /me pull. */
export async function upsertProjects(
  db: SQLiteDatabase,
  projects: ProjectSummary[]
): Promise<void> {
  const cachedAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const project of projects) {
      const record = projectRecordFromApi(project);
      await db.runAsync(
        `INSERT INTO projects (id, name, capabilities, updated_at, cached_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           capabilities = excluded.capabilities,
           updated_at = excluded.updated_at,
           cached_at = excluded.cached_at`,
        [record.id, record.name, record.capabilities, record.updated_at, cachedAt]
      );
    }
  });
}

/**
 * Drop cached projects the user can no longer record on.
 *
 * Pulls only ever added, so a project someone lost access to — or that belonged
 * to a previous account on a shared device — stayed listed and tappable
 * indefinitely. `/me` returns the full set the user can record on rather than a
 * delta, so absence from it is unambiguous and needs nothing from the server.
 *
 * A project a local interview still belongs to is kept: that interview has to
 * remain visible and sendable, and it carries the project id it will be pushed
 * to. Losing access is not a reason to strand work already captured.
 */
export async function pruneProjects(
  db: SQLiteDatabase,
  accessibleProjectIds: number[]
): Promise<void> {
  // Inlined because SQLite has no array binding, so narrowed to integers first:
  // these ids come off the wire and nothing else may reach the statement.
  const keep = accessibleProjectIds.filter(Number.isInteger).join(',');
  // An empty list is meaningful — no projects at all — so it must not become an
  // empty IN (), which matches nothing and would keep every stale row.
  const accessible = keep === '' ? '1 = 1' : `id NOT IN (${keep})`;

  await db.runAsync(
    `DELETE FROM projects
      WHERE ${accessible}
        AND id NOT IN (SELECT project_id FROM instances)`
  );
}

export async function getProjects(db: SQLiteDatabase): Promise<CachedProject[]> {
  const rows = await db.getAllAsync<ProjectRecord>(
    'SELECT id, name, capabilities, updated_at FROM projects ORDER BY name'
  );

  return rows.map(projectFromRecord);
}
