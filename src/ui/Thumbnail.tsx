import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { bytesToBase64 } from '../capture/thumbnail';
import { getDatabase } from '../db/database';
import { getThumbnail } from '../db/mediaRepository';
import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

interface Props {
  /** The photograph's client_id; null shows the placeholder. */
  mediaId: string | null;
  /** Shown when there is no preview: sent and deleted, or never made. */
  placeholder?: IconName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * What a screen reader says for it. Without one the preview is decorative —
   * on a card that already names the record — and is skipped.
   */
  accessibilityLabel?: string;
}

/**
 * A photograph's preview, read from the encrypted store and drawn from memory.
 * Caching is off, so the decoded image is never written to the image
 * library's disk cache — the one copy of an informant's photograph on the
 * device stays the encrypted one.
 */
export function Thumbnail({
  mediaId,
  placeholder = 'photo',
  style,
  testID,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  // Kept with the id it was read for, so a reused view never shows another
  // photograph's preview while its own loads.
  const [loaded, setLoaded] = useState<{ id: string; uri: string } | null>(null);
  const uri = loaded && loaded.id === mediaId ? loaded.uri : null;

  useEffect(() => {
    if (!mediaId) {
      return undefined;
    }
    let active = true;

    getDatabase()
      .then((db) => getThumbnail(db, mediaId))
      .then((bytes) => {
        if (active && bytes) {
          setLoaded({ id: mediaId, uri: `data:image/jpeg;base64,${bytesToBase64(bytes)}` });
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [mediaId]);

  return (
    <View
      testID={testID}
      style={[styles.box, { backgroundColor: theme.primarySoft }, style]}
      {...(accessibilityLabel
        ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
        : {
            accessibilityElementsHidden: true,
            importantForAccessibility: 'no-hide-descendants' as const,
          })}
    >
      {uri ? (
        <Image
          testID={testID ? `${testID}-image` : undefined}
          source={{ uri }}
          cachePolicy="none"
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Icon name={placeholder} color={theme.primaryText} size={28} strokeWidth={1.6} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
