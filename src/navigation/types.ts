import type { NavigatorScreenParams } from '@react-navigation/native';

/** The signed-in tab bar: starting interviews vs. reviewing/sending them. */
export type MainTabParamList = {
  Projects: undefined;
  Drafts: undefined;
};

/** The app's navigation stack and each screen's params. */
export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Project: { projectId: number; projectName: string };
  Interview: { formId: number; projectId: number; formName: string };
};
