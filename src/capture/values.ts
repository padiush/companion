import type { ItemType } from '../api/types';

/** A captured answer value: a string for most items, a list for multi-selects. */
export type AnswerValue = string | string[] | null;

/**
 * Encode an answer for storage and transport. Multi-selects are stored as JSON
 * (matching the platform's web/API encoding); everything else is a plain string.
 */
export function encodeAnswerValue(value: AnswerValue): string | null {
  if (value === null) {
    return null;
  }
  return Array.isArray(value) ? JSON.stringify(value) : value;
}

/** Decode a stored answer back to its typed form for rendering. */
export function decodeAnswerValue(raw: string | null, type: ItemType): AnswerValue {
  if (type === 'multi') {
    if (raw === null) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return raw;
}

/** Whether a value counts as answered (non-empty), for progress and required checks. */
export function isAnswered(value: AnswerValue): boolean {
  if (value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value.trim() !== '';
}
