import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getDatabase } from '../db/database';
import { getProjects } from '../db/projectsRepository';
import type { CachedProject } from '../db/types';
import { recordSyncSuccess } from '../sync/lastSync';
import { pull } from '../sync/pull';

export interface ProjectsState {
  projects: CachedProject[];
  /** Initial load of the local cache. */
  loading: boolean;
  /** A network pull is in progress. */
  syncing: boolean;
  /** The last sync failed (e.g. offline). */
  error: boolean;
  /**
   * Refresh from the API; resolves true on success, false on failure. A
   * `quiet` sync — one nobody asked for — does not report its failure.
   */
  sync: (options?: { quiet?: boolean }) => Promise<boolean>;
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

  // On focus, not just on mount: each tab keeps its screen mounted, and a
  // sync run from one must show on the others when they are opened.
  useFocusEffect(
    useCallback(() => {
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
    }, [])
  );

  const sync = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    setSyncing(true);
    setError(false);
    try {
      const db = await getDatabase();
      await pull(db);
      await recordSyncSuccess(db);
      setProjects(await getProjects(db));
      return true;
    } catch {
      // A failure nobody asked about is not news: the cached projects are
      // still there, and Sync reports properly when it is pressed.
      if (!quiet) setError(true);
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  return { projects, loading, syncing, error, sync };
}
