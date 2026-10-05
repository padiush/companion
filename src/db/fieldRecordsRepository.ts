import type { SQLiteDatabase } from 'expo-sqlite';

import type { FieldRecordRow, WaitingFieldRecord } from './types';

/** Where the encounter happened, as this device measured it. */
export interface FieldRecordLocation {
  lat: number;
  lng: number;
}

/**
 * What the device may author. There is deliberately no accession number,
 * repository or determination: those are written on the web, and a field for
 * them here would invite the app to claim something it cannot know
 * (ADR 0011 in the platform repository).
 */
export interface FieldRecordInsert {
  clientId: string;
  projectId: number;
  basisOfRecord: string;
  vernacularName?: string | null;
  collectionNumber?: string | null;
  collector?: string | null;
  collectedOn?: string | null;
  locality?: string | null;
  location?: FieldRecordLocation | null;
  notes?: string | null;
  collectingPermitId?: number | null;
  permitExemption?: string | null;
  /** The answer this record came out of, by the client_id minted for it. */
  answerClientId?: string | null;
  editedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** The recorded-stage fields an edit may change. */
export type FieldRecordUpdate = Omit<
  FieldRecordInsert,
  'clientId' | 'projectId' | 'createdAt' | 'answerClientId'
>;

/**
 * A permit and an exemption are mutually exclusive: a record carries one or the
 * other, and the pairing has no meaning (ADR 0009). Refused here as well as by
 * the server, so a form filled in the field is caught on the device rather than
 * on return — which may be days later, somewhere else.
 */
function permitColumns(
  permitId: number | null | undefined,
  exemption: string | null | undefined
): [number | null, string | null] {
  const id = permitId ?? null;
  const reason = exemption ?? null;

  if (id !== null && reason !== null) {
    throw new Error('a field record carries a collecting permit or an exemption, never both');
  }

  return [id, reason];
}

export async function insertFieldRecord(
  db: SQLiteDatabase,
  record: FieldRecordInsert
): Promise<void> {
  const [permitId, exemption] = permitColumns(record.collectingPermitId, record.permitExemption);

  await db.runAsync(
    `INSERT INTO field_records (
       client_id, project_id, server_id, basis_of_record, vernacular_name,
       collection_number, collector, collected_on, locality,
       location_lat, location_lng, notes, collecting_permit_id, permit_exemption,
       answer_client_id, edited_at, sync_status, created_at, updated_at
     ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [
      record.clientId,
      record.projectId,
      record.basisOfRecord,
      record.vernacularName ?? null,
      record.collectionNumber ?? null,
      record.collector ?? null,
      record.collectedOn ?? null,
      record.locality ?? null,
      record.location?.lat ?? null,
      record.location?.lng ?? null,
      record.notes ?? null,
      permitId,
      exemption,
      record.answerClientId ?? null,
      record.editedAt,
      record.createdAt,
      record.updatedAt,
    ]
  );
}

/**
 * Apply a local edit, which also puts the record back in the outbox.
 *
 * `sync_status` returns to 'draft' for the reason `recordLocalEdit` does it for
 * interviews: the outbox selects drafts, so an edited record that had already
 * synced would otherwise be saved, reported as saved, and never sent. Re-pushing
 * is safe because the server upserts on `client_id`, and `edited_at` moving
 * forward is exactly what lets the push win.
 */
export async function updateFieldRecord(
  db: SQLiteDatabase,
  clientId: string,
  record: FieldRecordUpdate
): Promise<void> {
  const [permitId, exemption] = permitColumns(record.collectingPermitId, record.permitExemption);

  await db.runAsync(
    `UPDATE field_records SET
       basis_of_record = ?, vernacular_name = ?, collection_number = ?, collector = ?,
       collected_on = ?, locality = ?, location_lat = ?, location_lng = ?, notes = ?,
       collecting_permit_id = ?, permit_exemption = ?, edited_at = ?, updated_at = ?,
       sync_status = 'draft'
     WHERE client_id = ?`,
    [
      record.basisOfRecord,
      record.vernacularName ?? null,
      record.collectionNumber ?? null,
      record.collector ?? null,
      record.collectedOn ?? null,
      record.locality ?? null,
      record.location?.lat ?? null,
      record.location?.lng ?? null,
      record.notes ?? null,
      permitId,
      exemption,
      record.editedAt,
      record.updatedAt,
      clientId,
    ]
  );
}

export async function getFieldRecord(
  db: SQLiteDatabase,
  clientId: string
): Promise<FieldRecordRow | null> {
  return db.getFirstAsync<FieldRecordRow>('SELECT * FROM field_records WHERE client_id = ?', [
    clientId,
  ]);
}

/**
 * Delete a record the server has never seen, with its photographs and
 * recordings: their rows and their encrypted bytes go with it, by the
 * schema's cascades. Returns whether there was such a record.
 *
 * Only a record without a server id. One the server holds belongs to the web
 * from then on, and sync is push-only: deleting the device's copy would not
 * delete the server's, it would only lose sight of it.
 */
export async function deleteUnsentFieldRecord(
  db: SQLiteDatabase,
  clientId: string
): Promise<boolean> {
  const result = await db.runAsync(
    'DELETE FROM field_records WHERE client_id = ? AND server_id IS NULL',
    [clientId]
  );

  return result.changes > 0;
}

/** Every record captured for a project, newest first. */
export async function listFieldRecords(
  db: SQLiteDatabase,
  projectId: number
): Promise<FieldRecordRow[]> {
  return db.getAllAsync<FieldRecordRow>(
    'SELECT * FROM field_records WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  );
}

/**
 * Every record the server has not accepted, from any project, newest first —
 * the ones still waiting to be sent and the ones it refused. This is what the
 * Send action is about, so it is listed where that action is, beside the
 * interviews; sent records are looked up in their own project.
 */
export async function listWaitingFieldRecords(db: SQLiteDatabase): Promise<WaitingFieldRecord[]> {
  return db.getAllAsync<WaitingFieldRecord>(
    `SELECT r.*, p.name AS project_name
       FROM field_records r
       LEFT JOIN projects p ON p.id = r.project_id
      WHERE r.sync_status != 'synced'
      ORDER BY r.created_at DESC`
  );
}

/**
 * The one refusal a later send can cure without anyone touching the record:
 * the answer it came out of was not on the server yet. Once its interview
 * lands, the same record is accepted as it stands.
 */
export const ANSWER_NOT_FOUND = 'api.sync.answer_not_found';

/**
 * Records a push sends: those the server has not accepted yet, and those it
 * refused only because their answer had not arrived. The second kind would
 * otherwise sit refused until edited, though nothing about it needs changing
 * — the interview being sent first is the whole fix.
 */
export async function listDraftFieldRecords(db: SQLiteDatabase): Promise<FieldRecordRow[]> {
  return db.getAllAsync<FieldRecordRow>(
    `SELECT * FROM field_records
      WHERE sync_status = 'draft' OR (sync_status = 'rejected' AND sync_error = ?)
      ORDER BY created_at`,
    [ANSWER_NOT_FOUND]
  );
}

/**
 * Records made from an answer in this interview, oldest first, each with the
 * answer it came out of — so the interview can show, beside an answer, what
 * was already recorded from it.
 */
export async function listFieldRecordsForInstance(
  db: SQLiteDatabase,
  instanceId: string
): Promise<FieldRecordRow[]> {
  return db.getAllAsync<FieldRecordRow>(
    `SELECT r.* FROM field_records r
       JOIN answers a ON a.client_id = r.answer_client_id
      WHERE a.instance_id = ?
      ORDER BY r.created_at`,
    [instanceId]
  );
}

/**
 * Let go of answers that are about to be deleted on the device.
 *
 * A record the server has not accepted would otherwise name an answer that no
 * longer exists anywhere, and be refused on every send. It stays a record of
 * its own — the plant was still documented — and goes back to the outbox if
 * that refusal was what held it. A record the server already holds keeps its
 * link: the server never clears one, and its copy of the answer is unaffected.
 */
export async function unlinkFieldRecordsFromAnswers(
  db: SQLiteDatabase,
  answerClientIds: string[]
): Promise<void> {
  if (answerClientIds.length === 0) {
    return;
  }

  const placeholders = answerClientIds.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE field_records
        SET answer_client_id = NULL,
            sync_status = CASE WHEN sync_error = ? THEN 'draft' ELSE sync_status END,
            sync_error = CASE WHEN sync_error = ? THEN NULL ELSE sync_error END
      WHERE server_id IS NULL AND answer_client_id IN (${placeholders})`,
    [ANSWER_NOT_FOUND, ANSWER_NOT_FOUND, ...answerClientIds]
  );
}

export async function countDraftFieldRecords(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM field_records WHERE sync_status = 'draft'"
  );

