import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radius, space, type, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

export type BannerTone = 'info' | 'warn' | 'danger' | 'success';

interface Props {
  tone: BannerTone;
  icon: IconName;
  title?: string;
  children?: ReactNode;
  testID?: string;
}

/**
 * Something the screen needs to say before anything else on it: the device is
 * offline, a record was sent and is now read-only, the server refused it.
 */
export function Banner({ tone, icon, title, children, testID }: Props) {
  const theme = useTheme();
  const colors = {
    info: { fg: theme.info, bg: theme.infoSoft },
    warn: { fg: theme.warn, bg: theme.warnSoft },
    danger: { fg: theme.danger, bg: theme.dangerSoft },
    success: { fg: theme.success, bg: theme.successSoft },
  }[tone];

  return (
    <View testID={testID} style={[styles.banner, { backgroundColor: colors.bg }]}>
      <Icon name={icon} color={colors.fg} size={20} />
      <View style={styles.body}>
        {title ? <Text style={[styles.title, { color: colors.fg }]}>{title}</Text> : null}
        {typeof children === 'string' ? (
          <Text style={[styles.text, { color: title ? theme.text : colors.fg }]}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.md + 2,
    borderRadius: radius.control,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.label,
    fontWeight: '800',
  },
  text: {
    ...type.label,
  },
});
