import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { border, radius, space, touch, type, useTheme } from '../theme';

/**
 * `solid` is the one action a screen is about; `ghost` is a secondary action
 * that still needs to look like a control; `text` is an inline action inside
 * other content. `destructive` is a text action that removes something.
 *
 * The web's rule carries over unchanged because it is not a web rule: one
 * solid action per screen, so what to press is never ambiguous.
 */
export type ButtonVariant = 'solid' | 'ghost' | 'text' | 'destructive';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'solid',
  disabled = false,
  busy = false,
  testID,
  style,
}: Props) {
  const theme = useTheme();

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    solid: { bg: theme.primary, fg: theme.onPrimary },
    ghost: { bg: 'transparent', fg: theme.primary, border: theme.border },
    text: { bg: 'transparent', fg: theme.primary },
    destructive: { bg: 'transparent', fg: theme.danger },
  };

  const { bg, fg, border: edge } = palette[variant];
  const framed = variant === 'solid' || variant === 'ghost';

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      style={[
        framed ? styles.framed : styles.inline,
        framed && { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        edge ? { borderWidth: border.width, borderColor: edge } : null,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

/** A row of actions where only the first should carry weight. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  framed: {
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    // Comfortably past the 44pt minimum: these are pressed one-handed, often
    // standing up, sometimes in the rain.
    minHeight: touch.min + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: {
    minHeight: touch.min,
    justifyContent: 'center',
  },
  label: {
    ...type.body,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
  },
});
