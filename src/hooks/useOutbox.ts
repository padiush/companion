import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getDatabase } from '../db/database';
import { countDraftFieldRecords } from '../db/fieldRecordsRepository';
import { countDrafts } from '../db/instancesRepository';
import { countPendingMedia } from '../db/mediaRepository';
import { pushDiagnostics } from '../sync/pushDiagnostics';
import { pushDrafts, type PushSummary } from '../sync/push';
import { pushFieldRecords, type FieldRecordPushSummary } from '../sync/pushFieldRecords';
import { uploadMedia, type MediaUploadSummary } from '../sync/uploadMedia';

export interface OutboxState {
  /** Interviews waiting to be sent. */
  count: number;
  /** Field records waiting to be sent. */
  fieldRecords: number;
  /** Photos and audio waiting to be uploaded. */
  pendingMedia: number;
  /** Whether there is anything at all to send. */
  hasWork: boolean;
  sending: boolean;
  error: boolean;
  lastResult: PushSummary | null;
  /** How the field records in the last send went. */
  lastRecordResult: FieldRecordPushSummary | null;
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
 *
 * Field records go after interviews, because a record made from an answer is
 * refused until that answer's interview is on the server.
 */
export function useOutbox(): OutboxState {
  const [count, setCount] = useState(0);
  const [fieldRecords, setFieldRecords] = useState(0);
  const [pendingMedia, setPendingMedia] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [lastResult, setLastResult] = useState<PushSummary | null>(null);
  const [lastRecordResult, setLastRecordResult] = useState<FieldRecordPushSummary | null>(null);
  const [lastMediaResult, setLastMediaResult] = useState<MediaUploadSummary | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    setCount(await countDrafts(db));
    setFieldRecords(await countDraftFieldRecords(db));
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

      // Records after interviews. A failure here is reported, but does not
      // hold back the media and diagnostics below: the interviews they belong
      // to are already on the server, and a record batch the server will not
      // take must not keep every recording on the phone with it.
      let records: FieldRecordPushSummary | null = null;
      try {
        records = await pushFieldRecords(db);
      } catch {
        setError(true);
      }

      // Instances are on the server now, so their media can upload. Per-item
      // failures do not throw — they are reported, not swallowed.
      setLastMediaResult(await uploadMedia(db));
      // Last, and unable to throw: a device reporting that it lost captures
      // must not lose the sync that carries the rest of them too.
      await pushDiagnostics(db);
      setLastResult(result);
      setLastRecordResult(records);
      setCount(await countDrafts(db));
      setFieldRecords(await countDraftFieldRecords(db));
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
    fieldRecords,
    pendingMedia,
    lastRecordResult,
    lastMediaResult,
    hasWork: count > 0 || fieldRecords > 0 || pendingMedia > 0,
    sending,
    error,
    lastResult,
    send,
  };
}
