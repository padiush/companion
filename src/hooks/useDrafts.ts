import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getDatabase } from '../db/database';
import { listWaitingFieldRecords } from '../db/fieldRecordsRepository';
import { listInstancesWithMeta } from '../db/instancesRepository';
import type { DraftListItem, FieldRecordListItem } from '../db/types';

export interface DraftsState {
  drafts: DraftListItem[];
  /** Field records still to be sent, or refused — what Send carries besides interviews. */
  fieldRecords: FieldRecordListItem[];
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * The outbox as a list: every recorded interview, and the field records not
 * yet on the server. Refreshed whenever the screen is focused.
 */
export function useDrafts(): DraftsState {
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [fieldRecords, setFieldRecords] = useState<FieldRecordListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const db = await getDatabase();
      setDrafts(await listInstancesWithMeta(db));
      setFieldRecords(await listWaitingFieldRecords(db));
    } catch {
      // A read that fails keeps what is shown; the next focus or pull reads
      // again. Whatever happens, the list stops loading — a spinner left
      // turning would hide the outbox until the tab was opened anew.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return { drafts, fieldRecords, loading, refresh };
}
