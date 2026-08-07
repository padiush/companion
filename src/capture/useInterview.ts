import { useCallback, useEffect, useRef, useState } from 'react';

import { deleteAnswersForSet } from '../db/answersRepository';
import { getDatabase } from '../db/database';
import { getForm } from '../db/formsRepository';
import { getInstance } from '../db/instancesRepository';
import type { AnswerRow, CachedForm } from '../db/types';
import { readBundleCursor } from '../sync/pull';
import { discardRejectedAnswer, retryInstance } from '../sync/resolve';
import { createDraft, getDraftAnswers, saveAnswer } from './captureService';
import { hydrateDraft, type OrphanedAnswer } from './hydrateDraft';
import { captureLocation } from './location';
import { answerKey, type AnswerValue } from './values';

export interface InterviewState {
  form: CachedForm | null;
  instanceId: string | null;
  loading: boolean;
  /** True while an answer write is in flight, for the save indicator. */
  saving: boolean;
  /** Current answers, keyed by answerKey(itemId, repeatableIndex). */
  answers: Record<string, AnswerValue>;
  /** Number of sets rendered per repeatable section. */
  repeats: Record<number, number>;
  /** How the last push went: draft, synced, partial or rejected. */
  syncStatus: string | null;
  /** Why the whole interview was rejected, if it was (a message key). */
  syncError: string | null;
  /** The server's refusal per slot, keyed like `answers`. */
  answerErrors: Record<string, string>;
  /** Refused answers whose item has gone from the form. */
  orphanedErrors: OrphanedAnswer[];
  /** The stored row's client id per slot, for acting on a specific answer. */
  answerClientIds: Record<string, string>;
  setAnswer: (
    sectionId: number,
    itemId: number,
    repeatableIndex: number | null,
    value: AnswerValue
  ) => void;
  addRepeat: (sectionId: number) => void;
  removeRepeat: (sectionId: number) => void;
  /** Queue the interview to be sent again, unchanged. */
  retry: () => void;
  /** Drop a refused answer so the rest of the interview can go. */
  discardAnswer: (clientId: string) => void;
}

/**
 * Drives one interview: loads the cached form and either reopens an existing
 * draft (rehydrating its saved answers) or starts a new one with a GPS fix, then
 * persists each answer as it changes. Repeatable sections start with one set and
 * grow on demand.
 */
export function useInterview(
  formId: number,
  projectId: number,
  existingInstanceId?: string
): InterviewState {
  const [form, setForm] = useState<CachedForm | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [repeats, setRepeats] = useState<Record<number, number>>({});
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const [orphanedErrors, setOrphanedErrors] = useState<OrphanedAnswer[]>([]);
  const [clientIds, setClientIds] = useState<Record<string, string>>({});
  const pendingSaves = useRef(0);

  useEffect(() => {
    let active = true;

    (async () => {
      const db = await getDatabase();
      const loadedForm = await getForm(db, formId);

      let id: string;
      let rows: AnswerRow[];
      let status = 'draft';
      let error: string | null = null;

      if (existingInstanceId) {
        id = existingInstanceId;
        rows = await getDraftAnswers(db, existingInstanceId);
        const instance = await getInstance(db, existingInstanceId);
        status = instance?.sync_status ?? 'draft';
        error = instance?.sync_error ?? null;
      } else {
        const location = await captureLocation();
        // Stamp the structure version this interview is being recorded
        // against. It was always part of the payload and never actually read
        // from the store, so every interview reached the server claiming none.
        const formVersionCursor = await readBundleCursor(db, projectId);
        id = await createDraft(db, { formId, projectId, location, formVersionCursor });
        rows = [];
      }

      if (!active) {
        return;
      }

      const hydrated = hydrateDraft(loadedForm, rows);
      setClientIds(hydrated.clientIds);
      setForm(loadedForm);
      setInstanceId(id);
      setAnswers(hydrated.answers);
      setRepeats(hydrated.repeats);
      setAnswerErrors(hydrated.errors);
      setOrphanedErrors(hydrated.orphaned);
      setSyncStatus(status);
      setSyncError(error);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [formId, projectId, existingInstanceId]);

  const setAnswer = useCallback(
    (sectionId: number, itemId: number, repeatableIndex: number | null, value: AnswerValue) => {
      const key = answerKey(itemId, repeatableIndex);
      setAnswers((prev) => ({ ...prev, [key]: value }));

      // Editing an answer is an attempt to fix it, so its refusal stops
      // applying; the next push decides afresh. The interview leaves whatever
      // failed state it was in, because saving requeues it.
      setAnswerErrors((prev) => {
        if (!(key in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSyncStatus('draft');
      setSyncError(null);

      if (instanceId) {
        pendingSaves.current += 1;
        setSaving(true);
        void getDatabase()
          .then((db) => saveAnswer(db, { instanceId, sectionId, itemId, repeatableIndex, value }))
          .finally(() => {
            pendingSaves.current -= 1;
            if (pendingSaves.current === 0) {
              setSaving(false);
            }
          });
      }
    },
    [instanceId]
  );

  const retry = useCallback(() => {
    if (!instanceId) {
      return;
    }

    setSyncStatus('draft');
    setSyncError(null);
    void getDatabase().then((db) => retryInstance(db, instanceId));
  }, [instanceId]);

  const discardAnswer = useCallback(
    (clientId: string) => {
      if (!instanceId) {
        return;
      }

      // Drop it from the rendered slots as well as the orphan list — it may be
      // either, depending on whether the cached form still has its item.
      const key = Object.keys(clientIds).find((slot) => clientIds[slot] === clientId);
      if (key) {
        const without = (prev: Record<string, unknown>) => {
          const next = { ...prev };
          delete next[key];
          return next;
        };
        setAnswers((prev) => without(prev) as Record<string, AnswerValue>);
        setAnswerErrors((prev) => without(prev) as Record<string, string>);
        setClientIds((prev) => without(prev) as Record<string, string>);
      }

      setOrphanedErrors((prev) => prev.filter((orphan) => orphan.clientId !== clientId));
      setSyncStatus('draft');
      setSyncError(null);
      void getDatabase().then((db) => discardRejectedAnswer(db, instanceId, clientId));
    },
    [instanceId, clientIds]
  );

  const addRepeat = useCallback((sectionId: number) => {
    setRepeats((prev) => ({ ...prev, [sectionId]: (prev[sectionId] ?? 1) + 1 }));
  }, []);

  const removeRepeat = useCallback(
    (sectionId: number) => {
      setRepeats((prev) => {
        const current = prev[sectionId] ?? 1;
        if (current <= 1) {
          return prev;
        }

        const removedIndex = current - 1;
        const section = form?.sections.find((candidate) => candidate.id === sectionId);

        // Drop the removed set's answers from the draft and from local state.
        if (instanceId) {
          void getDatabase().then((db) =>
            deleteAnswersForSet(db, instanceId, sectionId, removedIndex)
          );
        }
        if (section) {
          setAnswers((prevAnswers) => {
            const next = { ...prevAnswers };
            for (const item of section.items) {
              delete next[answerKey(item.id, removedIndex)];
            }
            return next;
          });
        }

        return { ...prev, [sectionId]: current - 1 };
      });
    },
    [instanceId, form]
  );

  return {
    form,
    instanceId,
    loading,
    saving,
    answers,
    repeats,
    syncStatus,
    syncError,
    answerErrors,
    orphanedErrors,
    answerClientIds: clientIds,
    setAnswer,
    addRepeat,
    removeRepeat,
    retry,
    discardAnswer,
  };
}
