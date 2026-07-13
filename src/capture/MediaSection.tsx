import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getDatabase } from '../db/database';
import { listMediaForInstance } from '../db/mediaRepository';
import type { MediaRow } from '../db/types';
import { useTheme } from '../theme';
import { attachMedia } from './mediaService';

/** Attach photos and audio to an interview: capture on device, list what's attached. */
export function MediaSection({ instanceId }: { instanceId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [media, setMedia] = useState<MediaRow[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    setMedia(await listMediaForInstance(db, instanceId));
  }, [instanceId]);

  useEffect(() => {
    let active = true;
    getDatabase()
      .then((db) => listMediaForInstance(db, instanceId))
      .then((rows) => {
        if (active) setMedia(rows);
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

  const toggleRecording = async () => {
    setError(null);

    if (recording) {
      await recorder.stop();
      setRecording(false);
      const uri = recorder.uri;
      if (!uri) {
        return;
      }

      setBusy(true);
      try {
        const durationS = startedAt.current
          ? Math.round((Date.now() - startedAt.current) / 1000)
          : null;
        const db = await getDatabase();
        await attachMedia(db, {
          instanceId,
          kind: 'audio',
          localUri: uri,
          contentType: 'audio/mp4',
          durationS,
        });
        await refresh();
      } catch {
        setError(t('interview.mediaSaveFailed'));
      } finally {
        setBusy(false);
      }
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError(t('interview.mediaPermission'));
      return;
    }

    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAt.current = Date.now();
    setRecording(true);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>{t('interview.media')}</Text>

      {media.map((item) => (
        <Text
          key={item.client_id}
          testID={`media-${item.client_id}`}
          style={[styles.item, { color: theme.muted }]}
        >
          {item.kind === 'audio' ? t('interview.audio') : t('interview.photo')}
        </Text>
      ))}

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

      <View style={styles.actions}>
        <TouchableOpacity
          testID="add-photo"
          onPress={addPhoto}
          disabled={busy || recording}
          accessibilityRole="button"
          style={[styles.action, { borderColor: theme.border }]}
        >
          <Text style={[styles.actionText, { color: theme.primary }]}>
            {t('interview.addPhoto')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="record-audio"
          onPress={toggleRecording}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.action, { borderColor: recording ? theme.danger : theme.border }]}
        >
          {busy ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Text style={[styles.actionText, { color: recording ? theme.danger : theme.primary }]}>
              {recording ? t('interview.stopRecording') : t('interview.recordAudio')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  action: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
