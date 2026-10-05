import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { space, type, useTheme } from '../theme';
import { Card } from '../ui/Card';
import { ReleaseNotes } from '../whatsNew/ReleaseNotes';
import { currentVersion, releasedUpTo } from '../whatsNew/releases';

/** Every release of the app so far and what it brought, newest first. */
export function WhatsNewScreen() {
  const theme = useTheme();
  const { t } = useTranslation();

  const releases = releasedUpTo(t('whatsNew.releases', { returnObjects: true }), currentVersion());

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.content}
      testID="whats-new-screen"
    >
      {releases.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>{t('whatsNew.empty')}</Text>
      ) : (
        <Card>
          <ReleaseNotes releases={releases} />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
  },
  empty: {
    ...type.body,
    textAlign: 'center',
    marginTop: space.xl,
  },
});
