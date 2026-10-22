import { fireEvent, render } from '@testing-library/react-native';
import { createRef } from 'react';
import { Platform, type TextInput } from 'react-native';

import { PasswordInput } from './PasswordInput';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** Runs `body` as if on Android. */
async function onAndroid(body: () => Promise<void>) {
  const os = Platform.OS;
  Platform.OS = 'android';
  try {
    await body();
  } finally {
    Platform.OS = os;
  }
}

describe('PasswordInput', () => {
  it('starts hidden', async () => {
    const { getByTestId } = await render(<PasswordInput testID="password" value="secret" />);

    expect(getByTestId('password').props.secureTextEntry).toBe(true);
    expect(getByTestId('password-visibility').props.accessibilityLabel).toBe('auth.showPassword');
  });

  it('shows what was typed, and hides it again', async () => {
    const { getByTestId } = await render(<PasswordInput testID="password" value="secret" />);

    await fireEvent.press(getByTestId('password-visibility'));
    expect(getByTestId('password').props.secureTextEntry).toBeFalsy();
    expect(getByTestId('password-visibility').props.accessibilityLabel).toBe('auth.hidePassword');

    await fireEvent.press(getByTestId('password-visibility'));
    expect(getByTestId('password').props.secureTextEntry).toBe(true);
    expect(getByTestId('password-visibility').props.accessibilityLabel).toBe('auth.showPassword');
  });

  it('keeps the value as it is either way', async () => {
    const onChangeText = jest.fn();
    const { getByTestId } = await render(
      <PasswordInput testID="password" value="secret" onChangeText={onChangeText} />
    );

    await fireEvent.press(getByTestId('password-visibility'));
    await fireEvent.changeText(getByTestId('password'), 'secret2');

    expect(getByTestId('password').props.value).toBe('secret');
    expect(onChangeText).toHaveBeenCalledWith('secret2');
  });

  it('is never corrected or capitalised, shown or hidden', async () => {
    const { getByTestId } = await render(<PasswordInput testID="password" value="secret" />);

    for (const shown of [false, true]) {
      expect(getByTestId('password').props).toMatchObject({
        autoCorrect: false,
        spellCheck: false,
        autoCapitalize: 'none',
      });
      if (!shown) {
        await fireEvent.press(getByTestId('password-visibility'));
      }
    }
  });

  /**
   * On Android, turning `secureTextEntry` off on a live field clears what
   * `visible-password` sets, and the keyboard then suggests from and learns
   * the password. A shown password is a field of its own that is never given
   * `secureTextEntry` at all.
   */
  it('shows a password on Android as a visible-password field, never a text one', async () => {
    await onAndroid(async () => {
      const ref = createRef<TextInput>();
      const { getByTestId } = await render(
        <PasswordInput ref={ref} testID="password" value="secret" />
      );
      const hidden = ref.current;
      expect(getByTestId('password').props.keyboardType).toBeUndefined();

      await fireEvent.press(getByTestId('password-visibility'));

      expect(ref.current).not.toBe(hidden);
      expect(getByTestId('password').props.keyboardType).toBe('visible-password');
      expect('secureTextEntry' in getByTestId('password').props).toBe(false);
    });
  });

  it('keeps the keyboard on the field when it is shown or hidden while typing', async () => {
    const ref = createRef<TextInput>();
    const { getByTestId } = await render(
      <PasswordInput ref={ref} testID="password" value="secret" />
    );
    (ref.current as TextInput).isFocused = () => true;

    await fireEvent.press(getByTestId('password-visibility'));

    expect((ref.current as TextInput).focus).toHaveBeenCalled();
  });

  it('leaves the focus alone when the field was not being typed in', async () => {
    const ref = createRef<TextInput>();
    const { getByTestId } = await render(
      <PasswordInput ref={ref} testID="password" value="secret" />
    );
    (ref.current as TextInput).isFocused = () => false;
    jest.mocked((ref.current as TextInput).focus).mockClear();

    await fireEvent.press(getByTestId('password-visibility'));

    expect((ref.current as TextInput).focus).not.toHaveBeenCalled();
  });

  it('cannot be toggled while the field is locked', async () => {
    const { getByTestId } = await render(
      <PasswordInput testID="password" value="secret" editable={false} />
    );

    await fireEvent.press(getByTestId('password-visibility'));

    expect(getByTestId('password').props.secureTextEntry).toBe(true);
  });
});
