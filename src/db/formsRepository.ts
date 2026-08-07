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

/**
 * Bring the cached forms for a project in line with the ones the server still
 * considers active.
 *
 * Pulls only ever added: a form deactivated or deleted on the web stopped
 * appearing in the bundle, the device kept its cached copy marked active, and
 * went on recording interviews against an instrument that had been retired.
 *
 * A form still referenced by a local interview is deactivated rather than
 * deleted — the structure is what renders that interview and what its unsent
 * answers are pushed against, so removing it would strand them. Unreferenced
 * ones go entirely.
 */
export async function pruneForms(
  db: SQLiteDatabase,
  projectId: number,
  activeFormIds: number[]
): Promise<void> {
  // The list is inlined because SQLite has no array binding, so it is narrowed
  // to integers first: these ids come off the wire, and nothing but a number
  // may reach the statement.
  const keep = activeFormIds.filter(Number.isInteger).join(',');
  // An empty list is meaningful — the project has no active forms left — so it
  // must not become an empty IN (), which matches nothing.
  const notActive = keep === '' ? '1 = 1' : `id NOT IN (${keep})`;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM forms
        WHERE project_id = ?
          AND ${notActive}
          AND id NOT IN (SELECT form_id FROM instances)`,
      [projectId]
    );

    await db.runAsync(
      `UPDATE forms SET is_active = 0 WHERE project_id = ? AND ${notActive}`,
      [projectId]
    );
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
