import type { Item } from '../api/types';
import type { CachedForm } from '../db/types';
import { answerKey, isAnswered, type AnswerValue } from './values';

/**
 * Checking an interview against the constraints its form declares.
 *
 * The bundle carries `required`, `min`, `max` and `step`, and none of them were
 * enforced: required fields rendered an asterisk and let completion through
 * anyway, and numeric fields opened a numeric keyboard without bounding what
 * was typed. Incomplete and out-of-range records reached the server.
 *
 * This gates *completion*, never saving. A half-filled interview mid-session is
 * normal fieldwork, and refusing to store it would lose the answers already
 * given — far worse than storing an incomplete one.
 */

export type ValidationReason = 'required' | 'notANumber' | 'min' | 'max' | 'step';

export interface ValidationIssue {
  reason: ValidationReason;
  /** The bound that was breached, for the message (min/max/step only). */
  limit?: number;
}

/** Issues keyed by answerKey(itemId, repeatableIndex), like the answers. */
export type ValidationIssues = Record<string, ValidationIssue>;

/**
 * Steps are counted from `min` when there is one, so a field stepping by 5 from
 * 10 accepts 15 and not 12. Floating-point steps are compared with a small
 * tolerance, or 0.1-style steps would reject their own valid values.
 */
function offGrid(value: number, step: number, min: number | null): boolean {
  const offset = value - (min ?? 0);
  const remainder = Math.abs(offset % step);

  return Math.min(remainder, Math.abs(step - remainder)) > 1e-9;
}

function checkItem(item: Item, value: AnswerValue): ValidationIssue | null {
  if (!isAnswered(value)) {
    // An optional field left blank is not an error; a required one is.
    return item.required ? { reason: 'required' } : null;
  }

  if (item.type !== 'number' || typeof value !== 'string') {
    return null;
  }

  const numeric = Number(value.trim());

  if (!Number.isFinite(numeric)) {
    return { reason: 'notANumber' };
  }

  if (item.min !== null && numeric < item.min) {
    return { reason: 'min', limit: item.min };
  }

  if (item.max !== null && numeric > item.max) {
    return { reason: 'max', limit: item.max };
  }

  if (item.step !== null && item.step > 0 && offGrid(numeric, item.step, item.min)) {
    return { reason: 'step', limit: item.step };
  }

  return null;
}

/**
 * Every constraint an interview currently breaches. `repeats` says how many
 * sets each repeatable section is showing, so only the sets the recorder
 * actually opened are checked.
 */
export function validateInstance(
  form: CachedForm | null,
  answers: Record<string, AnswerValue>,
  repeats: Record<number, number>
): ValidationIssues {
  const issues: ValidationIssues = {};

  if (!form) {
    return issues;
  }

  for (const section of form.sections) {
    const sets = section.repeatable ? (repeats[section.id] ?? 1) : 1;

    for (let set = 0; set < sets; set += 1) {
      const repeatableIndex = section.repeatable ? set : null;

      for (const item of section.items) {
        const key = answerKey(item.id, repeatableIndex);
        const issue = checkItem(item, answers[key] ?? null);

        if (issue) {
          issues[key] = issue;
        }
      }
    }
  }

  return issues;
}
