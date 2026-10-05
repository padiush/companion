import { useCallback, useEffect, useRef, useState } from 'react';

import { readSession } from '../auth/session';
import { getDatabase } from '../db/database';
import type { FieldRecordLocation } from '../db/fieldRecordsRepository';
import { deleteUnsentFieldRecord, getFieldRecord } from '../db/fieldRecordsRepository';
import { listPermits } from '../db/permitsRepository';
import type { CollectingPermitRow } from '../db/types';
import { formatDate } from './dateValue';
import { draftFromRow, emptyDraft, type FieldRecordDraft } from './fieldRecord';
import { createFieldRecord, saveFieldRecord } from './fieldRecordService';
import { captureLocation } from './location';

/**
 * The interview answer a new record is made from: an informant named a plant,
 * and the researcher records it there and then (ADR 0011 in the platform
 * repository). The name they gave starts the record's local name.
 */
export interface AnswerOrigin {
  answerClientId: string;
  vernacularName?: string;
}

/** What the server accepts for the local name (`max:255`). */
const NAME_LIMIT = 255;

export interface FieldRecordState {
  /** Null until the record, or a new one's defaults, has loaded. */
  draft: FieldRecordDraft | null;
  /** The permits this project holds, as of the last pull. */
  permits: CollectingPermitRow[];
  loading: boolean;
  /** True while a write is in flight, for the save indicator. */
  saving: boolean;
  /** Whether the record has been stored at all; a new one is not until edited. */
  stored: boolean;
  /** The stored record's client_id — what its photographs belong to. */
  clientId: string | null;
  /** Whether the record came out of an interview answer. */
  fromAnswer: boolean;
  /**
   * Whether the record can be discarded: it is stored, and the server has
   * never seen it. Once sent, it belongs to the web.
   */
  discardable: boolean;
  /**
   * A record the server has accepted belongs to the web from then on: the web
   * identifies and deposits it while this copy would go on claiming to be the
   * truth (ADR 0011 in the platform repository). Corrections are made there.
   */
  readOnly: boolean;
  /** How the last push went: draft, synced or rejected. */
  syncStatus: string | null;
  /** Why the server refused the record, if it did (a message key). */
  syncError: string | null;
  /** A GPS fix is being chased. */
  locating: boolean;
  /** The last attempt to get a fix came back with nothing. */
  locationFailed: boolean;
  /** Apply an edit and save it. */
  update: (changes: Partial<FieldRecordDraft>) => void;
  /** Take the device's position now, replacing any coordinate already set. */
  locate: () => void;
  /**
   * Store the record if it is not stored yet, and resolve its client_id — or
   * null for a record that can no longer change. For things that belong to
   * the record rather than edit a field of it, such as a photograph: for an
   * observation that is often the first thing captured, and it needs a record
   * to belong to.
   */
  ensureStored: () => Promise<string | null>;
  /**
   * Delete the record from the device, with its photographs and recordings.
   * Resolves whether it was deleted; a record the server has meanwhile
   * accepted is kept.
   */
  discard: () => Promise<boolean>;
}

/**
 * Drives one field record: reopens a stored one, or prepares a new one, and
 * saves every edit as it is made.
 *
 * A new record is not stored until something is entered. The screen opens
 * with today's date and the researcher as collector already filled in, and
 * chases a GPS fix straight away — none of which is a record of anything, so
 * backing out of the screen leaves nothing behind to send. The first real edit
 * creates the row, carrying whatever the defaults and the fix have filled in
 * by then.
 *
 * Writes are queued rather than fired side by side: the first one inserts the
 * row and mints its id, and every later one needs that id, so a quick second
 * keystroke must not overtake it.
 */
