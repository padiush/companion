import type { SQLiteDatabase } from 'expo-sqlite';

import { insertFieldRecord, updateFieldRecord } from '../db/fieldRecordsRepository';
import { uuid } from '../ids';
import { toStoredFields, type FieldRecordDraft } from './fieldRecord';
import { rememberRecordProject } from './recordProject';

/**
 * Store a new field record and return its client-generated id — the key the
 * server will upsert on, minted here because a record made offline has no
 * other identity until it is sent.
 *
 * `answerClientId` names the interview answer the record came out of, when an
 * informant named a plant and the researcher recorded it there and then.
 */
export async function createFieldRecord(
  db: SQLiteDatabase,
  projectId: number,
  draft: FieldRecordDraft,
  answerClientId: string | null = null
): Promise<string> {
  const clientId = uuid();
  const now = new Date().toISOString();

  await insertFieldRecord(db, {
    ...toStoredFields(draft, now),
    clientId,
    projectId,
    answerClientId,
    createdAt: now,
  });

  // The next record, started from the Registros tab, goes here unless told
  // otherwise.
  await rememberRecordProject(db, projectId);

  return clientId;
}

/**
 * Save an edit to a record. Its edit time moves forward — the last-writer-wins
 * key on sync — and it returns to the outbox, so a change made after a send is
 * actually sent.
 */
export async function saveFieldRecord(
  db: SQLiteDatabase,
  clientId: string,
  draft: FieldRecordDraft
): Promise<void> {
  await updateFieldRecord(db, clientId, toStoredFields(draft, new Date().toISOString()));
}
