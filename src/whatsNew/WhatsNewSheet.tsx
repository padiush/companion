import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { border, radius, space, type, useTheme } from '../theme';
import { Button } from '../ui/Button';
import { ReleaseNotes } from './ReleaseNotes';
import { currentVersion, releasesSince } from './releases';

interface Props {
  /** The last release seen; the notes after it are shown. */
  since: string;
  onDismiss: () => void;
}

/**
 * "What's new?", once, after an update: the notes of every release since the
 * last one seen on this device. Closing it — the button or the system back
 * gesture — counts as seen. A release that shipped without notes is marked
 * seen without showing anything.
 */
export function WhatsNewSheet({ since, onDismiss }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const releases = releasesSince(
    t('whatsNew.releases', { returnObjects: true }),
    since,
    currentVersion()
  );

  const empty = releases.length === 0;

  useEffect(() => {
    if (empty) {
      onDismiss();
    }
  }, [empty, onDismiss]);

  if (empty) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
        <View
          testID="whats-new"
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              paddingBottom: insets.bottom + space.lg,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
              {t('whatsNew.title')}
            </Text>
            <Text style={[styles.intro, { color: theme.muted }]}>{t('whatsNew.intro')}</Text>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <ReleaseNotes releases={releases} />
          </ScrollView>

          <Button testID="whats-new-dismiss" label={t('whatsNew.gotIt')} onPress={onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: radius.control * 2,
    borderTopRightRadius: radius.control * 2,
    borderWidth: border.width,
    borderBottomWidth: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
  },
  header: {
    gap: space.xs,
    marginBottom: space.lg,
  },
  title: {
    ...type.title,
  },
  intro: {
    ...type.label,
  },
  body: {
    flexGrow: 0,
    marginBottom: space.lg,
  },
  bodyContent: {
    paddingBottom: space.sm,
  },
});
