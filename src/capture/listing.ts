import type { DraftListItem, FieldRecordListItem } from '../db/types';
import { formatDateTime } from './dateValue';
import { recordTitle } from './fieldRecord';

/** The translate function, as far as these helpers use it. */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * What an interview actually holds, said positively.
 *
 * A recording with no answers yet is the normal result of a visit — the audio
 * is captured live and the form filled in afterwards — so it is described as
 * recorded work awaiting a form, not as a row of zeros. Only an interview
 * holding nothing at all is called empty.
 */
export function describeInterview(draft: DraftListItem, t: Translate): string {
  const parts: string[] = [];

  if (draft.audio_count > 0) {
    parts.push(t('drafts.contents.audio', { count: draft.audio_count }));
  }

  const photos = draft.media_count - draft.audio_count;
  if (photos > 0) {
    parts.push(t('drafts.contents.photos', { count: photos }));
  }

  if (draft.answer_count > 0) {
    parts.push(t('drafts.contents.answers', { count: draft.answer_count }));
  } else if (parts.length > 0) {
    parts.push(t('drafts.contents.formPending'));
  }

  return parts.length > 0 ? parts.join('  ·  ') : t('drafts.contents.empty');
}

/** How an interview reads in a list: what tells it apart, then when and what. */
export function interviewRow(draft: DraftListItem, t: Translate, language: string) {
  return {
    title: draft.preview ?? draft.form_name ?? '—',
    meta: [
      `${formatDateTime(new Date(draft.captured_at ?? draft.created_at), language)}  ·  ${describeInterview(draft, t)}`,
    ],
  };
}

/**
 * How a field record reads in a list. The project gets a line of its own: a
 * long study name would otherwise push what the record is off the row.
 */
export function fieldRecordRow(record: FieldRecordListItem, t: Translate) {
  return {
    title: recordTitle(record) ?? t('fieldRecord.untitled'),
    meta: [
      record.project_name ?? '',
      [t(`fieldRecord.bases.${record.basis_of_record}`), record.collected_on]
        .filter(Boolean)
        .join('  ·  '),
    ].filter(Boolean),
  };
}
