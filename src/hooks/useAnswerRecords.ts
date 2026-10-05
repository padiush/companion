import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getDatabase } from '../db/database';
import { listFieldRecordsForInstance } from '../db/fieldRecordsRepository';
import type { FieldRecordRow } from '../db/types';

/**
 * The field records made from this interview's answers, grouped by the answer
 * each came out of. Reloaded whenever the interview regains focus, so a record
 * made on its own screen is beside its answer on the way back.
 */
export function useAnswerRecords(instanceId: string | null): Record<string, FieldRecordRow[]> {
  const [byAnswer, setByAnswer] = useState<Record<string, FieldRecordRow[]>>({});

  useFocusEffect(
    useCallback(() => {
      if (!instanceId) {
        return undefined;
      }

      let active = true;

      getDatabase()
        .then((db) => listFieldRecordsForInstance(db, instanceId))
        .then((rows) => {
          if (!active) {
            return;
          }

          const grouped: Record<string, FieldRecordRow[]> = {};
          for (const row of rows) {
            const answer = row.answer_client_id as string;
            (grouped[answer] ??= []).push(row);
          }
          setByAnswer(grouped);
        });

      return () => {
        active = false;
      };
    }, [instanceId])
  );

  return byAnswer;
}
