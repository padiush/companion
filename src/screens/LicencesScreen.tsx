import { useTranslation } from 'react-i18next';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SOURCE_URL } from '../config';
import licences from '../licences.json';
import { border, radius, space, type, useTheme } from '../theme';
import { SectionLabel } from '../ui/SectionLabel';

type Group = {
  licenses: string[];
  text: string | null;
  packages: { name: string; version: string }[];
};

/**
 * This app's own licence, and attribution for the packages it is built from.
 *
 * Our terms come first: the app is conveyed as a binary through an app store,
 * so the licence has to travel with it and whoever receives it is entitled to
 * the source. Crediting every dependency while saying nothing about ourselves
 * would have it exactly backwards.
 *
 * The dependency list is generated from the tree by `npm run licences`, so it
 * cannot drift from what is actually shipped; packages carrying an identical
 * notice are grouped, since most are the same MIT text differing only in a
 * copyright line.
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
      <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <SectionLabel>{t('licences.thisApp')}</SectionLabel>

        <Text style={[styles.intro, { color: theme.text }]}>
          {t('licences.thisAppBody')}
        </Text>

        <TouchableOpacity
          testID="app-source"
          onPress={() => Linking.openURL(SOURCE_URL)}
          accessibilityRole="link"
        >
          <Text style={[styles.sourceLink, { color: theme.primary }]}>
            {t('licences.viewSource')}
          </Text>
        </TouchableOpacity>
      </View>

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
  sourceLink: {
    ...type.label,
    paddingVertical: space.xs,
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
