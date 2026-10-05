import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { useDrafts } from '../hooks/useDrafts';
import { useOutbox } from '../hooks/useOutbox';
import { useProjects } from '../hooks/useProjects';
import { InterviewsScreen } from './InterviewsScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key),
    i18n: { language: 'es' },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../hooks/useProjects', () => ({ useProjects: jest.fn() }));
jest.mock('../hooks/useOutbox', () => ({ useOutbox: jest.fn() }));
jest.mock('../hooks/useDrafts', () => ({ useDrafts: jest.fn() }));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseProjects = useProjects as jest.Mock;
const mockUseOutbox = useOutbox as jest.Mock;
const mockUseDrafts = useDrafts as jest.Mock;

function interview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    form_id: 27,
    project_id: 9,
    form_name: 'Plant uses',
    captured_at: '2026-07-13T10:00:00Z',
    created_at: '2026-07-13T09:00:00Z',
    sync_status: 'synced',
    answer_count: 3,
    media_count: 0,
    audio_count: 0,
    preview: 'Ruda',
    ...overrides,
  };
}

function mockInterviews(drafts: unknown[] = []) {
  mockUseDrafts.mockReturnValue({ drafts, fieldRecords: [], loading: false, refresh: jest.fn() });
}

type AlertButton = { text?: string; style?: string; onPress?: () => void };

function pressAlertButton(style: 'cancel' | 'destructive') {
  const spy = Alert.alert as jest.Mock;
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[] | undefined;
  buttons?.find((button) => button.style === style)?.onPress?.();
}

function mockAuth(signOut = jest.fn(), offline = false) {
  mockUseAuth.mockReturnValue({
    status: 'signedIn',
    user: { id: 1, name: 'Field', email: 'field@example.org' },
    offline,
    signIn: jest.fn(),
    signOut,
  });
}

function mockProjects(overrides: Record<string, unknown> = {}) {
  mockUseProjects.mockReturnValue({
    projects: [],
    loading: false,
    syncing: false,
    error: false,
    sync: jest.fn(),
    ...overrides,
  });
}

function mockOutbox(count = 0, fieldRecords = 0) {
  mockUseOutbox.mockReturnValue({
    count,
    fieldRecords,
    sending: false,
    error: false,
    lastResult: null,
    send: jest.fn(),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth();
  mockProjects();
  mockOutbox();
  mockInterviews();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('InterviewsScreen', () => {
  it('says nothing about connectivity when the session was verified online', async () => {
    const { queryByTestId } = await render(<InterviewsScreen />);

    expect(queryByTestId('offline-notice')).toBeNull();
  });

  it('tells the user when they opened on a cached session', async () => {
    mockAuth(jest.fn(), true);

    const { getByTestId } = await render(<InterviewsScreen />);

    expect(getByTestId('offline-notice')).toBeTruthy();
  });

  it('greets the signed-in user and signs out after confirming', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockAuth(signOut);

    const { getByTestId, getByText } = await render(<InterviewsScreen />);
    expect(getByText('home.greeting:Field')).toBeTruthy();

    await fireEvent.press(getByTestId('sign-out'));
    // Confirmation first; sign-out only on confirm.
    expect(Alert.alert).toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();

    pressAlertButton('destructive');
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it('warns about unsynced interviews when signing out with a full outbox', async () => {
    mockOutbox(3);

    const { getByTestId } = await render(<InterviewsScreen />);
    await fireEvent.press(getByTestId('sign-out'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'home.signOutTitle',
      'home.signOutUnsynced',
      expect.any(Array)
    );
  });

  /** Records stay on the device until sent just as interviews do. */
  it('counts unsent field records in the sign-out warning', async () => {
    mockOutbox(0, 2);

    const { getByTestId } = await render(<InterviewsScreen />);
    await fireEvent.press(getByTestId('sign-out'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'home.signOutTitle',
      'home.signOutUnsynced',
      expect.any(Array)
    );
  });

  /** Sent or not, an interview recorded here can be reopened from here. */
  it('lists every interview on the device with its status, and reopens one', async () => {
    mockInterviews([interview(), interview({ id: 'i2', preview: 'Sábila', sync_status: 'draft' })]);

    const { getByTestId } = await render(<InterviewsScreen />);

    expect(getByTestId('interview-i1')).toHaveTextContent(/Ruda/);
    expect(getByTestId('interview-i1')).toHaveTextContent(/drafts\.status\.synced/);
    expect(getByTestId('interview-i2')).toHaveTextContent(/drafts\.status\.draft/);

    await fireEvent.press(getByTestId('interview-i1'));

    expect(mockNavigate).toHaveBeenCalledWith('Interview', {
      formId: 27,
      projectId: 9,
      formName: 'Plant uses',
      instanceId: 'i1',
    });
  });

  it('says when no interview has been recorded yet', async () => {
    const { getByText } = await render(<InterviewsScreen />);

    expect(getByText('drafts.empty')).toBeTruthy();
  });

  it('does not warn about unsynced interviews when the outbox is empty', async () => {
    mockOutbox(0);

    const { getByTestId } = await render(<InterviewsScreen />);
    await fireEvent.press(getByTestId('sign-out'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'home.signOutTitle',
      'home.signOutMessage',
      expect.any(Array)
    );
  });

  it('lists the cached projects', async () => {
    mockProjects({
      projects: [
        { id: 1, name: 'Cloud forest' },
        { id: 2, name: 'Dry forest' },
      ],
    });

    const { getByText, getByTestId } = await render(<InterviewsScreen />);
    expect(getByText('Cloud forest')).toBeTruthy();
    expect(getByTestId('project-2')).toBeTruthy();
  });

  it('opens a project when tapped', async () => {
    mockProjects({ projects: [{ id: 5, name: 'Cloud forest' }] });

    const { getByTestId } = await render(<InterviewsScreen />);
    await fireEvent.press(getByTestId('project-5'));

    expect(mockNavigate).toHaveBeenCalledWith('Project', {
      projectId: 5,
      projectName: 'Cloud forest',
    });
  });

  it('shows the empty state when there are no projects', async () => {
    mockProjects({ projects: [] });

    const { getByText } = await render(<InterviewsScreen />);
    expect(getByText('home.empty')).toBeTruthy();
  });

  it('triggers a sync when the sync button is pressed', async () => {
    const sync = jest.fn().mockResolvedValue(true);
    mockProjects({ sync });

    const { getByTestId } = await render(<InterviewsScreen />);
    await fireEvent.press(getByTestId('sync'));

    expect(sync).toHaveBeenCalled();
  });

  it('confirms a successful sync', async () => {
    mockProjects({ sync: jest.fn().mockResolvedValue(true) });

    const { getByTestId, findByText } = await render(<InterviewsScreen />);
    await fireEvent.press(getByTestId('sync'));

    expect(await findByText('home.synced')).toBeTruthy();
  });

  it('syncs on pull-to-refresh', async () => {
    const sync = jest.fn().mockResolvedValue(true);
    mockProjects({ sync });

    const { getByTestId } = await render(<InterviewsScreen />);
    getByTestId('projects-scroll').props.refreshControl.props.onRefresh();

    expect(sync).toHaveBeenCalled();
  });

  it('surfaces a sync error', async () => {
    mockProjects({ error: true });

    const { getByText } = await render(<InterviewsScreen />);
    expect(getByText('home.syncError')).toBeTruthy();
  });
});
