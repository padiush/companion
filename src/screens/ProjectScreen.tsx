import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Chevron } from '../components/Chevron';
import { useForms } from '../hooks/useForms';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Project'>;

/** A project's active forms; each starts a new interview. */
export function ProjectScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Project'>>();
  const navigation = useNavigation<Nav>();
  const { forms, loading } = useForms(params.projectId);

  const activeForms = forms.filter((form) => form.isActive);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>{t('project.forms')}</Text>

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : activeForms.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{t('project.empty')}</Text>
        ) : (
          activeForms.map((form) => (
            <TouchableOpacity
              key={form.id}
              testID={`form-${form.id}`}
              style={[styles.formRow, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() =>
                navigation.navigate('Interview', {
                  formId: form.id,
                  projectId: params.projectId,
                  formName: form.name,
                })
              }
              accessibilityRole="button"
            >
              <View style={styles.formRowText}>
                <Text style={[styles.formName, { color: theme.text }]}>{form.name}</Text>
                {form.description ? (
                  <Text style={[styles.formDesc, { color: theme.muted }]}>{form.description}</Text>
                ) : null}
                <Text style={[styles.start, { color: theme.primary }]}>
                  {t('project.newInterview')}
                </Text>
              </View>
              <Chevron color={theme.muted} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  empty: {
    fontSize: 15,
    marginTop: 8,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  formRowText: {
    flexShrink: 1,
    gap: 6,
  },
  formName: {
    fontSize: 17,
    fontWeight: '600',
  },
  formDesc: {
    fontSize: 14,
  },
  start: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
});
