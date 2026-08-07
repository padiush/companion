import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import type { InstancePush, ItemType, SyncResult, SyncResultErrors } from '../api/types';
import { decodeAnswerValue } from '../capture/values';
import {
  clearAnswerSyncErrors,
  getAnswersForInstance,
  setAnswerSyncError,
} from '../db/answersRepository';
import { getForm } from '../db/formsRepository';
import { listDraftInstances, setSyncStatus } from '../db/instancesRepository';
import type { AnswerRow, InstanceRow } from '../db/types';

export interface PushSummary {
  synced: number;
  /** Landed on the server, but with answers the server refused. */
  partial: number;
  rejected: number;
}

/**
 * Build the API payload for one draft instance. Multi-select answers are decoded
 * back to arrays (the server re-encodes them), so the stored JSON isn't
 * double-encoded; unknown items fall back to a plain string.
 */
export function toInstancePush(
  instance: InstanceRow,
  answers: AnswerRow[],
  itemTypes: Map<number, ItemType>
): InstancePush {
  const hasLocation = instance.location_lat !== null && instance.location_lng !== null;

  return {
    id: instance.id,
    interview_form_id: instance.form_id,
    captured_at: instance.captured_at ?? undefined,
    form_version_cursor: instance.form_version_cursor ?? undefined,
    location: hasLocation
      ? {
          lat: instance.location_lat as number,
          lng: instance.location_lng as number,
          accuracy_m: instance.location_accuracy_m,
          captured_at: instance.location_captured_at,
        }
      : undefined,
    answers: answers.map((answer) => ({
      client_id: answer.client_id,
      interview_section_id: answer.section_id,
      interview_item_id: answer.item_id,
      repeatable_index: answer.repeatable_index,
      value: decodeAnswerValue(answer.value, itemTypes.get(answer.item_id) ?? 'text'),
      edited_at: answer.edited_at ?? undefined,
    })),
  };
}

export type PushOutcome = 'synced' | 'partial' | 'rejected';

/**
 * The reason a whole instance was refused, taken from the field errors the
 * server attaches (e.g. `interview_form_id: [api.sync.form_not_in_project]`).
 * Only the first is kept: one clear reason is what the interview screen shows.
 */
function instanceError(errors: SyncResultErrors | undefined): string | null {
  for (const [field, value] of Object.entries(errors ?? {})) {
    if (field === 'answers' || !Array.isArray(value)) {
      continue;
    }

    const first = value[0];
    if (typeof first === 'string') {
      return first;
    }
  }

  return null;
}

/**
 * Apply one result to the local store.
 *
 * The trap this replaces: the top-level status was read alone, so a `created`
 * or `updated` carrying per-answer refusals was recorded as fully synced. The
 * refused answers were then neither retried nor shown — they simply vanished,
 * with the interview looking complete.
 *
 * An interview that landed with refusals is 'partial': it is on the server, so
 * re-pushing it unchanged would fail identically, and the outbox rightly leaves
 * it alone. It needs the answer corrected or dropped first.
 */
async function applyResult(db: SQLiteDatabase, result: SyncResult): Promise<PushOutcome> {
  // Whatever failed last time is re-decided by this response.
  await clearAnswerSyncErrors(db, result.id);

  if (result.status === 'rejected') {
    await setSyncStatus(db, result.id, 'rejected', instanceError(result.errors));
    return 'rejected';
  }

  const refused = result.errors?.answers ?? [];

  if (refused.length === 0) {
    await setSyncStatus(db, result.id, 'synced');
    return 'synced';
  }

  await setSyncStatus(db, result.id, 'partial');
  for (const answer of refused) {
    if (answer.client_id) {
      await setAnswerSyncError(db, answer.client_id, answer.error);
    }
  }

  return 'partial';
}

/**
 * Drain the outbox: group draft interviews by project, push each project's batch
 * to instances:sync, and mark every instance by its per-record result. A network
 * failure throws and leaves the drafts untouched to retry.
 */
export async function pushDrafts(db: SQLiteDatabase): Promise<PushSummary> {
  const drafts = await listDraftInstances(db);

  const byProject = new Map<number, InstanceRow[]>();
  for (const draft of drafts) {
    const batch = byProject.get(draft.project_id) ?? [];
    batch.push(draft);
    byProject.set(draft.project_id, batch);
  }

  const summary: PushSummary = { synced: 0, partial: 0, rejected: 0 };

  for (const [projectId, instances] of byProject) {
    const payload: InstancePush[] = [];

    for (const instance of instances) {
      const answers = await getAnswersForInstance(db, instance.id);
      const form = await getForm(db, instance.form_id);

      const itemTypes = new Map<number, ItemType>();
      form?.sections.forEach((section) =>
        section.items.forEach((item) => itemTypes.set(item.id, item.type))
      );

      payload.push(toInstancePush(instance, answers, itemTypes));
    }

    const response = await api.syncInstances(projectId, { instances: payload });

    for (const result of response.results) {
      summary[await applyResult(db, result)] += 1;
    }
  }

  return summary;
}
