import type { Form, ProjectSummary, Section } from '../api/types';
import type { CachedForm, CachedProject, FormRecord, ProjectRecord } from './types';

/**
 * Pure conversions between the API shapes and the persisted row shapes. Kept
 * free of any database I/O so they can be unit-tested directly; the repositories
 * do the SQL.
 */

export function projectRecordFromApi(project: ProjectSummary): ProjectRecord {
  return {
    id: project.id,
    name: project.name,
    capabilities: JSON.stringify(project.capabilities),
    updated_at: project.updated_at,
  };
}

export function projectFromRecord(row: ProjectRecord): CachedProject {
  return {
    id: row.id,
    name: row.name,
    capabilities: JSON.parse(row.capabilities) as CachedProject['capabilities'],
    updated_at: row.updated_at,
  };
}

/** The bundle Form carries no project_id (it's scoped by the URL), so it's injected. */
export function formRecordFromApi(form: Form, projectId: number): FormRecord {
  return {
    id: form.id,
    project_id: projectId,
    name: form.name,
    description: form.description,
    is_active: form.is_active ? 1 : 0,
    updated_at: form.updated_at,
    structure: JSON.stringify(form.sections),
  };
}

export function formFromRecord(row: FormRecord): CachedForm {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    isActive: row.is_active === 1,
    updatedAt: row.updated_at,
    sections: JSON.parse(row.structure) as Section[],
  };
}
