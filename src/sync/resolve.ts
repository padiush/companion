import type { SQLiteDatabase } from 'expo-sqlite';

import { deleteAnswer } from '../db/answersRepository';
import { recordLocalEdit, setSyncStatus } from '../db/instancesRepository';

/**
 * Getting a refused interview moving again.
 *
 * A rejected interview sits outside the outbox, which only drains drafts —
 * correctly, because re-sending it unchanged would be refused for the same
 * reason every time. Without a way out it stayed there permanently, showing a
 * status and offering nothing. These are the two ways out.
 */

/**
 * Queue the interview to be sent again, as-is.
 *
 * For refusals that were never about the content: the form was reactivated on
 * the web, a permission was granted, the item was restored. Nothing local
 * changes, so this is safe to offer even when it will fail again.
 */
export async function retryInstance(db: SQLiteDatabase, instanceId: string): Promise<void> {
  await setSyncStatus(db, instanceId, 'draft');
}

/**
 * Drop an answer the server will not take, and queue the rest.
 *
 * For refusals the device cannot fix by retrying — an item deleted on the web
 * has no slot left to sync into, and deleting a field there already discards
 * its answers behind a confirmation. Keeping the answer would hold the whole
 * interview back, so this trades one answer for the other dozens.
 */
export async function discardRejectedAnswer(
  db: SQLiteDatabase,
  instanceId: string,
  clientId: string
): Promise<void> {
  await deleteAnswer(db, clientId);
  // Returns the interview to the outbox and stamps the edit.
  await recordLocalEdit(db, instanceId, new Date().toISOString());
}
