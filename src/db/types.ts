import type { Capabilities, Section } from '../api/types';

/** A row of the `projects` table (JSON columns stored as strings). */
export interface ProjectRecord {
  id: number;
  name: string;
  capabilities: string;
  updated_at: string | null;
}

/** A row of the `forms` table. `structure` is a JSON-encoded `Section[]`. */
export interface FormRecord {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  is_active: number;
  updated_at: string | null;
  structure: string;
}

/** A project as the app uses it (JSON columns parsed). */
export interface CachedProject {
  id: number;
  name: string;
  capabilities: Capabilities;
  updated_at: string | null;
}

/** A form as the app uses it, with its structure ready to render. */
export interface CachedForm {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  updatedAt: string | null;
  sections: Section[];
}

/** A row of the `instances` table — a draft interview captured on device. */
export interface InstanceRow {
  id: string;
  form_id: number;
  project_id: number;
  captured_at: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy_m: number | null;
  location_captured_at: string | null;
  form_version_cursor: string | null;
  sync_status: string;
  /** Why the server rejected the whole interview, if it did (a message key). */
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

/** A row of the `answers` table — one device-authored answer. */
export interface AnswerRow {
  client_id: string;
  instance_id: string;
  section_id: number;
  item_id: number;
  repeatable_index: number | null;
  value: string | null;
  edited_at: string | null;
  /** Why the server refused this answer, if it did (a message key). */
  sync_error: string | null;
}

/** A recorded interview with its form name and answer/media counts, for the list. */
export interface DraftListItem {
  id: string;
  form_id: number;
  project_id: number;
  form_name: string | null;
  captured_at: string | null;
  created_at: string;
  sync_status: string;
  answer_count: number;
  media_count: number;
  /** Recordings attached. Audio is usually the reason the visit happened. */
  audio_count: number;
  /** The first plain-text answer, shown to tell same-form drafts apart. */
  preview: string | null;
}

/**
 * A row of the `diagnostics` table — one integrity event awaiting report.
 * `code` is a `DiagnosticCode`; it is typed as a string here because that is
 * what SQLite hands back, and the server rejects anything outside the set.
 */
export interface DiagnosticRow {
  client_id: string;
  code: string;
  occurred_at: string;
  app_version: string | null;
  platform: string | null;
  os_version: string | null;
}

/**
 * A row of the `media` table — an audio/photo capture and its upload state.
 * It belongs to an interview or to a field record, never to both: exactly one
 * of `instance_id` and `field_record_id` is set.
 */
export interface MediaRow {
  client_id: string;
  instance_id: string | null;
  /** The owning field record's `client_id`, when a record owns it. */
  field_record_id: string | null;
  kind: string;
  local_uri: string | null;
  storage_key: string | null;
  content_type: string | null;
  byte_size: number | null;
  duration_s: number | null;
  upload_status: string;
  transcription_status: string | null;
  captured_at: string | null;
  /** A small JPEG preview of a photograph, while its bytes are on the device. */
  thumbnail?: Uint8Array | null;
}

/**
 * A row of the `field_records` table — one documented encounter captured on
 * this device.
 *
 * The recorded stage only. There is no accession number, repository or
 * determination here: those are written on the web, and a field for them would
 * invite the app to claim something it cannot know
 * (ADR 0011 in the platform repository).
 */
export interface FieldRecordRow {
  client_id: string;
  project_id: number;
  /**
   * Learned from the sync result. Unlike an interview, whose id this device
   * mints, a record has no server identity until the push answers with one —
   * and that id is what its media is later uploaded against.
   */
  server_id: number | null;
  basis_of_record: string;
  vernacular_name: string | null;
  collection_number: string | null;
  collector: string | null;
  collected_on: string | null;
  locality: string | null;
  location_lat: number | null;
  location_lng: number | null;
  notes: string | null;
  collecting_permit_id: number | null;
  permit_exemption: string | null;
  /** The answer this record came out of, by the client_id minted for it. */
  answer_client_id: string | null;
  edited_at: string | null;
  sync_status: string;
  /** Why the server refused the record, if it did (a message key). */
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

/** A record as it is listed: with its project's name, since lists span projects. */
export interface FieldRecordListItem extends FieldRecordRow {
  /** Null if the project is no longer cached on this device. */
  project_name: string | null;
}

/**
 * A row of the `collecting_permits` table — the read-side cache of the permits
 * a project holds. Read-only on the device: a permit is obtained before the
 * fieldwork, and nobody issues one in a forest.
 */
export interface CollectingPermitRow {
  id: number;
  project_id: number;
  authority: string | null;
  reference: string | null;
  issued_on: string | null;
  expires_on: string | null;
}
