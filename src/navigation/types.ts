import type { NavigatorScreenParams } from '@react-navigation/native';

/** The signed-in tab bar: interviews, field records, and what is still to send. */
export type MainTabParamList = {
  Interviews: undefined;
  Records: undefined;
  Outbox: undefined;
};

/** The app's navigation stack and each screen's params. */
export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Project: { projectId: number; projectName: string };
  /** `instanceId` is set when reopening an existing draft; omitted starts a new one. */
  Interview: { formId: number; projectId: number; formName: string; instanceId?: string };
  /**
   * `clientId` is set when reopening a record; omitted starts a new one. A new
   * one started from an interview answer names it, and the name it gave.
   */
  FieldRecord: {
    projectId: number;
    clientId?: string;
    answerClientId?: string;
    vernacularName?: string;
  };
  /** Attribution for the open-source packages the app ships. */
  Licences: undefined;
  /** What each release of the app brought. */
  WhatsNew: undefined;
};
