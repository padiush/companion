import { StyleSheet, Text } from 'react-native';

import { space, type, useTheme } from '../theme';

/**
 * The small uppercase label the web uses for section kickers — the one
 * signature the two already shared before any of this.
 *
 * It also does a job specific to the app: distinguishing the app's own
 * furniture from the researcher's instrument. Sections that come from the form
 * keep the dominant heading; anything the app adds around them (audio, photos)
 * takes this quieter treatment, so a recorder can always tell which headings
 * are their questionnaire and which are ours.
 */
export function SectionLabel({ children }: { children: string }) {
  const theme = useTheme();

  return <Text style={[styles.label, { color: theme.muted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    ...type.kicker,
    marginBottom: space.md,
  },
});
