import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { radius, space, type, useTheme, type Theme } from '../theme';
import { Icon, type IconName } from './Icon';

/** A capture's sync status: draft, synced, partial or rejected. */
export type SyncStatus = 'draft' | 'synced' | 'partial' | 'rejected';

/**
 * How each status looks: sent is done, a draft is waiting to go, and what the
 * server refused needs the researcher. Told apart by icon and wording as well
 * as colour.
 */
function toneOf(status: string, theme: Theme): { fg: string; bg: string; icon: IconName } {
  switch (status) {
    case 'synced':
      return { fg: theme.success, bg: theme.successSoft, icon: 'check' };
    case 'partial':
    case 'rejected':
      return { fg: theme.danger, bg: theme.dangerSoft, icon: 'alert' };
    default:
      return { fg: theme.warn, bg: theme.warnSoft, icon: 'waiting' };
  }
}

export function StatusChip({ status, testID }: { status: string; testID?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const tone = toneOf(status, theme);

  return (
    <View testID={testID} style={[styles.chip, { backgroundColor: tone.bg }]}>
      <Icon name={tone.icon} color={tone.fg} size={13} strokeWidth={2.6} />
      <Text style={[styles.label, { color: tone.fg }]}>
        {t(`drafts.status.${status}`, { defaultValue: status })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  label: {
    ...type.caption,
    fontSize: 12,
    fontWeight: '700',
  },
});
