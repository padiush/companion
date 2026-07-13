import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

/** Placeholder — the form-fill capture UI lands here next. */
export function InterviewScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ActivityIndicator color={theme.primary} />
      <Text style={[styles.text, { color: theme.muted }]}>{t('interview.preparing')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    fontSize: 15,
  },
});
