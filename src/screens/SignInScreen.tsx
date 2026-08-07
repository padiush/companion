import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError } from '../api/client';
import { SignInCancelled } from '../auth/accountStore';
import { useAuth, type ConfirmReplace } from '../auth/AuthContext';
import { AppLogo } from '../components/AppLogo';
import type { PendingWork } from '../db/ownership';
import { border, radius, space, type, useTheme } from '../theme';
import { Button } from '../ui/Button';

export function SignInScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * This device already holds another account's unsent work, and signing in
   * destroys it. There is no way to send it first — that needs the other
   * account's session — so the only honest choice is to say exactly what will
   * be lost and let them cancel.
   */
  const confirmReplace: ConfirmReplace = (pending: PendingWork) =>
    new Promise((resolve) => {
      Alert.alert(
        t('auth.replaceStoreTitle'),
        t(pending.interviews > 0 ? 'auth.replaceStoreInterviews' : 'auth.replaceStoreMedia', {
          count: pending.interviews > 0 ? pending.interviews : pending.media,
        }),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
          {
            text: t('auth.replaceStoreConfirm'),
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
        { onDismiss: () => resolve(false) }
      );
    });

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError(t('auth.errors.missingFields'));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password, confirmReplace);
    } catch (e) {
      if (e instanceof SignInCancelled) {
        // They chose to keep the other account's work; not an error.
        return;
      }

      setError(
        e instanceof ApiError && e.status === 422
          ? t('auth.errors.invalidCredentials')
          : t('auth.errors.generic')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <AppLogo size={64} color={theme.primary} style={styles.logo} />
        <Text style={[styles.brand, { color: theme.text }]}>{t('app.name')}</Text>
        <Text style={[styles.tagline, { color: theme.muted }]}>{t('app.tagline')}</Text>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.muted }]}>{t('auth.emailLabel')}</Text>
        <TextInput
          testID="email"
          style={inputStyle}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          editable={!submitting}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.muted }]}>{t('auth.passwordLabel')}</Text>
        <TextInput
          testID="password"
          style={inputStyle}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          placeholderTextColor={theme.muted}
          secureTextEntry
          textContentType="password"
          editable={!submitting}
        />
      </View>

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

      <Button
        testID="submit"
        label={t('auth.submit')}
        onPress={onSubmit}
        busy={submitting}
        style={styles.submit}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: space.xl,
  },
  header: {
    marginBottom: space.xxl,
  },
  logo: {
    marginBottom: space.lg,
  },
  brand: type.title,
  tagline: {
    ...type.body,
    marginTop: space.xs,
  },
  field: {
    marginBottom: space.lg,
  },
  label: {
    ...type.caption,
    marginBottom: space.xs,
  },
  input: {
    borderWidth: border.width,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    ...type.body,
  },
  error: {
    ...type.label,
    marginBottom: space.md,
  },
  submit: {
    marginTop: space.sm,
  },
});
