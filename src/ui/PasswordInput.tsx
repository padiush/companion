import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, type TextInput } from 'react-native';

import { radius, touch, useTheme } from '../theme';
import { Icon } from './Icon';
import { Input } from './Input';

type Props = Omit<
  ComponentProps<typeof Input>,
  'secureTextEntry' | 'end' | 'autoCapitalize' | 'autoCorrect' | 'spellCheck' | 'keyboardType'
>;

/**
 * A password box with an eye at its end that shows what was typed, to check
 * it before signing in, and hides it again. It starts hidden, every time the
 * field is shown, since it is often typed with someone else nearby. The eye's
 * test id is the field's, with `-visibility` after it.
 *
 * Shown, it is still a password to the keyboard: nothing is corrected or
 * capitalised, and on Android it is a visible-password field, which keyboards
 * neither suggest from nor learn.
 */
export const PasswordInput = forwardRef<TextInput, Props>(function PasswordInput(
  { editable = true, testID, ...rest },
  ref
) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const input = useRef<TextInput>(null);
  const refocus = useRef(false);
  useImperativeHandle(ref, () => input.current as TextInput);

  // Each state is its own field (see `key` below), so the one that replaces
  // a focused field takes the focus over.
  useEffect(() => {
    if (!refocus.current) {
      return;
    }
    refocus.current = false;
    input.current?.focus();
  }, [visible]);

  const toggle = () => {
    refocus.current = Boolean(input.current?.isFocused());
    setVisible((shown) => !shown);
  };

  // On Android, switching `secureTextEntry` off on a live field clears the
  // flags `keyboardType="visible-password"` sets, depending on the order the
  // two are applied, and the field then becomes plain text the keyboard
  // suggests from and learns. A new field created shown never receives
  // `secureTextEntry`, so it is only ever a visible password.
  const mode = visible
    ? { keyboardType: Platform.OS === 'android' ? ('visible-password' as const) : undefined }
    : { secureTextEntry: true };

  return (
    <Input
      key={visible ? 'shown' : 'hidden'}
      ref={input}
      testID={testID}
      editable={editable}
      {...mode}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      {...rest}
      end={
        <Pressable
          testID={testID ? `${testID}-visibility` : undefined}
          onPress={toggle}
          disabled={!editable}
          accessibilityRole="button"
          accessibilityLabel={t(visible ? 'auth.hidePassword' : 'auth.showPassword')}
          hitSlop={4}
          style={({ pressed }) => [
            styles.toggle,
            pressed ? { backgroundColor: theme.primarySoft } : null,
          ]}
        >
          <Icon name={visible ? 'hide' : 'show'} color={theme.primaryText} size={22} />
        </Pressable>
      }
    />
  );
});

const styles = StyleSheet.create({
  toggle: {
    width: touch.min,
    height: touch.min,
    // Sits in the box's end padding, so the eye lines up with the icon at
    // the other end rather than floating inside the box.
    marginRight: -10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
