import { useCallback, useEffect, useState } from 'react';

import { getDatabase } from '../db/database';
import { getForm } from '../db/formsRepository';
import type { CachedForm } from '../db/types';
import { createDraft, saveAnswer } from './captureService';
import { captureLocation } from './location';
import { answerKey, type AnswerValue } from './values';

export interface InterviewState {
  form: CachedForm | null;
  instanceId: string | null;
  loading: boolean;
  /** Current answers, keyed by answerKey(itemId, repeatableIndex). */
  answers: Record<string, AnswerValue>;
  /** Number of sets rendered per repeatable section. */
  repeats: Record<number, number>;
  setAnswer: (
    sectionId: number,
    itemId: number,
    repeatableIndex: number | null,
    value: AnswerValue
  ) => void;
  addRepeat: (sectionId: number) => void;
}

/**
 * Drives one interview: loads the cached form, starts a draft (with a GPS fix),
 * and persists each answer as it changes. Repeatable sections start with one set
 * and grow on demand.
 */
export function useInterview(formId: number, projectId: number): InterviewState {
  const [form, setForm] = useState<CachedForm | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [repeats, setRepeats] = useState<Record<number, number>>({});

  useEffect(() => {
    let active = true;

    (async () => {
      const db = await getDatabase();
      const loadedForm = await getForm(db, formId);
      const location = await captureLocation();
      const id = await createDraft(db, { formId, projectId, location });

      if (!active) {
        return;
      }

      setForm(loadedForm);
      setInstanceId(id);
      setRepeats(
        Object.fromEntries(
          (loadedForm?.sections ?? [])
            .filter((section) => section.repeatable)
            .map((section) => [section.id, 1])
        )
      );
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [formId, projectId]);

  const setAnswer = useCallback(
    (sectionId: number, itemId: number, repeatableIndex: number | null, value: AnswerValue) => {
      setAnswers((prev) => ({ ...prev, [answerKey(itemId, repeatableIndex)]: value }));

      if (instanceId) {
        void getDatabase().then((db) =>
          saveAnswer(db, { instanceId, sectionId, itemId, repeatableIndex, value })
        );
      }
    },
    [instanceId]
  );

  const addRepeat = useCallback((sectionId: number) => {
    setRepeats((prev) => ({ ...prev, [sectionId]: (prev[sectionId] ?? 1) + 1 }));
  }, []);

  return { form, instanceId, loading, answers, repeats, setAnswer, addRepeat };
}
