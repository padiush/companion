import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { border, radius, space, type, useTheme } from '../theme';

interface Props {
  /** Small uppercase label above the title — the web Card's kicker slot. */
  kicker?: string;
  title?: string;
  description?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The app-wide panel: a bordered surface on the tinted page, matching what the
 * web made its universal content unit, with the same kicker / title /
 * description slots.
 *
 * Flat by design. The web theme runs at `--depth: 0`, and RN shadows diverge
 * between iOS and Android and cost render time down a list, so separation comes
 * from the border rather than elevation.
 */
export function Card({ kicker, title, description, children, style }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}
    >
      {kicker ? <Text style={[styles.kicker, { color: theme.muted }]}>{kicker}</Text> : null}
      {title ? <Text style={[styles.title, { color: theme.text }]}>{title}</Text> : null}
      {description ? (
        <Text style={[styles.description, { color: theme.muted }]}>{description}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: border.width,
    borderRadius: radius.control,
    padding: space.lg,
    gap: space.sm,
  },
  kicker: type.kicker,
  title: type.heading,
  description: type.caption,
});
