import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { space, type, useTheme } from '../theme';
import type { Release } from './releases';

/** A release day as the reader's language writes it, from `YYYY-MM-DD`. */
function longDate(date: string, language: string): string {
  // Midday, so no time zone moves it to another day.
  return new Date(`${date}T12:00:00`).toLocaleDateString(language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function Check({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.4-5.4 1.4 1.4-6.8 6.8Z"
        fill={color}
      />
    </Svg>
  );
}

/** The notes of one or more releases, newest first. */
export function ReleaseNotes({ releases }: { releases: Release[] }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.releases}>
      {releases.map((release) => (
        <View key={release.version} testID={`release-${release.version}`}>
          <View style={styles.heading}>
            <Text style={[styles.version, { color: theme.text }]} accessibilityRole="header">
              {t('whatsNew.version', { version: release.version })}
            </Text>
            {release.date ? (
              <Text style={[styles.date, { color: theme.muted }]}>
                {t('whatsNew.releasedOn', { date: longDate(release.date, i18n.language) })}
              </Text>
            ) : null}
          </View>
          {release.items.map((item, index) => (
            <View key={index} style={styles.item}>
              <View style={styles.icon}>
                <Check color={theme.primary} />
              </View>
              <Text style={[styles.itemText, { color: theme.text }]}>{item}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  releases: {
    gap: space.xl,
  },
  heading: {
    marginBottom: space.md,
    gap: 2,
  },
  version: {
    ...type.heading,
  },
  date: {
    ...type.caption,
  },
  item: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.md,
  },
  icon: {
    paddingTop: 2,
  },
  itemText: {
    ...type.body,
    flex: 1,
    lineHeight: 22,
  },
});
