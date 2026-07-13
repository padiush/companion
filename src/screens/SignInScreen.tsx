import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AppLogo } from '../components/AppLogo';
import { useTheme } from '../theme';

export function SignInScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError(t('auth.errors.missingFields'));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
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

      <TouchableOpacity
        testID="submit"
        style={[styles.button, { backgroundColor: theme.primary, opacity: submitting ? 0.7 : 1 }]}
        onPress={onSubmit}
        disabled={submitting}
        accessibilityRole="button"
      >
        {submitting ? (
          <ActivityIndicator color={theme.onPrimary} />
        ) : (
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{t('auth.submit')}</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  logo: {
    marginBottom: 16,
  },
  brand: {
    fontSize: 26,
    fontWeight: '700',
  },
  tagline: {
    fontSize: 15,
    marginTop: 6,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
