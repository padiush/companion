import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getDatabase } from '../db/database';
import { listFieldRecords } from '../db/fieldRecordsRepository';
import type { FieldRecordRow } from '../db/types';

export interface FieldRecordsState {
  records: FieldRecordRow[];
  loading: boolean;
}

/**
 * The field records captured on this device for a project, newest first.
 * Reloaded whenever the screen regains focus, so a record made or edited on
 * its own screen is in the list on the way back.
 */
export function useFieldRecords(projectId: number): FieldRecordsState {
  const [records, setRecords] = useState<FieldRecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      getDatabase()
        .then((db) => listFieldRecords(db, projectId))
        .then((rows) => {
          if (active) setRecords(rows);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [projectId])
  );

  return { records, loading };
}
