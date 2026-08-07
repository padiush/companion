import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getDatabase } from '../db/database';
import { listMediaForInstance } from '../db/mediaRepository';
import type { MediaRow } from '../db/types';
import { useTheme } from '../theme';
import { SectionLabel } from '../ui/SectionLabel';
import { attachMedia } from './mediaService';

/** Attach photos to an interview. Audio has its own section (AudioRecorder). */
export function MediaSection({ instanceId }: { instanceId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [photos, setPhotos] = useState<MediaRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    const rows = await listMediaForInstance(db, instanceId);
    setPhotos(rows.filter((row) => row.kind === 'photo'));
  }, [instanceId]);

  useEffect(() => {
    let active = true;
    getDatabase()
      .then((db) => listMediaForInstance(db, instanceId))
      .then((rows) => {
        if (active) setPhotos(rows.filter((row) => row.kind === 'photo'));
      });
    return () => {
      active = false;
    };
  }, [instanceId]);

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
      const asset = result.assets[0];
      const db = await getDatabase();
      await attachMedia(db, {
        instanceId,
        kind: 'photo',
        localUri: asset.uri,
        contentType: asset.mimeType ?? 'image/jpeg',
      });
      await refresh();
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

      <TouchableOpacity
        testID="add-photo"
        onPress={addPhoto}
        disabled={busy}
        accessibilityRole="button"
        style={[styles.action, { borderColor: theme.border }]}
      >
        {busy ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <Text style={[styles.actionText, { color: theme.primary }]}>
            {t('interview.addPhoto')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  item: {
    fontSize: 15,
    paddingVertical: 4,
  },
  error: {
    fontSize: 14,
    marginTop: 8,
  },
  action: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 12,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
