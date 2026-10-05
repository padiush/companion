import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { space, type, useTheme } from '../theme';

/**
 * A section's label, the web's kicker in the field look's heavier weight, with
 * an optional action on the right (a sync, a "see all").
 *
 * It also does a job specific to the app: distinguishing the app's own
 * furniture from the researcher's instrument. Sections that come from the form
 * keep the dominant heading; anything the app adds around them (audio, photos)
 * takes this quieter treatment, so a recorder can always tell which headings
 * are their questionnaire and which are ours.
 */
export function SectionLabel({ children, action }: { children: string; action?: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.muted }]}>{children}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginBottom: space.md,
  },
  label: {
    ...type.kicker,
    flexShrink: 1,
  },
});
