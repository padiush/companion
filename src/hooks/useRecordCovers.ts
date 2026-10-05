import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { getDatabase } from '../db/database';
import { recordCoverPhotos } from '../db/mediaRepository';

/**
 * Which photograph each field record is shown by in a list, by record
 * client_id. Read whenever the screen is shown, so a photo just taken appears.
 * Never rejects: records it cannot read covers for are shown without.
 */
export function useRecordCovers(): Record<string, string> {
  const [covers, setCovers] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDatabase()
        .then(recordCoverPhotos)
        .then((found) => {
          if (active) setCovers(found);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [])
  );

  return covers;
}
