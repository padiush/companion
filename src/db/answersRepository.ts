import type { SQLiteDatabase } from 'expo-sqlite';

import type { AnswerRow } from './types';

export interface AnswerInsert {
  clientId: string;
  instanceId: string;
  sectionId: number;
  itemId: number;
  repeatableIndex: number | null;
  value: string | null;
  editedAt: string;
}

/**
 * Find the existing answer for a slot — (instance, item, repeatable set). NULL
 * and integer repeatable indices are matched distinctly (SQLite treats NULL as
 * not equal to anything, so `IS NULL` is required for non-repeatable items).
 */
export async function findAnswer(
  db: SQLiteDatabase,
  instanceId: string,
  itemId: number,
  repeatableIndex: number | null
): Promise<AnswerRow | null> {
  if (repeatableIndex === null) {
    return db.getFirstAsync<AnswerRow>(
      'SELECT * FROM answers WHERE instance_id = ? AND item_id = ? AND repeatable_index IS NULL',
      [instanceId, itemId]
    );
  }

  return db.getFirstAsync<AnswerRow>(
    'SELECT * FROM answers WHERE instance_id = ? AND item_id = ? AND repeatable_index = ?',
    [instanceId, itemId, repeatableIndex]
  );
}

export async function insertAnswer(db: SQLiteDatabase, answer: AnswerInsert): Promise<void> {
  await db.runAsync(
    `INSERT INTO answers (client_id, instance_id, section_id, item_id, repeatable_index, value, edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      answer.clientId,
      answer.instanceId,
      answer.sectionId,
      answer.itemId,
      answer.repeatableIndex,
      answer.value,
      answer.editedAt,
    ]
  );
}

export async function updateAnswerValue(
  db: SQLiteDatabase,
  clientId: string,
  value: string | null,
  editedAt: string
): Promise<void> {
  await db.runAsync('UPDATE answers SET value = ?, edited_at = ? WHERE client_id = ?', [
    value,
    editedAt,
    clientId,
  ]);
}

export async function getAnswersForInstance(
  db: SQLiteDatabase,
  instanceId: string
): Promise<AnswerRow[]> {
  return db.getAllAsync<AnswerRow>('SELECT * FROM answers WHERE instance_id = ?', [instanceId]);
}

/** Mark an answer the server refused, so it can be shown and resolved. */
export async function setAnswerSyncError(
  db: SQLiteDatabase,
  clientId: string,
  error: string
): Promise<void> {
  await db.runAsync('UPDATE answers SET sync_error = ? WHERE client_id = ?', [error, clientId]);
}

/**
 * Drop the recorded refusals for an interview, before a fresh push result is
 * applied — otherwise an answer fixed on one attempt would keep the error from
 * the last one.
 */
export async function clearAnswerSyncErrors(
  db: SQLiteDatabase,
  instanceId: string
): Promise<void> {
  await db.runAsync('UPDATE answers SET sync_error = NULL WHERE instance_id = ?', [instanceId]);
}

/** The answers the server refused on the last push, with the reason given. */
export async function getRejectedAnswers(
  db: SQLiteDatabase,
  instanceId: string
): Promise<AnswerRow[]> {
  return db.getAllAsync<AnswerRow>(
    'SELECT * FROM answers WHERE instance_id = ? AND sync_error IS NOT NULL',
    [instanceId]
  );
}

export async function deleteAnswer(db: SQLiteDatabase, clientId: string): Promise<void> {
  await db.runAsync('DELETE FROM answers WHERE client_id = ?', [clientId]);
}

/** Delete all answers for one repeatable set (e.g. when a set is removed). */
export async function deleteAnswersForSet(
  db: SQLiteDatabase,
  instanceId: string,
  sectionId: number,
  repeatableIndex: number
): Promise<void> {
  await db.runAsync(
    'DELETE FROM answers WHERE instance_id = ? AND section_id = ? AND repeatable_index = ?',
    [instanceId, sectionId, repeatableIndex]
  );
}
