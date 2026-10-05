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
import { Icon, type IconName } from './Icon';

/**
 * `solid` is the one action a screen is about; `ghost` is a secondary action
 * that still needs to look like a control; `text` is an inline action inside
 * other content. `destructive` is a text action that removes something.
 * `inverse` is the solid action when it sits on the green header or a green
 * card, where a green button would disappear.
 *
 * The web's rule carries over unchanged because it is not a web rule: one
 * solid action per screen, so what to press is never ambiguous.
 */
export type ButtonVariant = 'solid' | 'ghost' | 'text' | 'destructive' | 'inverse';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Drawn before the label, to make the action recognisable at a glance. */
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'solid',
  icon,
  disabled = false,
  busy = false,
  testID,
  style,
}: Props) {
  const theme = useTheme();

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    solid: { bg: theme.primary, fg: theme.onPrimary },
    ghost: { bg: theme.card, fg: theme.primaryText, border: theme.chipBorder },
    text: { bg: 'transparent', fg: theme.primaryText },
    destructive: { bg: 'transparent', fg: theme.danger },
    inverse: { bg: theme.card, fg: theme.primaryText },
  };

  const { bg, fg, border: edge } = palette[variant];
  const framed = variant === 'solid' || variant === 'ghost' || variant === 'inverse';

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
        <View style={styles.content}>
          {icon ? <Icon name={icon} color={fg} size={20} strokeWidth={2.4} /> : null}
          <Text style={[framed ? styles.label : styles.inlineLabel, { color: fg }]}>{label}</Text>
        </View>
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
    minHeight: touch.min + 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: {
    minHeight: touch.min,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  label: {
    ...type.body,
    fontWeight: '800',
  },
  inlineLabel: {
    ...type.body,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
  },
});
