import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { border, radius, space, type, useTheme } from '../theme';

interface Props {
  /** Small label above the title — the web Card's kicker slot. */
  kicker?: string;
  title?: string;
  description?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The app-wide panel: a rounded, bordered surface on the tinted page, with the
 * same kicker / title / description slots as the web's Card.
 *
 * Separated by its border rather than a shadow: shadows are kept for what
 * floats over the page (the header's action tiles, the tab bar), and RN
 * elevation costs render time down a list.
 */
export function Card({ kicker, title, description, children, style }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
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
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
  },
  kicker: type.kicker,
  title: type.heading,
  description: type.caption,
});
