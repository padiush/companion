import type { SQLiteDatabase } from 'expo-sqlite';

import type { Permit } from '../api/types';
import type { CollectingPermitRow } from './types';

/** A permit as the bundle sends it. */
export type PermitFromApi = Permit;

/**
 * Replace a project's cached permits with what the bundle just sent.
 *
 * A wholesale replace rather than an upsert, because the bundle carries the
 * **full set** every time, never a delta. That is what makes a removal
 * expressible: a permit revoked on the web simply stops appearing, and an
 * upsert-only cache would go on offering it to a record made in the field.
 * The same reasoning `pruneForms` exists for, and cheaper here — there are a
 * handful per project, so there is nothing to reconcile row by row.
 *
 * Nothing references a permit by foreign key on this device: a record stores
 * `collecting_permit_id` as a plain integer, so a cached permit disappearing
 * cannot strand a record that already named it. The record keeps the id it was
 * captured with and the server is the one that validates it.
 */
export async function replacePermits(
  db: SQLiteDatabase,
  projectId: number,
  permits: PermitFromApi[]
): Promise<void> {
  const cachedAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM collecting_permits WHERE project_id = ?', [projectId]);

    for (const permit of permits) {
      await db.runAsync(
        `INSERT INTO collecting_permits
           (id, project_id, authority, reference, issued_on, expires_on, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          permit.id,
          projectId,
          permit.authority ?? null,
          permit.reference ?? null,
          permit.issued_on ?? null,
          permit.expires_on ?? null,
          cachedAt,
        ]
      );
    }
  });
}

/** The permits a record made in this project may name. */
export async function listPermits(
  db: SQLiteDatabase,
  projectId: number
): Promise<CollectingPermitRow[]> {
  return db.getAllAsync<CollectingPermitRow>(
    `SELECT id, project_id, authority, reference, issued_on, expires_on
       FROM collecting_permits
      WHERE project_id = ?
      ORDER BY authority, reference`,
    [projectId]
  );
}
