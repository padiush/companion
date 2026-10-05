import { useCallback, useEffect, useRef, useState } from 'react';

import { currentVersion } from './releases';
import { resolveUnseenSince, writeSeenVersion } from './seenVersion';

/**
 * Whether there are release notes to show, decided once, when the session at
 * launch is known — a restored session is what marks an upgrade rather than a
 * new install. `dismiss` records the running release as seen.
 *
 * Storage failing is not worth an error on screen: the notes simply are not
 * shown, or show again next launch.
 */
export function useUnseenRelease(status: 'loading' | 'signedOut' | 'signedIn') {
  const [since, setSince] = useState<string | null>(null);
  const decided = useRef(false);

  useEffect(() => {
    if (status === 'loading' || decided.current) {
      return;
    }
    decided.current = true;

    resolveUnseenSince(status === 'signedIn', currentVersion())
      .then(setSince)
      .catch(() => undefined);
  }, [status]);

  const dismiss = useCallback(() => {
    setSince(null);
    writeSeenVersion(currentVersion()).catch(() => undefined);
  }, []);

  return { since, dismiss };
}
