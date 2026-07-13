import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { useOutbox } from '../hooks/useOutbox';
import { useProjects } from '../hooks/useProjects';
import { HomeScreen } from './HomeScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key),
  }),
}));
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../hooks/useProjects', () => ({ useProjects: jest.fn() }));
jest.mock('../hooks/useOutbox', () => ({ useOutbox: jest.fn() }));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseProjects = useProjects as jest.Mock;
const mockUseOutbox = useOutbox as jest.Mock;

type AlertButton = { text?: string; style?: string; onPress?: () => void };

function pressAlertButton(style: 'cancel' | 'destructive') {
  const spy = Alert.alert as jest.Mock;
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[] | undefined;
  buttons?.find((button) => button.style === style)?.onPress?.();
}

function mockAuth(signOut = jest.fn()) {
  mockUseAuth.mockReturnValue({
    status: 'signedIn',
    user: { id: 1, name: 'Field', email: 'field@example.org' },
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

function mockOutbox(count = 0) {
  mockUseOutbox.mockReturnValue({
    count,
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
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('HomeScreen', () => {
  it('greets the signed-in user and signs out after confirming', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockAuth(signOut);

    const { getByTestId, getByText } = await render(<HomeScreen />);
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

    const { getByTestId } = await render(<HomeScreen />);
    await fireEvent.press(getByTestId('sign-out'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'home.signOutTitle',
      'home.signOutUnsynced',
      expect.any(Array)
    );
  });

  it('does not warn about unsynced interviews when the outbox is empty', async () => {
    mockOutbox(0);

    const { getByTestId } = await render(<HomeScreen />);
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

    const { getByText, getByTestId } = await render(<HomeScreen />);
    expect(getByText('Cloud forest')).toBeTruthy();
    expect(getByTestId('project-2')).toBeTruthy();
  });

  it('opens a project when tapped', async () => {
    mockProjects({ projects: [{ id: 5, name: 'Cloud forest' }] });

    const { getByTestId } = await render(<HomeScreen />);
    await fireEvent.press(getByTestId('project-5'));

    expect(mockNavigate).toHaveBeenCalledWith('Project', {
      projectId: 5,
      projectName: 'Cloud forest',
    });
  });

  it('shows the empty state when there are no projects', async () => {
    mockProjects({ projects: [] });

    const { getByText } = await render(<HomeScreen />);
    expect(getByText('home.empty')).toBeTruthy();
  });

  it('triggers a sync when the sync button is pressed', async () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    mockProjects({ sync });

    const { getByTestId } = await render(<HomeScreen />);
    await fireEvent.press(getByTestId('sync'));

    expect(sync).toHaveBeenCalled();
  });

  it('surfaces a sync error', async () => {
    mockProjects({ error: true });

    const { getByText } = await render(<HomeScreen />);
    expect(getByText('home.syncError')).toBeTruthy();
  });
});
