import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../api/client';
import { SignInCancelled } from '../auth/accountStore';
import { useAuth, type ConfirmReplace } from '../auth/AuthContext';
import { AppLogo } from '../components/AppLogo';
import type { PendingWork } from '../db/ownership';
import { radius, space, type, useTheme } from '../theme';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';

export function SignInScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
        // The message names the weightiest kind of work at stake: interviews,
        // then field records, then files. Each is something that happened
        // once in the field and exists nowhere else.
        pending.interviews > 0
          ? t('auth.replaceStoreInterviews', { count: pending.interviews })
          : pending.fieldRecords > 0
            ? t('auth.replaceStoreFieldRecords', { count: pending.fieldRecords })
            : t('auth.replaceStoreMedia', { count: pending.media }),
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.header,
            { backgroundColor: theme.primary, paddingTop: insets.top + space.xxl },
          ]}
        >
          <AppLogo size={64} color={theme.onPrimary} style={styles.logo} />
          <Text style={[styles.brand, { color: theme.onPrimary }]}>{t('app.name')}</Text>
          <Text style={[styles.tagline, { color: theme.heroMuted }]}>{t('app.tagline')}</Text>
        </View>

        <View style={styles.form}>
          <Field label={t('auth.emailLabel')}>
            <Input
              testID="email"
              icon="person"
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              editable={!submitting}
            />
          </Field>

          <Field label={t('auth.passwordLabel')}>
            <Input
              testID="password"
              icon="encrypted"
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.passwordPlaceholder')}
              secureTextEntry
              textContentType="password"
              editable={!submitting}
            />
          </Field>

          {error ? (
            <View style={styles.error}>
              <Banner tone="danger" icon="alert">
                {error}
              </Banner>
            </View>
          ) : null}

          <Button
            testID="submit"
            label={t('auth.submit')}
            onPress={onSubmit}
            busy={submitting}
            style={styles.submit}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
  },
  logo: {
    marginBottom: space.lg,
  },
  brand: {
    ...type.title,
    fontSize: 32,
  },
  tagline: {
    ...type.body,
    fontWeight: '600',
    marginTop: space.xs,
  },
  form: {
    padding: space.xl,
  },
  error: {
    marginBottom: space.lg,
  },
  submit: {
    marginTop: space.sm,
  },
});
