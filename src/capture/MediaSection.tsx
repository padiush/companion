import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { getDatabase } from '../db/database';
import { listMediaForFieldRecord, listMediaForInstance } from '../db/mediaRepository';
import type { MediaRow } from '../db/types';
import { space, type, useTheme } from '../theme';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/SectionLabel';
import { attachMedia } from './mediaService';

type Props =
  | { instanceId: string }
  | {
      /** The record's client_id, once it has been stored; null before. */
      fieldRecordId: string | null;
      /**
       * Store the record if it is not yet, and resolve its client_id — null if
       * it can no longer change. Called only once a photograph has actually
       * been taken, so opening the camera and backing out stores nothing.
       */
      ensureFieldRecord: () => Promise<string | null>;
      /** A sent record keeps the photographs it has and takes no new ones. */
      readOnly?: boolean;
    };

async function listPhotos(owner: { instanceId?: string; fieldRecordId?: string }) {
  const db = await getDatabase();
  const rows = owner.instanceId
    ? await listMediaForInstance(db, owner.instanceId)
    : owner.fieldRecordId
      ? await listMediaForFieldRecord(db, owner.fieldRecordId)
      : [];
  return rows.filter((row) => row.kind === 'photo');
}

/**
 * Attach photos to an interview or to a field record. Audio has its own
 * section (AudioRecorder). For a record of something never collected, the
 * photograph is the evidence itself (ADR 0010 in the platform repository).
 */
export function MediaSection(props: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  const instanceId = 'instanceId' in props ? props.instanceId : undefined;
  const fieldRecordId = 'fieldRecordId' in props ? (props.fieldRecordId ?? undefined) : undefined;
  const readOnly = 'readOnly' in props ? Boolean(props.readOnly) : false;

  const [photos, setPhotos] = useState<MediaRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (owner: { instanceId?: string; fieldRecordId?: string }) => {
    setPhotos(await listPhotos(owner));
  }, []);

  useEffect(() => {
    let active = true;
    listPhotos({ instanceId, fieldRecordId }).then((rows) => {
      if (active) setPhotos(rows);
    });
    return () => {
      active = false;
    };
  }, [instanceId, fieldRecordId]);

  /** Who a new photograph belongs to; for a record, stored on demand. */
  const resolveOwner = async (): Promise<{
    instanceId?: string;
    fieldRecordId?: string;
  } | null> => {
    if ('instanceId' in props) {
      return { instanceId: props.instanceId };
    }

    const id = await props.ensureFieldRecord();
    return id ? { fieldRecordId: id } : null;
  };

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
      const owner = await resolveOwner();
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
