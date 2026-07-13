/** The app's navigation stack and each screen's params. */
export type RootStackParamList = {
  Home: undefined;
  Drafts: undefined;
  Project: { projectId: number; projectName: string };
  Interview: { formId: number; projectId: number; formName: string };
};
