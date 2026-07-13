import type { SQLiteDatabase } from 'expo-sqlite';

import {
  findAnswer,
  getAnswersForInstance,
  insertAnswer,
  updateAnswerValue,
} from '../db/answersRepository';
import { insertInstance, touchInstance, type DraftLocation } from '../db/instancesRepository';
import type { AnswerRow } from '../db/types';
import { uuid } from '../ids';
import { encodeAnswerValue, type AnswerValue } from './values';

export interface CreateDraftParams {
  formId: number;
  projectId: number;
  formVersionCursor?: string | null;
  location?: DraftLocation | null;
}

/** Start a new draft interview on device and return its client-generated id. */
export async function createDraft(db: SQLiteDatabase, params: CreateDraftParams): Promise<string> {
  const id = uuid();
  const now = new Date().toISOString();

  await insertInstance(db, {
    id,
    formId: params.formId,
    projectId: params.projectId,
    capturedAt: now,
    location: params.location ?? null,
    formVersionCursor: params.formVersionCursor ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

export interface SaveAnswerParams {
  instanceId: string;
  sectionId: number;
  itemId: number;
  repeatableIndex: number | null;
  value: AnswerValue;
}

/**
 * Save an answer for a slot. The first save for a (instance, item, repeatable
 * set) mints a client_id and inserts; later saves update the same row and bump
 * its edit-time (the last-writer-wins key on sync).
 */
export async function saveAnswer(db: SQLiteDatabase, params: SaveAnswerParams): Promise<void> {
  const now = new Date().toISOString();
  const encoded = encodeAnswerValue(params.value);

  const existing = await findAnswer(db, params.instanceId, params.itemId, params.repeatableIndex);

  if (existing) {
    await updateAnswerValue(db, existing.client_id, encoded, now);
  } else {
    await insertAnswer(db, {
      clientId: uuid(),
      instanceId: params.instanceId,
      sectionId: params.sectionId,
      itemId: params.itemId,
      repeatableIndex: params.repeatableIndex,
      value: encoded,
      editedAt: now,
    });
  }

  await touchInstance(db, params.instanceId, now);
}

export function getDraftAnswers(db: SQLiteDatabase, instanceId: string): Promise<AnswerRow[]> {
  return getAnswersForInstance(db, instanceId);
}
