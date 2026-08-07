import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import { deleteDiagnostics, listPendingDiagnostics } from '../db/diagnosticsRepository';

/** The largest batch the endpoint accepts; a long-offline device drains over several syncs. */
const BATCH_SIZE = 100;

export interface DiagnosticsPushSummary {
  /** Events the server confirmed and that are now cleared from the device. */
  reported: number;
  /** Whether the attempt failed outright, leaving everything queued. */
  failed: boolean;
}

/**
 * Report queued integrity events and forget the ones the server confirms.
 *
 * Never throws. These reports say that captured data was lost or left
 * unencrypted — losing an interview *and* the sync that would have delivered
 * the rest of them, because the report of the first failed, is not a trade
 * worth making. A failure leaves everything queued for the next sync.
 *
 * Only acknowledged ids are deleted, so a response that never arrives costs a
 * duplicate send rather than a lost event; the endpoint upserts on client_id.
 */
export async function pushDiagnostics(db: SQLiteDatabase): Promise<DiagnosticsPushSummary> {
  try {
    const pending = await listPendingDiagnostics(db, BATCH_SIZE);

    if (pending.length === 0) {
      return { reported: 0, failed: false };
    }

    const { accepted } = await api.reportDiagnostics({
      events: pending.map((row) => ({
        client_id: row.client_id,
        code: row.code,
        occurred_at: row.occurred_at,
        app_version: row.app_version,
        platform: row.platform,
        os_version: row.os_version,
      })),
    });

    // Defend against a response naming something we did not send: only clear
    // rows that were actually in this batch.
    const sent = new Set(pending.map((row) => row.client_id));
    const confirmed = (accepted ?? []).filter((clientId) => sent.has(clientId));

    await deleteDiagnostics(db, confirmed);

    return { reported: confirmed.length, failed: false };
  } catch {
    return { reported: 0, failed: true };
  }
}
