import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { getDatabase } from '../db/database';
import type { MediaRow } from '../db/types';
import { space, type, useTheme } from '../theme';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/SectionLabel';
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

      {photos.map((item) => (
        <Text
          key={item.client_id}
          testID={`media-${item.client_id}`}
          style={[styles.item, { color: theme.muted }]}
        >
          {t('interview.photo')}
        </Text>
      ))}

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

      {readOnly ? null : (
        <Button
          testID="add-photo"
          variant="ghost"
          label={t('interview.addPhoto')}
          onPress={addPhoto}
          busy={busy}
          style={styles.action}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: space.sm,
    marginBottom: space.xl,
  },
  item: {
    ...type.body,
    paddingVertical: space.xs,
  },
  error: {
    ...type.label,
    marginTop: space.sm,
  },
  action: {
    marginTop: space.md,
  },
});
