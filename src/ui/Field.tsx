import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { space, type, useTheme } from '../theme';

interface Props {
  label: string;
  /** Marks the field as required, as the form declares it. */
  required?: boolean;
  children: ReactNode;
  /** A problem with what was entered, or with what the server made of it. */
  error?: string;
  errorTestID?: string;
  /** An action offered alongside the error, e.g. discarding a refused answer. */
  action?: ReactNode;
}

/**
 * One labelled question: the label, the control, and whatever is currently
 * wrong with it. Keeping this in one place is what stops the label-to-input
 * gap and the error treatment drifting apart between field types.
 */
export function Field({
  label,
  required = false,
  children,
  error,
  errorTestID,
  action,
}: Props) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>
        {label}
        {required ? <Text style={{ color: theme.danger }}> *</Text> : null}
      </Text>

      {children}

      {error ? (
        <View testID={errorTestID} style={styles.error}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          {action}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: space.lg,
    gap: space.sm,
  },
  label: type.label,
  error: {
    gap: space.xs,
  },
  errorText: type.caption,
});
