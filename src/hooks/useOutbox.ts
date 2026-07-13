import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getDatabase } from '../db/database';
import { countDrafts } from '../db/instancesRepository';
import { pushDrafts, type PushSummary } from '../sync/push';
import { uploadMedia } from '../sync/uploadMedia';

export interface OutboxState {
  /** Draft interviews waiting to be sent. */
  count: number;
  sending: boolean;
  error: boolean;
  lastResult: PushSummary | null;
  /** Drain the outbox; resolves the push summary, or null if it failed. */
  send: () => Promise<PushSummary | null>;
}

/**
 * The outbox of unsent interviews. Refreshes its count whenever the screen
 * regains focus (e.g. after capturing an interview) and drains it on demand.
 */
export function useOutbox(): OutboxState {
  const [count, setCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [lastResult, setLastResult] = useState<PushSummary | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    setCount(await countDrafts(db));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const send = useCallback(async () => {
    setSending(true);
    setError(false);
    try {
      const db = await getDatabase();
      const result = await pushDrafts(db);
      // Instances are on the server now, so their media can upload (best effort).
      await uploadMedia(db);
      setLastResult(result);
      setCount(await countDrafts(db));
      return result;
    } catch {
      setError(true);
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  return { count, sending, error, lastResult, send };
}
