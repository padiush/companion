import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { border, radius, space, type, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { StatusChip } from './StatusChip';

interface StatusRowProps {
  testID: string;
  title: string;
  /** A sync status: draft, synced, partial or rejected. */
  status: string;
  /** Detail lines under the title, one line each. */
  meta: string[];
  /** What the row is: an interview or a field record. */
  icon?: IconName;
  onPress: () => void;
}

/**
 * One interview or field record in a list, with its sync status. Every tab
 * lists them the same way, so the same thing reads the same wherever it
 * appears. Large on purpose: rows are opened one-handed, in the field.
 */
export function StatusRow({
  testID,
  title,
  status,
  meta,
  icon = 'interview',
  onPress,
}: StatusRowProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
        <Icon name={icon} color={theme.primaryText} size={22} />
      </View>
      <View style={styles.main}>
        <Text
          style={[styles.title, { color: theme.text }]}
          numberOfLines={1}
          // The name can be long and is rarely what distinguishes two rows;
          // one line keeps every row the same height.
        >
          {title}
        </Text>

        {meta.map((line) => (
          <Text key={line} style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
            {line}
          </Text>
        ))}

        <View style={styles.status}>
          <StatusChip status={status} />
        </View>
      </View>
      <Icon name="chevronRight" color={theme.muted} size={20} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: border.width,
    borderRadius: radius.card,
    padding: space.md + 2,
    gap: space.md + 2,
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...type.body,
    fontWeight: '800',
  },
  meta: type.caption,
  status: {
    marginTop: space.xs + 2,
  },
});
