import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Chevron } from '../components/Chevron';
import { border, radius, space, type, useTheme } from '../theme';

interface StatusRowProps {
  testID: string;
  title: string;
  /** A sync status: draft, synced, partial or rejected. */
  status: string;
  /** Detail lines under the title, one line each. */
  meta: string[];
  onPress: () => void;
}

/**
 * One interview or field record in a list, with its sync status. Every tab
 * lists them the same way, so the same thing reads the same wherever it
 * appears.
 */
export function StatusRow({ testID, title, status, meta, onPress }: StatusRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const statusColor =
    status === 'synced'
      ? theme.primary
      : status === 'rejected' || status === 'partial'
        ? theme.danger
        : theme.muted;

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text
            style={[styles.title, { color: theme.text }]}
            numberOfLines={1}
            // The name can be long and is rarely what distinguishes two rows;
            // one line keeps every row the same height.
          >
            {title}
          </Text>
          <View style={[styles.status, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {t(`drafts.status.${status}`, { defaultValue: status })}
            </Text>
          </View>
        </View>

        {meta.map((line) => (
          <Text key={line} style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
            {line}
          </Text>
        ))}
      </View>
      <Chevron color={theme.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: border.width,
    borderRadius: radius.control,
    padding: space.lg,
    gap: space.md,
  },
  rowMain: {
    flex: 1,
    gap: space.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  title: {
    ...type.body,
    fontWeight: '600',
    flexShrink: 1,
  },
  meta: type.caption,
  status: {
    borderWidth: border.width,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  statusText: {
    ...type.kicker,
    // Below the caption step on purpose: this rides inside a pill next to the
    // row's name and must not compete with it for attention.
    fontSize: 11,
  },
});
