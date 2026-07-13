import { useCallback, useEffect, useState } from 'react';

import { getDatabase } from '../db/database';
import { getProjects } from '../db/projectsRepository';
import type { CachedProject } from '../db/types';
import { pull } from '../sync/pull';

export interface ProjectsState {
  projects: CachedProject[];
  /** Initial load of the local cache. */
  loading: boolean;
  /** A network pull is in progress. */
  syncing: boolean;
  /** The last sync failed (e.g. offline). */
  error: boolean;
  /** Refresh from the API; resolves true on success, false on failure. */
  sync: () => Promise<boolean>;
}

/**
 * Offline-first project list: shows the local cache immediately and refreshes it
 * from the API on demand. A failed sync surfaces as `error` and leaves the cached
 * data in place.
 */
export function useProjects(): ProjectsState {
  const [projects, setProjects] = useState<CachedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    getDatabase()
      .then(getProjects)
      .then((cached) => {
        if (active) setProjects(cached);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError(false);
    try {
      const db = await getDatabase();
      await pull(db);
      setProjects(await getProjects(db));
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  return { projects, loading, syncing, error, sync };
}
