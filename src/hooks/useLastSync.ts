import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getDatabase } from '../db/database';
import { lastSyncAt } from '../sync/lastSync';

/**
 * When the device last synced, read again whenever the screen is shown and
 * whenever `reload` is called after a sync or send of its own. Never rejects:
 * a value it cannot read is shown as never synced.
 */
export function useLastSync(): { at: Date | null; reload: () => Promise<void> } {
  const [at, setAt] = useState<Date | null>(null);

  const reload = useCallback(async () => {
    try {
      setAt(await lastSyncAt(await getDatabase()));
    } catch {
      setAt(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  return { at, reload };
}
