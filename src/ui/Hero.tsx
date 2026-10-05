import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, type, useTheme } from '../theme';

interface Props {
  title: string;
  /** A line under the title: who is signed in, how fresh the data is. */
  subtitle?: ReactNode;
  /** Controls along the top: a project chip on the left, actions on the right. */
  start?: ReactNode;
  end?: ReactNode;
  /** Action tiles that overlap the header's lower edge. */
  tiles?: ReactNode;
  titleTestID?: string;
}

/**
 * The green header the tabs open on. It carries the screen's name and the
 * state that matters before anything else — signed in as whom, synced when —
 * in the brand colour, so the app reads as the web's even at a glance.
 */
export function Hero({ title, subtitle, start, end, tiles, titleTestID }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: theme.primary,
            paddingTop: insets.top + space.md,
            paddingBottom: tiles ? 64 : space.xl,
          },
        ]}
      >
        {start || end ? (
          <View style={styles.top}>
            <View style={styles.start}>{start}</View>
            {end}
          </View>
        ) : null}
        <Text testID={titleTestID} style={[styles.title, { color: theme.onPrimary }]}>
          {title}
        </Text>
        {typeof subtitle === 'string' ? (
          <Text style={[styles.subtitle, { color: theme.heroMuted }]}>{subtitle}</Text>
        ) : (
          subtitle
        )}
      </View>
      {tiles ? <View style={styles.tiles}>{tiles}</View> : null}
    </View>
  );
}

/** A line of header text in the header's secondary colour. */
export function HeroLine({ children, testID }: { children: ReactNode; testID?: string }) {
  const theme = useTheme();

  return (
    <View testID={testID} style={styles.line}>
      {typeof children === 'string' ? (
        <Text style={[styles.subtitle, { color: theme.heroMuted }]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: space.lg + 4,
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
    gap: space.xs + 2,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginBottom: space.md,
  },
  start: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...type.title,
    lineHeight: 34,
  },
  subtitle: {
    ...type.label,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
  },
  tiles: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    marginTop: -48,
  },
});
