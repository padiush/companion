import type { SQLiteDatabase } from 'expo-sqlite';

import { getMeta, setMeta } from '../db/syncMetaRepository';

const LAST_PROJECT = 'records.last_project_id';

/** The project the last record on this device was made in, if any. */
export async function getLastRecordProject(db: SQLiteDatabase): Promise<number | null> {
  const value = await getMeta(db, LAST_PROJECT);
  const id = value === null ? NaN : Number(value);

  return Number.isInteger(id) ? id : null;
}

/** Remember a project as the one records are being made in. */
export async function rememberRecordProject(db: SQLiteDatabase, projectId: number): Promise<void> {
  await setMeta(db, LAST_PROJECT, String(projectId));
}

/**
 * Where a new record goes when nobody says: the project the last one went
 * to, as long as it is still on the device, else the first project there is.
 * A day in the field is usually spent in one project, so asking every time
 * would be a question with the same answer.
 */
export function defaultRecordProject(
  projectIds: number[],
  lastProjectId: number | null
): number | null {
  if (lastProjectId !== null && projectIds.includes(lastProjectId)) {
    return lastProjectId;
  }

  return projectIds[0] ?? null;
}
