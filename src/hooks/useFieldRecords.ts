import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getLastRecordProject } from '../capture/recordProject';
import { getDatabase } from '../db/database';
import { listAllFieldRecords } from '../db/fieldRecordsRepository';
import type { FieldRecordListItem } from '../db/types';

export interface FieldRecordsState {
  records: FieldRecordListItem[];
  /** The project the last record was made in — where a new one goes by default. */
  lastProjectId: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Every field record captured on this device, from any project, newest first.
 * Reloaded whenever the screen regains focus, so a record made or edited on
 * its own screen is in the list on the way back.
 */
export function useFieldRecords(): FieldRecordsState {
  const [records, setRecords] = useState<FieldRecordListItem[]>([]);
  const [lastProjectId, setLastProjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const db = await getDatabase();
      setRecords(await listAllFieldRecords(db));
      setLastProjectId(await getLastRecordProject(db));
    } catch {
      // A read that fails keeps what is shown; the next focus or pull reads
      // again. Whatever happens, the list stops loading.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return { records, lastProjectId, loading, refresh };
}
