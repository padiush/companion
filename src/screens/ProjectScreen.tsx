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

/**
 * A project's active forms, each of which starts a new interview. Its field
 * records are in the Registros tab, with every other project's.
 */
export function ProjectScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Project'>>();
  const navigation = useNavigation<Nav>();
  const { forms, loading } = useForms(params.projectId);

  const activeForms = forms.filter((form) => form.isActive);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
    >
      <SectionLabel>{t('project.forms')}</SectionLabel>

      <View style={styles.list}>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : activeForms.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{t('project.empty')}</Text>
        ) : (
          activeForms.map((form) => (
            <TouchableOpacity
              key={form.id}
              testID={`form-${form.id}`}
              style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() =>
                navigation.navigate('Interview', {
                  formId: form.id,
                  projectId: params.projectId,
                  formName: form.name,
                })
              }
              accessibilityRole="button"
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{form.name}</Text>
                {form.description ? (
                  <Text style={[styles.rowDetail, { color: theme.muted }]}>{form.description}</Text>
                ) : null}
                <Text style={[styles.start, { color: theme.primary }]}>
                  {t('project.newInterview')}
                </Text>
              </View>
              <Chevron color={theme.muted} />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: space.xl,
    paddingBottom: space.xxl,
  },
  list: {
    gap: space.md,
  },
  empty: {
    ...type.body,
    marginTop: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    borderWidth: border.width,
    borderRadius: radius.control,
    padding: space.lg,
  },
  rowText: {
    flexShrink: 1,
    gap: space.xs,
  },
  rowTitle: {
    ...type.body,
    fontWeight: '600',
  },
  rowDetail: type.label,
  start: {
    ...type.label,
    fontWeight: '600',
    marginTop: space.xs,
  },
});
