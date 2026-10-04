import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import type { FieldRecordPush, FieldRecordSyncResult } from '../api/types';
import { listDraftFieldRecords, setFieldRecordSyncResult } from '../db/fieldRecordsRepository';
import type { FieldRecordRow } from '../db/types';

export interface FieldRecordPushSummary {
  synced: number;
  rejected: number;
}

/** The server takes at most this many records in one call (`records: max:100`). */
const BATCH_SIZE = 100;

/**
 * One stored record as `records:sync` takes it. Every recorded field is sent,
 * nulls included: the server applies the fields a payload names, so leaving a
 * blank out would keep whatever an earlier push put there.
 *
 * The location is the exception, sent only when there is one — the server
 * cannot clear coordinates through this endpoint, and the device never removes
 * them either. `answer_client_id` is sent only when the record came out of an
 * answer; the server never clears that link, so there is nothing to null.
 */
export function toFieldRecordPush(row: FieldRecordRow): FieldRecordPush {
  const hasLocation = row.location_lat !== null && row.location_lng !== null;

  return {
    client_id: row.client_id,
    basis_of_record: row.basis_of_record,
    vernacular_name: row.vernacular_name,
    collection_number: row.collection_number,
    collector: row.collector,
    collected_on: row.collected_on,
    locality: row.locality,
    notes: row.notes,
    location: hasLocation
      ? { lat: row.location_lat as number, lng: row.location_lng as number }
      : undefined,
    collecting_permit_id: row.collecting_permit_id,
    permit_exemption: row.permit_exemption,
    answer_client_id: row.answer_client_id ?? undefined,
    edited_at: row.edited_at ?? undefined,
  };
}

/**
 * Why the server refused a record, as one message key. The errors name a field
 * and give its reasons; the first is kept, because one clear reason is what
 * the record's screen shows.
 */
function refusal(result: FieldRecordSyncResult): string | null {
  for (const reasons of Object.values(result.errors ?? {})) {
    if (Array.isArray(reasons) && typeof reasons[0] === 'string') {
      return reasons[0];
    }
  }

  return null;
}

/**
 * Send every record the server has not accepted, project by project, and mark
 * each by its result. Created, updated and unchanged all mean the server holds
 * this record as the device has it; a rejection keeps its reason.
 *
 * Push interviews first: a record that names the answer it came out of is
 * refused while that answer is unknown to the server.
 *
 * A network failure throws and leaves everything queued to retry. Re-sending a
 * batch is safe — the server upserts on `client_id`.
 */
export async function pushFieldRecords(db: SQLiteDatabase): Promise<FieldRecordPushSummary> {
  const drafts = await listDraftFieldRecords(db);

  const byProject = new Map<number, FieldRecordRow[]>();
  for (const draft of drafts) {
    const batch = byProject.get(draft.project_id) ?? [];
    batch.push(draft);
    byProject.set(draft.project_id, batch);
  }

  const summary: FieldRecordPushSummary = { synced: 0, rejected: 0 };

  for (const [projectId, records] of byProject) {
    for (let start = 0; start < records.length; start += BATCH_SIZE) {
      const batch = records.slice(start, start + BATCH_SIZE);
      const sentEditedAt = new Map(batch.map((row) => [row.client_id, row.edited_at]));

      const response = await api.syncRecords(projectId, {
        records: batch.map(toFieldRecordPush),
      });

      for (const result of response.results) {
        const rejected = result.status === 'rejected';

        await setFieldRecordSyncResult(
          db,
          result.client_id,
          {
            status: rejected ? 'rejected' : 'synced',
            serverId: result.id ?? null,
            error: rejected ? refusal(result) : null,
          },
          sentEditedAt.get(result.client_id) ?? null
        );

        summary[rejected ? 'rejected' : 'synced'] += 1;
      }
    }
  }

  return summary;
}
