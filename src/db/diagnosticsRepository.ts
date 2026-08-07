import type { SQLiteDatabase } from 'expo-sqlite';

import type { DiagnosticRow } from './types';

/**
 * Integrity events queued for reporting. Insert ignores a duplicate client_id
 * so a re-recorded event cannot pile up, and rows survive until the server
 * acknowledges them — an event about a device that spends weeks offline is
 * still worth having when it finally reconnects.
 */
export async function insertDiagnostic(db: SQLiteDatabase, row: DiagnosticRow): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO diagnostics
       (client_id, code, occurred_at, app_version, platform, os_version)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.client_id, row.code, row.occurred_at, row.app_version, row.platform, row.os_version]
  );
}

/**
 * The events waiting to be sent, oldest first and capped at the batch size the
 * endpoint accepts. A device that has been out of contact for a long time
 * drains over several syncs rather than being rejected wholesale.
 */
export async function listPendingDiagnostics(
  db: SQLiteDatabase,
  limit: number
): Promise<DiagnosticRow[]> {
  return db.getAllAsync<DiagnosticRow>(
    `SELECT client_id, code, occurred_at, app_version, platform, os_version
       FROM diagnostics
      ORDER BY occurred_at ASC
      LIMIT ?`,
    [limit]
  );
}

/** Forget the events the server confirmed it has. Anything else is retried. */
export async function deleteDiagnostics(db: SQLiteDatabase, clientIds: string[]): Promise<void> {
  if (clientIds.length === 0) {
    return;
  }

  const placeholders = clientIds.map(() => '?').join(', ');
  await db.runAsync(`DELETE FROM diagnostics WHERE client_id IN (${placeholders})`, clientIds);
}

export async function countDiagnostics(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM diagnostics'
  );

  return row?.count ?? 0;
}
