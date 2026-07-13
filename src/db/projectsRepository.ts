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

export async function getProjects(db: SQLiteDatabase): Promise<CachedProject[]> {
  const rows = await db.getAllAsync<ProjectRecord>(
    'SELECT id, name, capabilities, updated_at FROM projects ORDER BY name'
  );

  return rows.map(projectFromRecord);
}
