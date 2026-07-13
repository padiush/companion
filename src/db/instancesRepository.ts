import type { SQLiteDatabase } from 'expo-sqlite';

import type { InstanceRow } from './types';

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

export async function touchInstance(
  db: SQLiteDatabase,
  id: string,
  updatedAt: string
): Promise<void> {
  await db.runAsync('UPDATE instances SET updated_at = ? WHERE id = ?', [updatedAt, id]);
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
