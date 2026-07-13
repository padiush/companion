import type { AnswerRow, CachedForm } from '../db/types';
import { answerKey, decodeAnswerValue, type AnswerValue } from './values';

export interface HydratedDraft {
  /** Answers keyed by answerKey(itemId, repeatableIndex), decoded for rendering. */
  answers: Record<string, AnswerValue>;
  /** Number of sets to render per repeatable section (>= 1). */
  repeats: Record<number, number>;
}

/**
 * Rebuild the interview UI state for a form from its stored answer rows, so a
 * draft can be reopened where it was left. Repeatable sections start at one set
 * and grow to fit the highest saved set index. Answers for items no longer in
 * the form are ignored.
 */
export function hydrateDraft(form: CachedForm | null, rows: AnswerRow[]): HydratedDraft {
  const answers: Record<string, AnswerValue> = {};
  const repeats: Record<number, number> = {};

  if (!form) {
    return { answers, repeats };
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
      continue;
    }

    answers[answerKey(row.item_id, row.repeatable_index)] = decodeAnswerValue(row.value, type);

    if (row.repeatable_index !== null && repeatableSections.has(row.section_id)) {
      repeats[row.section_id] = Math.max(repeats[row.section_id] ?? 1, row.repeatable_index + 1);
    }
  }

  return { answers, repeats };
}
