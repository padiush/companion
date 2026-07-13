import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import type { InstancePush, ItemType, SyncResult } from '../api/types';
import { decodeAnswerValue } from '../capture/values';
import { getAnswersForInstance } from '../db/answersRepository';
import { getForm } from '../db/formsRepository';
import { listDraftInstances, setSyncStatus } from '../db/instancesRepository';
import type { AnswerRow, InstanceRow } from '../db/types';

export interface PushSummary {
  synced: number;
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

/** created / updated / unchanged all mean it landed; only 'rejected' hasn't. */
function statusFor(result: SyncResult): string {
  return result.status === 'rejected' ? 'rejected' : 'synced';
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

  const summary: PushSummary = { synced: 0, rejected: 0 };

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
      const status = statusFor(result);
      await setSyncStatus(db, result.id, status);
      if (status === 'synced') {
        summary.synced += 1;
      } else {
        summary.rejected += 1;
      }
    }
  }

  return summary;
}