export function useFieldRecord(
  projectId: number,
  existingClientId?: string,
  origin?: AnswerOrigin
): FieldRecordState {
  const [draft, setDraft] = useState<FieldRecordDraft | null>(null);
  const [permits, setPermits] = useState<CollectingPermitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stored, setStored] = useState(existingClientId !== undefined);
  const [clientId, setClientId] = useState<string | null>(existingClientId ?? null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationFailed, setLocationFailed] = useState(false);
  const [linkedAnswer, setLinkedAnswer] = useState<string | null>(null);
  const [serverId, setServerId] = useState<number | null>(null);

  // Primitives, so a caller passing a fresh object each render does not
  // reload the record.
  const originAnswer = origin?.answerClientId ?? null;
  const originName = origin?.vernacularName ?? '';

  const draftRef = useRef<FieldRecordDraft | null>(null);
  const clientIdRef = useRef<string | null>(existingClientId ?? null);
  /** A row exists, or its insert is queued: from here every change is saved. */
  const started = useRef(existingClientId !== undefined);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const pendingWrites = useRef(0);
  const mounted = useRef(true);
  /** Discarded: nothing more is written, so an edit cannot bring it back. */
  const discarded = useRef(false);

  const readOnly = syncStatus === 'synced';

  /** Queue a save of whatever the draft holds by the time the write runs. */
  const persist = useCallback(() => {
    started.current = true;
    setStored(true);
    pendingWrites.current += 1;
    setSaving(true);

    writes.current = writes.current
      .then(async () => {
        const current = draftRef.current;
        if (!current || discarded.current) {
          return;
        }

        const db = await getDatabase();
        if (clientIdRef.current) {
          await saveFieldRecord(db, clientIdRef.current, current);
        } else {
          clientIdRef.current = await createFieldRecord(db, projectId, current, originAnswer);
          if (mounted.current) {
            setClientId(clientIdRef.current);
          }
        }
      })
      .catch(() => {
        // The next edit writes the whole record again, so one failed write
        // loses nothing that a later one does not put back.
      })
      .finally(() => {
        pendingWrites.current -= 1;
        if (pendingWrites.current === 0 && mounted.current) {
          setSaving(false);
        }
      });
  }, [projectId, originAnswer]);

  const apply = useCallback(
    (changes: Partial<FieldRecordDraft>, save: boolean) => {
      if (!draftRef.current) {
        return;
      }

      const next = { ...draftRef.current, ...changes };
      draftRef.current = next;
      setDraft(next);

      if (save) {
        // Editing a refused record is an attempt to fix it; saving puts it
        // back in the outbox, and the next push decides afresh.
        setSyncStatus('draft');
        setSyncError(null);
        persist();
      }
    },
    [persist]
  );

  /**
   * Chase a fix and apply it. `save` says whether the fix alone is worth
   * storing: it is when someone asked for it, and when the record already
   * exists; it is not when the screen merely opened.
   */
  const chaseLocation = useCallback(
    async (options: { save: boolean; onlyIfMissing: boolean }) => {
      setLocating(true);
      const location: FieldRecordLocation | null = await captureLocation().then((fix) =>
        fix ? { lat: fix.lat, lng: fix.lng } : null
      );

      if (!mounted.current) {
        return;
      }

      setLocating(false);
      setLocationFailed(location === null);

      if (!location || (options.onlyIfMissing && draftRef.current?.location)) {
        return;
      }

      apply({ location }, options.save || started.current);
    },
    [apply]
  );

  useEffect(() => {
    mounted.current = true;

    (async () => {
      const db = await getDatabase();
      const cachedPermits = await listPermits(db, projectId);
      const row = existingClientId ? await getFieldRecord(db, existingClientId) : null;

      let initial: FieldRecordDraft;
      if (row) {
        initial = draftFromRow(row);
        setSyncStatus(row.sync_status);
        setSyncError(row.sync_error);
        setLinkedAnswer(row.answer_client_id);
        setServerId(row.server_id);
      } else {
        // Asked for a record that is not here any more: start a new one
        // rather than save edits against a row that no longer exists.
        clientIdRef.current = null;
        started.current = false;
        setStored(false);
        setClientId(null);
        const session = await readSession();
        initial = {
          ...emptyDraft({
            collector: session?.user.name ?? '',
            today: formatDate(new Date()),
          }),
          // A default like the date and the collector: the record is still
          // not stored until something is entered.
          vernacularName: originName.trim().slice(0, NAME_LIMIT),
        };
        setSyncStatus('draft');
        setLinkedAnswer(originAnswer);
      }

      if (!mounted.current) {
        return;
      }

      draftRef.current = initial;
      setDraft(initial);
      setPermits(cachedPermits);
      setLoading(false);

      // Where a record was made is measured when it is made. A record being
      // reopened keeps the coordinate it was captured with; moving it is an
      // explicit act.
      if (!row) {
        void chaseLocation({ save: false, onlyIfMissing: true });
      }
    })();

    return () => {
      mounted.current = false;
    };
  }, [projectId, existingClientId, chaseLocation, originAnswer, originName]);

  const update = useCallback(
    (changes: Partial<FieldRecordDraft>) => {
      if (readOnly) {
        return;
      }
      apply(changes, true);
    },
    [apply, readOnly]
  );

  const locate = useCallback(() => {
    if (readOnly) {
      return;
    }
    void chaseLocation({ save: true, onlyIfMissing: false });
  }, [chaseLocation, readOnly]);

  const ensureStored = useCallback(async () => {
    if (readOnly || !draftRef.current) {
      return null;
    }

    if (!started.current) {
      persist();
    }

    // Every queued write, the insert among them, has run once this settles.
    await writes.current;
    return clientIdRef.current;
  }, [persist, readOnly]);

  const discard = useCallback(async () => {
    if (readOnly || serverId !== null) {
      return false;
    }

    // Let every queued write land first, the insert among them, so none of
    // them runs after the delete and puts the record back.
    discarded.current = true;
    await writes.current;

    if (!clientIdRef.current) {
      return true;
    }

    const db = await getDatabase();
    const deleted = await deleteUnsentFieldRecord(db, clientIdRef.current);
    if (!deleted) {
      // Accepted by the server in the meantime: it is the web's now, and kept.
      discarded.current = false;
    }
    return deleted;
  }, [readOnly, serverId]);

  return {
    draft,
    permits,
    loading,
    saving,
    stored,
    clientId,
    fromAnswer: linkedAnswer !== null,
    discardable: stored && !readOnly && serverId === null,
    readOnly,
    syncStatus,
    syncError,
    locating,
    locationFailed,
    update,
    locate,
    ensureStored,
    discard,
  };
}
