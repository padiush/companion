import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getDatabase } from '../db/database';
import type { MediaRow } from '../db/types';
import { radius, space, type, useTheme } from '../theme';
import { Icon } from '../ui/Icon';
import { SectionLabel } from '../ui/SectionLabel';
import { Thumbnail } from '../ui/Thumbnail';
import {
  currentOwner,
  isReadOnly,
  listOwnedMedia,
  resolveOwner,
  type MediaOwner,
  type MediaOwnerProps,
} from './mediaOwner';
import { attachMedia } from './mediaService';

/**
 * Attach photos to an interview or to a field record. Audio has its own
 * section (AudioRecorder). For a record of something never collected, the
 * photograph is the evidence itself (ADR 0010 in the platform repository).
 */
export function MediaSection(props: MediaOwnerProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const { instanceId, fieldRecordId } = currentOwner(props);
  const readOnly = isReadOnly(props);

  const [photos, setPhotos] = useState<MediaRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (owner: MediaOwner) => {
    setPhotos(await listOwnedMedia(owner, 'photo'));
  }, []);

  useEffect(() => {
    let active = true;
    listOwnedMedia({ instanceId, fieldRecordId }, 'photo').then((rows) => {
      if (active) setPhotos(rows);
    });
    return () => {
      active = false;
    };
  }, [instanceId, fieldRecordId]);

  const addPhoto = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError(t('interview.mediaPermission'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) {
      return;
    }

    setBusy(true);
    try {
      const owner = await resolveOwner(props);
      if (!owner) {
        throw new Error('nothing to attach the photograph to');
      }

      const asset = result.assets[0];
      const db = await getDatabase();
      await attachMedia(db, {
        ...owner,
        kind: 'photo',
        localUri: asset.uri,
        contentType: asset.mimeType ?? 'image/jpeg',
      });
      await refresh(owner);
    } catch {
      setError(t('interview.mediaSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <SectionLabel>{t('interview.photos')}</SectionLabel>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {readOnly ? null : (
          <TouchableOpacity
            testID="add-photo"
            accessibilityRole="button"
            accessibilityLabel={t('interview.addPhoto')}
            accessibilityState={{ busy, disabled: busy }}
            disabled={busy}
            onPress={addPhoto}
            style={[styles.tile, styles.add, { borderColor: theme.chipBorder }]}
          >
            {busy ? (
              <ActivityIndicator color={theme.primaryText} />
            ) : (
              <>
                <Icon name="camera" color={theme.primaryText} size={26} />
                <Text style={[styles.addLabel, { color: theme.primaryText }]}>
                  {t('interview.addPhoto')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {photos.map((item, index) => (
          <Thumbnail
            key={item.client_id}
            testID={`media-${item.client_id}`}
            accessibilityLabel={`${t('interview.photo')} ${index + 1}`}
            mediaId={item.client_id}
            // A photo already sent has left the device, preview and all.
            placeholder={item.upload_status === 'uploaded' ? 'synced' : 'photo'}
            style={styles.tile}
          />
        ))}
      </ScrollView>

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: space.sm,
    marginBottom: space.xl,
  },
  strip: {
    gap: space.sm + 2,
  },
  tile: {
    width: 104,
    height: 104,
    borderRadius: radius.card - 2,
  },
  add: {
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs + 2,
    padding: space.sm,
  },
  addLabel: {
    ...type.caption,
    fontWeight: '800',
    textAlign: 'center',
  },
  error: {
    ...type.label,
    marginTop: space.sm,
  },
});
