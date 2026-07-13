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
}

/** A row of the `media` table — an audio/photo capture and its upload state. */
export interface MediaRow {
  client_id: string;
  instance_id: string;
  kind: string;
  local_uri: string | null;
  storage_key: string | null;
  content_type: string | null;
  byte_size: number | null;
  duration_s: number | null;
  upload_status: string;
  transcription_status: string | null;
  captured_at: string | null;
}
