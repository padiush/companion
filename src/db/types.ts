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
