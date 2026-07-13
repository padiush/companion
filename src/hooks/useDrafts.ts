import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getDatabase } from '../db/database';
import { listInstancesWithMeta } from '../db/instancesRepository';
import type { DraftListItem } from '../db/types';

export interface DraftsState {
  drafts: DraftListItem[];
  loading: boolean;
  refresh: () => Promise<void>;
}

/** The list of recorded interviews, refreshed whenever the screen is focused. */
export function useDrafts(): DraftsState {
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    setDrafts(await listInstancesWithMeta(db));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return { drafts, loading, refresh };
}
