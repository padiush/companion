import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';

import { FieldRecordScreen } from '../screens/FieldRecordScreen';
import { InterviewScreen } from '../screens/InterviewScreen';
import { LicencesScreen } from '../screens/LicencesScreen';
import { ProjectScreen } from '../screens/ProjectScreen';
import { WhatsNewScreen } from '../screens/WhatsNewScreen';
import { font, useTheme } from '../theme';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * The signed-in navigation: a bottom-tab home (interviews, field records, and
 * what is still to send), over which a project's forms, an interview and a
 * field record are pushed as full screens.
 */
export function RootNavigator() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
          // The pushed screens carry the tabs' green header down with them.
          headerStyle: { backgroundColor: theme.primary },
          headerTintColor: theme.onPrimary,
          headerTitleStyle: { fontFamily: font.family, fontWeight: '800' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="Project"
          component={ProjectScreen}
          options={({ route }) => ({ title: route.params.projectName })}
        />
        <Stack.Screen
          name="Interview"
          component={InterviewScreen}
          options={({ route }) => ({ title: route.params.formName })}
        />
        <Stack.Screen
          name="FieldRecord"
          component={FieldRecordScreen}
          options={({ route }) => ({
            title: t(route.params.clientId ? 'fieldRecord.title' : 'fieldRecord.newTitle'),
          })}
        />
        <Stack.Screen
          name="Licences"
          component={LicencesScreen}
          options={{ title: t('licences.title') }}
        />
        <Stack.Screen
          name="WhatsNew"
          component={WhatsNewScreen}
          options={{ title: t('whatsNew.screenTitle') }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
