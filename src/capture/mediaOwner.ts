import { getDatabase } from '../db/database';
import { listMediaForFieldRecord, listMediaForInstance } from '../db/mediaRepository';
import type { MediaRow } from '../db/types';

/**
 * Who captured media belongs to, as a capture section is told: an interview,
 * which exists before anything is captured into it, or a field record, which
 * may not be stored yet when the first photograph or recording is made.
 */
export type MediaOwnerProps =
  | { instanceId: string }
  | {
      /** The record's client_id, once it has been stored; null before. */
      fieldRecordId: string | null;
      /**
       * Store the record if it is not yet, and resolve its client_id — null if
       * it can no longer change. Called only once something has actually been
       * captured, so opening the camera or the microphone and backing out
       * stores nothing.
       */
      ensureFieldRecord: () => Promise<string | null>;
      /** A sent record keeps the media it has and takes no more. */
      readOnly?: boolean;
    };

/** The owner as the store addresses it; empty for a record not stored yet. */
export interface MediaOwner {
  instanceId?: string;
  fieldRecordId?: string;
}

/** The owner known now, without storing anything. */
export function currentOwner(props: MediaOwnerProps): MediaOwner {
  if ('instanceId' in props) {
    return { instanceId: props.instanceId };
  }

  return props.fieldRecordId ? { fieldRecordId: props.fieldRecordId } : {};
}

/** Whether the owner takes no new media. Only a sent record refuses it. */
export function isReadOnly(props: MediaOwnerProps): boolean {
  return 'readOnly' in props && Boolean(props.readOnly);
}

/**
 * Who a newly captured file belongs to — storing a field record on demand.
 * Null when there is nothing it can be attached to any more.
 */
export async function resolveOwner(props: MediaOwnerProps): Promise<MediaOwner | null> {
  if ('instanceId' in props) {
    return { instanceId: props.instanceId };
  }

  const id = await props.ensureFieldRecord();
  return id ? { fieldRecordId: id } : null;
}

/** The owner's media of one kind, oldest first; none for an owner not stored yet. */
export async function listOwnedMedia(
  owner: MediaOwner,
  kind: 'audio' | 'photo'
): Promise<MediaRow[]> {
  const db = await getDatabase();
  const rows = owner.instanceId
    ? await listMediaForInstance(db, owner.instanceId)
    : owner.fieldRecordId
      ? await listMediaForFieldRecord(db, owner.fieldRecordId)
      : [];
  return rows.filter((row) => row.kind === kind);
}
