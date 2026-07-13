import type { SQLiteDatabase } from 'expo-sqlite';

import type { Form } from '../api/types';
import { formFromRecord, formRecordFromApi } from './mappers';
import type { CachedForm, FormRecord } from './types';

const FORM_COLUMNS = 'id, project_id, name, description, is_active, updated_at, structure';

/** Insert or update a project's cached forms from a /bundle pull. */
export async function upsertForms(
  db: SQLiteDatabase,
  forms: Form[],
  projectId: number
): Promise<void> {
  const cachedAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const form of forms) {
      const record = formRecordFromApi(form, projectId);
      await db.runAsync(
        `INSERT INTO forms (id, project_id, name, description, is_active, updated_at, structure, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           project_id = excluded.project_id,
           name = excluded.name,
           description = excluded.description,
           is_active = excluded.is_active,
           updated_at = excluded.updated_at,
           structure = excluded.structure,
           cached_at = excluded.cached_at`,
        [
          record.id,
          record.project_id,
          record.name,
          record.description,
          record.is_active,
          record.updated_at,
          record.structure,
          cachedAt,
        ]
      );
    }
  });
}

export async function getFormsForProject(
  db: SQLiteDatabase,
  projectId: number
): Promise<CachedForm[]> {
  const rows = await db.getAllAsync<FormRecord>(
    `SELECT ${FORM_COLUMNS} FROM forms WHERE project_id = ? ORDER BY name`,
    [projectId]
  );

  return rows.map(formFromRecord);
}

export async function getForm(db: SQLiteDatabase, id: number): Promise<CachedForm | null> {
  const row = await db.getFirstAsync<FormRecord>(`SELECT ${FORM_COLUMNS} FROM forms WHERE id = ?`, [
    id,
  ]);

  return row ? formFromRecord(row) : null;
}
