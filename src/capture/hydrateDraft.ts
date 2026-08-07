import type { AnswerRow, CachedForm } from '../db/types';
import { answerKey, decodeAnswerValue, type AnswerValue } from './values';

/** A refused answer with no field left to show it against. */
export interface OrphanedAnswer {
  clientId: string;
  itemId: number;
  error: string;
}

export interface HydratedDraft {
  /** Answers keyed by answerKey(itemId, repeatableIndex), decoded for rendering. */
  answers: Record<string, AnswerValue>;
  /** Number of sets to render per repeatable section (>= 1). */
  repeats: Record<number, number>;
  /** The stored row's client id per slot, so an answer can be acted on. */
  clientIds: Record<string, string>;
  /** The server's refusal per slot, shown against the field it belongs to. */
  errors: Record<string, string>;
  /**
   * Refused answers whose item is no longer in the cached form — the very case
   * that causes the refusal, once the bundle catches up with the deletion.
   * They have nowhere to render, but still block the interview, so they are
   * surfaced separately rather than dropped.
   */
  orphaned: OrphanedAnswer[];
}

/**
 * Rebuild the interview UI state for a form from its stored answer rows, so a
 * draft can be reopened where it was left. Repeatable sections start at one set
 * and grow to fit the highest saved set index. Answers for items no longer in
 * the form are not rendered, but a refused one is reported as orphaned.
 */
export function hydrateDraft(form: CachedForm | null, rows: AnswerRow[]): HydratedDraft {
  const answers: Record<string, AnswerValue> = {};
  const repeats: Record<number, number> = {};
  const clientIds: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const orphaned: OrphanedAnswer[] = [];

  if (!form) {
    return { answers, repeats, clientIds, errors, orphaned };
  }

  const itemType = new Map<number, CachedForm['sections'][number]['items'][number]['type']>();
  const repeatableSections = new Set<number>();
  for (const section of form.sections) {
    if (section.repeatable) {
      repeats[section.id] = 1;
      repeatableSections.add(section.id);
    }
    for (const item of section.items) {
      itemType.set(item.id, item.type);
    }
  }

  for (const row of rows) {
    const type = itemType.get(row.item_id);

    if (type === undefined) {
      if (row.sync_error) {
        orphaned.push({ clientId: row.client_id, itemId: row.item_id, error: row.sync_error });
      }
      continue;
    }

    const key = answerKey(row.item_id, row.repeatable_index);
    answers[key] = decodeAnswerValue(row.value, type);
    clientIds[key] = row.client_id;

    if (row.sync_error) {
      errors[key] = row.sync_error;
    }

    if (row.repeatable_index !== null && repeatableSections.has(row.section_id)) {
      repeats[row.section_id] = Math.max(repeats[row.section_id] ?? 1, row.repeatable_index + 1);
    }
  }

  return { answers, repeats, clientIds, errors, orphaned };
}
