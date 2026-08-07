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
import { border, radius, space, type, useTheme } from '../theme';
import { SectionLabel } from '../ui/SectionLabel';

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
      <SectionLabel>{t('project.forms')}</SectionLabel>

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
    padding: space.xl,
  },
  list: {
    gap: space.md,
    paddingBottom: space.xl,
  },
  empty: {
    ...type.body,
    marginTop: space.sm,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    borderWidth: border.width,
    borderRadius: radius.control,
    padding: space.lg,
  },
  formRowText: {
    flexShrink: 1,
    gap: space.xs,
  },
  formName: {
    ...type.body,
    fontWeight: '600',
  },
  formDesc: type.label,
  start: {
    ...type.label,
    fontWeight: '600',
    marginTop: space.xs,
  },
});