  return row?.count ?? 0;
}

/**
 * Apply what the push said about this record.
 *
 * `serverId` is kept because the device has no other way to learn it — unlike
 * an interview, whose id it minted — and it is what the record's media will be
 * uploaded against. A rejection keeps the reason so it can be shown and acted
 * on rather than discarded, matching how a refused interview is handled.
 *
 * `sentEditedAt` is the edit time of the copy the result is about. The record
 * can be edited while its push is in flight, and that newer edit has not been
 * sent: marking the record synced would leave it on the device, read-only,
 * never to be pushed. So the status only changes if the record still carries
 * the edit that was sent; otherwise it stays in the outbox for the next push.
 * The server id is kept either way — the server holds the record regardless.
 */
export async function setFieldRecordSyncResult(
  db: SQLiteDatabase,
  clientId: string,
  result: { status: string; serverId?: number | null; error?: string | null },
  sentEditedAt?: string | null
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE field_records SET server_id = COALESCE(?, server_id) WHERE client_id = ?',
      [result.serverId ?? null, clientId]
    );

    await db.runAsync(
      `UPDATE field_records SET sync_status = ?, sync_error = ?
        WHERE client_id = ? AND (? IS NULL OR edited_at IS ?)`,
      [result.status, result.error ?? null, clientId, sentEditedAt ?? null, sentEditedAt ?? null]
    );
  });
}
