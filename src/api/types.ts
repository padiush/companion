/**
 * Types mirroring the Padiush Companion API (`/api/v1`). The authoritative
 * contract is the platform's docs/api/openapi.yaml; keep these in step with it.
 */

export type ItemType = 'text' | 'number' | 'date' | 'multi' | 'select';

export interface Capabilities {
  manage_project: boolean;
  manage_users: boolean;
  manage_forms: boolean;
  record_data: boolean;
  manage_data: boolean;
  generate_reports: boolean;
  view_catalog: boolean;
  edit_catalog: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface ProjectSummary {
  id: number;
  name: string;
  capabilities: Capabilities;
  updated_at: string | null;
}

export interface MeResponse {
  user: User;
  projects: ProjectSummary[];
}

export interface Item {
  id: number;
  label: string;
  name: string;
  type: ItemType;
  required: boolean;
  options: string[] | null;
  link_to_species: boolean;
  is_use_category: boolean;
  min: number | null;
  max: number | null;
  step: number | null;
  order: number | null;
}

export interface Section {
  id: number;
  name: string;
  order: number | null;
  repeatable: boolean;
  items: Item[];
}

export interface Form {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  updated_at: string | null;
  sections: Section[];
}

export interface Bundle {
  form_version_cursor: string | null;
  server_time: string;
  /**
   * Every form the project still records against. `forms` is a delta once
   * `since` is sent, and a delta cannot express a removal — a retired form
   * simply stops appearing — so this full set is what tells the device which
   * cached forms to retire. Optional so a server predating it is detectable.
   */
  active_form_ids?: number[];
  forms: Form[];
}

export interface Location {
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  captured_at?: string | null;
}

export interface AnswerPush {
  client_id: string;
  interview_section_id: number;
  interview_item_id: number;
  repeatable_index?: number | null;
  value: unknown;
  edited_at?: string;
}

export interface InstancePush {
  id: string;
  interview_form_id: number;
  captured_at?: string;
  form_version_cursor?: string;
  location?: Location;
  answers: AnswerPush[];
}

export interface SyncRequest {
  instances: InstancePush[];
}

export type SyncStatus = 'created' | 'updated' | 'unchanged' | 'rejected';

/** One answer the server refused, named by the client id the device minted. */
export interface AnswerSyncError {
  client_id: string | null;
  /** A message key, e.g. `api.sync.item_not_in_form`. */
  error: string;
}

/**
 * Why a result was not fully accepted. `answers` carries per-answer refusals,
 * and can arrive alongside a `created` or `updated` status — the interview
 * landed, some of its answers did not. Any other key is a field error
 * explaining a wholly rejected instance (e.g. `interview_form_id`).
 */
export interface SyncResultErrors {
  answers?: AnswerSyncError[];
  [field: string]: AnswerSyncError[] | string[] | undefined;
}

export interface SyncResult {
  id: string;
  status: SyncStatus;
  errors?: SyncResultErrors;
}

export interface SyncResponse {
  results: SyncResult[];
}

export type MediaKind = 'audio' | 'photo';

export interface Transcription {
  status: 'queued' | 'processing' | 'done' | 'failed' | null;
  text: string | null;
}

export interface Media {
  id: number;
  client_id: string;
  kind: MediaKind;
  status: 'pending' | 'stored';
  content_type: string | null;
  duration_s: number | null;
  transcription: Transcription | null;
}

export interface InstanceDetail {
  id: string;
  interview_form_id: number;
  captured_at: string | null;
  location: Location | null;
  answers_count: number;
  media: Media[];
}

export interface TokenRequest {
  email: string;
  password: string;
  device_name: string;
}

export interface TokenResponse {
  token: string;
  user: User;
}

export interface MediaIntentRequest {
  client_id: string;
  kind: MediaKind;
  content_type: string;
  byte_size: number;
}

export interface MediaIntentResponse {
  upload_url: string;
  headers: Record<string, string>;
  storage_key: string;
  expires_at: string;
}

export interface MediaCompleteRequest {
  client_id: string;
  storage_key: string;
  duration_s?: number;
}

export interface MediaCompleteResponse {
  id: number;
  status: 'stored';
  transcription?: 'queued';
}

/**
 * One integrity event. There is no message field by design — see
 * `DiagnosticCode` in `src/diagnostics.ts` and the platform's
 * `docs/contracts/companion-api.md`.
 */
export interface DiagnosticEvent {
  client_id: string;
  code: string;
  occurred_at: string;
  app_version?: string | null;
  platform?: string | null;
  os_version?: string | null;
}

export interface DiagnosticsRequest {
  events: DiagnosticEvent[];
}

export interface DiagnosticsResponse {
  /** The client_ids now safely stored; only these are cleared locally. */
  accepted: string[];
}

/** The API's error envelope: { message, message_type: "error", errors? }. */
export interface ApiErrorBody {
  message: string;
  message_type: string;
  errors?: Record<string, string[]>;
}
