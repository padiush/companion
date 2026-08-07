import type { SQLiteDatabase } from 'expo-sqlite';

import { api } from '../api/client';
import type { ProjectSummary } from '../api/types';
import { saveSession } from '../auth/session';
import { upsertForms } from '../db/formsRepository';
import { upsertProjects } from '../db/projectsRepository';
import { getMeta, setMeta } from '../db/syncMetaRepository';

/**
 * The read side of sync: cache what the device needs to capture offline. Pulls
 * are incremental — each project's bundle carries a form_version_cursor that is
 * stored and sent back as `since` next time. See the platform's sync-protocol.
 */

const bundleCursorKey = (projectId: number) => `bundle_cursor:${projectId}`;

/** Pull the user's projects from /me and cache them; returns what was pulled. */
export async function pullProjects(db: SQLiteDatabase): Promise<ProjectSummary[]> {
  const { user, projects } = await api.me();

  // A successful /me is the server confirming this identity, so it also
  // refreshes the offline window — otherwise someone who syncs daily but never
  // cold-launches online would still be locked out once the window lapsed.
  await saveSession(user);
  await upsertProjects(db, projects);
  return projects;
}

/** Pull a project's active forms from /bundle (incrementally) and cache them. */
export async function pullForms(db: SQLiteDatabase, projectId: number): Promise<void> {
  const since = (await getMeta(db, bundleCursorKey(projectId))) ?? undefined;
  const bundle = await api.bundle(projectId, since);

  await upsertForms(db, bundle.forms, projectId);

  if (bundle.form_version_cursor) {
    await setMeta(db, bundleCursorKey(projectId), bundle.form_version_cursor);
  }
}

/** A full pull: the projects, then each project's forms. */
export async function pull(db: SQLiteDatabase): Promise<void> {
  const projects = await pullProjects(db);

  for (const project of projects) {
    await pullForms(db, project.id);
  }
}
