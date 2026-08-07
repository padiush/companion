import type { SQLiteDatabase } from 'expo-sqlite';

import type { DraftListItem, InstanceRow } from './types';

export interface DraftLocation {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  capturedAt?: string | null;
}

export interface InstanceInsert {
  id: string;
  formId: number;
  projectId: number;
  capturedAt: string;
  location: DraftLocation | null;
  formVersionCursor: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function insertInstance(db: SQLiteDatabase, instance: InstanceInsert): Promise<void> {
  const { location } = instance;
  await db.runAsync(
    `INSERT INTO instances (
       id, form_id, project_id, captured_at,
       location_lat, location_lng, location_accuracy_m, location_captured_at,
       form_version_cursor, sync_status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [
      instance.id,
      instance.formId,
      instance.projectId,
      instance.capturedAt,
      location?.lat ?? null,
      location?.lng ?? null,
      location?.accuracyM ?? null,
      location?.capturedAt ?? null,
      instance.formVersionCursor,
      instance.createdAt,
      instance.updatedAt,
    ]
  );
}

/**
 * Record that the device changed this interview, which also puts it back in the
 * outbox.
 *
 * Editing previously only bumped `updated_at`, so a reopened interview that had
 * already synced kept `sync_status = 'synced'` — and the outbox selects drafts,
 * so the edit was saved locally, reported as saved, and never sent. A local
 * edit always means the server's copy is behind, whatever the interview's last
 * sync outcome was; re-pushing is safe because the server upserts on the
 * client-generated ids.
 */
export async function recordLocalEdit(
  db: SQLiteDatabase,
  id: string,
  updatedAt: string
): Promise<void> {
  await db.runAsync("UPDATE instances SET updated_at = ?, sync_status = 'draft' WHERE id = ?", [
    updatedAt,
    id,
  ]);
}

export async function getInstance(db: SQLiteDatabase, id: string): Promise<InstanceRow | null> {
  return db.getFirstAsync<InstanceRow>('SELECT * FROM instances WHERE id = ?', [id]);
}

export async function listDraftsForForm(
  db: SQLiteDatabase,
  formId: number
): Promise<InstanceRow[]> {
  return db.getAllAsync<InstanceRow>(
    'SELECT * FROM instances WHERE form_id = ? ORDER BY created_at DESC',
    [formId]
  );
}

export async function countDraftsForForm(db: SQLiteDatabase, formId: number): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM instances WHERE form_id = ? AND sync_status = 'draft'",
    [formId]
  );
  return row?.count ?? 0;
}

/** Every unsynced interview, oldest first — the outbox the push engine drains. */
export async function listDraftInstances(db: SQLiteDatabase): Promise<InstanceRow[]> {
  return db.getAllAsync<InstanceRow>(
    "SELECT * FROM instances WHERE sync_status = 'draft' ORDER BY created_at"
  );
}

export async function countDrafts(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM instances WHERE sync_status = 'draft'"
  );
  return row?.count ?? 0;
}

export async function setSyncStatus(db: SQLiteDatabase, id: string, status: string): Promise<void> {
  await db.runAsync('UPDATE instances SET sync_status = ? WHERE id = ?', [status, id]);
}

/** Every recorded interview, newest first, with its form name and answer/media counts. */
export async function listInstancesWithMeta(db: SQLiteDatabase): Promise<DraftListItem[]> {
  return db.getAllAsync<DraftListItem>(
    `SELECT
       i.id, i.form_id, i.project_id, i.captured_at, i.created_at, i.sync_status,
       f.name AS form_name,
       (SELECT COUNT(*) FROM answers a WHERE a.instance_id = i.id) AS answer_count,
       (SELECT COUNT(*) FROM media m WHERE m.instance_id = i.id) AS media_count,
       (SELECT a.value FROM answers a
          WHERE a.instance_id = i.id
            AND a.value IS NOT NULL AND a.value != '' AND a.value NOT LIKE '[%'
          ORDER BY a.section_id, a.item_id
          LIMIT 1) AS preview
     FROM instances i
     LEFT JOIN forms f ON f.id = i.form_id
     ORDER BY i.created_at DESC`
  );
}
