import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getDatabase } from '../db/database';
import { countDrafts } from '../db/instancesRepository';
import { countPendingMedia } from '../db/mediaRepository';
import { pushDrafts, type PushSummary } from '../sync/push';
import { uploadMedia, type MediaUploadSummary } from '../sync/uploadMedia';

export interface OutboxState {
  /** Interviews waiting to be sent. */
  count: number;
  /** Photos and audio waiting to be uploaded. */
  pendingMedia: number;
  /** Whether there is anything at all to send. */
  hasWork: boolean;
  sending: boolean;
  error: boolean;
  lastResult: PushSummary | null;
  /** How the media uploads in the last send went. */
  lastMediaResult: MediaUploadSummary | null;
  /** Drain the outbox; resolves the push summary, or null if it failed. */
  send: () => Promise<PushSummary | null>;
}

/**
 * The outbox of unsent work. Refreshes whenever the screen regains focus (e.g.
 * after capturing an interview) and drains it on demand.
 *
 * Media is tracked alongside interviews because it can outlive them: an
 * interview syncs, its photos do not, and an outbox counting only interviews
 * then reports nothing to send while the media sits on the device forever.
 */
export function useOutbox(): OutboxState {
  const [count, setCount] = useState(0);
  const [pendingMedia, setPendingMedia] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [lastResult, setLastResult] = useState<PushSummary | null>(null);
  const [lastMediaResult, setLastMediaResult] = useState<MediaUploadSummary | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    setCount(await countDrafts(db));
    setPendingMedia(await countPendingMedia(db));
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
      // Instances are on the server now, so their media can upload. Per-item
      // failures do not throw — they are reported, not swallowed.
      setLastMediaResult(await uploadMedia(db));
      setLastResult(result);
      setCount(await countDrafts(db));
      setPendingMedia(await countPendingMedia(db));
      return result;
    } catch {
      setError(true);
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  return {
    count,
    pendingMedia,
    lastMediaResult,
    hasWork: count > 0 || pendingMedia > 0,
    sending,
    error,
    lastResult,
    send,
  };
}
