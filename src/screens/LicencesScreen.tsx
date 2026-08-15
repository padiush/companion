import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import licences from '../licences.json';
import { border, radius, space, type, useTheme } from '../theme';
import { SectionLabel } from '../ui/SectionLabel';

type Group = {
  licenses: string[];
  text: string | null;
  packages: { name: string; version: string }[];
};

/**
 * Attribution for the open-source packages the app is built from.
 *
 * Shipping a binary through an app store is distribution, and MIT, ISC and BSD
 * all require their notice to travel with the copies they are in. The list is
 * generated from the dependency tree by `npm run licences`, so it cannot drift
 * from what is actually shipped; packages carrying an identical notice are
 * grouped, since most are the same MIT text differing only in a copyright line.
 */
export function LicencesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const groups = licences.groups as Group[];

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.intro, { color: theme.muted }]}>
        {t('licences.intro', { count: licences.packageCount })}
      </Text>

      {groups.map((group, index) => (
        <View
          key={index}
          style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <SectionLabel>{group.licenses.join(' · ')}</SectionLabel>

          <Text style={[styles.packages, { color: theme.text }]}>
            {group.packages.map((p) => p.name).join(', ')}
          </Text>

          {group.text ? (
            <Text style={[styles.licenceText, { color: theme.muted }]}>{group.text}</Text>
          ) : null}
        </View>
      ))}

      {licences.missingText.length > 0 ? (
        <View
          style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <SectionLabel>{t('licences.noNotice')}</SectionLabel>
          <Text style={[styles.intro, { color: theme.muted }]}>
            {t('licences.noNoticeBody')}
          </Text>
          <Text style={[styles.packages, { color: theme.text }]}>
            {licences.missingText.join(', ')}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
    gap: space.md,
    paddingBottom: space.xl,
  },
  intro: {
    ...type.body,
    lineHeight: 22,
  },
  group: {
    borderWidth: border.width,
    borderRadius: radius.control,
    padding: space.md,
    gap: space.sm,
  },
  packages: {
    ...type.caption,
    lineHeight: 19,
  },
  // Licence texts are laid out for a fixed width; a monospaced face keeps
  // their wrapping readable rather than ragged.
  licenceText: {
    ...type.caption,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
});
