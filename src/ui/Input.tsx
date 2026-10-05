import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { border, font, radius, space, touch, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

interface Props extends Omit<TextInputProps, 'style'> {
  /** Drawn inside the box, before the text: what kind of value this is. */
  icon?: IconName;
}

/**
 * The one text box every screen uses: tall enough to hit with a thumb, with
 * an optional icon, in the app's type. `testID` goes to the text input itself,
 * where tests type into it.
 */
export const Input = forwardRef<TextInput, Props>(function Input(
  { icon, multiline, editable = true, ...rest },
  ref
) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.box,
        multiline ? styles.multilineBox : null,
        {
          borderColor: theme.chipBorder,
          backgroundColor: theme.inputBg,
          opacity: editable ? 1 : 0.7,
        },
      ]}
    >
      {icon ? (
        <View style={multiline ? styles.iconTop : null}>
          <Icon name={icon} color={theme.primaryText} size={20} />
        </View>
      ) : null}
      <TextInput
        ref={ref}
        multiline={multiline}
        editable={editable}
        placeholderTextColor={theme.muted}
        style={[styles.input, multiline ? styles.multiline : null, { color: theme.text }]}
        {...rest}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch.min + 12,
    paddingHorizontal: space.lg,
    borderWidth: border.width + 0.5,
    borderRadius: radius.control,
  },
  multilineBox: {
    alignItems: 'flex-start',
    paddingVertical: space.md,
  },
  iconTop: {
    paddingTop: 2,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.family,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: space.sm,
  },
  multiline: {
    minHeight: 96,
    paddingVertical: 0,
    textAlignVertical: 'top',
  },
});
