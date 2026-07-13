import { useEffect, useState } from 'react';

import { getDatabase } from '../db/database';
import { getFormsForProject } from '../db/formsRepository';
import type { CachedForm } from '../db/types';

export interface FormsState {
  forms: CachedForm[];
  loading: boolean;
}

/** Load a project's cached forms from the local store. */
export function useForms(projectId: number): FormsState {
  const [forms, setForms] = useState<CachedForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getDatabase()
      .then((db) => getFormsForProject(db, projectId))
      .then((cached) => {
        if (active) setForms(cached);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  return { forms, loading };
}
