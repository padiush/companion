import { useCallback, useEffect, useRef, useState } from 'react';

import { hasSeenIntro, markIntroSeen } from './introSeen';

/**
 * Whether to open the walkthrough: once per account on this device, the first
 * time it is signed in, and never over another sheet — `waiting` holds it
 * back while the release notes are still to be decided or on screen. Closing
 * it in any way, finished or skipped, counts as seen.
 *
 * Storage failing is not worth an error on screen: the walkthrough is simply
 * not shown, or shows again next time.
 */
export function useIntro(userId: number | null, waiting: boolean) {
  const [open, setOpen] = useState(false);
  const checked = useRef<number | null>(null);

  useEffect(() => {
    if (userId === null || waiting || checked.current === userId) {
      return;
    }
    checked.current = userId;

    hasSeenIntro(userId)
      .then((seen) => setOpen(!seen))
      .catch(() => undefined);
  }, [userId, waiting]);

  const finish = useCallback(() => {
    setOpen(false);
    if (userId !== null) {
      markIntroSeen(userId).catch(() => undefined);
    }
  }, [userId]);

  return { open, finish };
}
