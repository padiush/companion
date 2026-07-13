import { fireEvent, render, waitFor } from '@testing-library/react-native';

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

function mockOutbox(overrides: Record<string, unknown> = {}) {
  mockUseOutbox.mockReturnValue({
    count: 0,
    sending: false,
    error: false,
    lastResult: null,
    send: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth();
  mockProjects();
  mockOutbox();
});

describe('HomeScreen', () => {
  it('greets the signed-in user and signs out on tap', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockAuth(signOut);

    const { getByTestId, getByText } = await render(<HomeScreen />);
    expect(getByText('home.greeting:Field')).toBeTruthy();

    await fireEvent.press(getByTestId('sign-out'));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
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

  it('shows the outbox and sends drafts', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    mockOutbox({ count: 3, send });

    const { getByTestId, getByText } = await render(<HomeScreen />);
    expect(getByText('home.outbox')).toBeTruthy();

    await fireEvent.press(getByTestId('send-drafts'));
    expect(send).toHaveBeenCalled();
  });

  it('hides the outbox when there is nothing to send', async () => {
    mockOutbox({ count: 0 });

    const { queryByTestId } = await render(<HomeScreen />);
    expect(queryByTestId('send-drafts')).toBeNull();
  });

  it('surfaces a send error', async () => {
    mockOutbox({ count: 1, error: true });

    const { getByText } = await render(<HomeScreen />);
    expect(getByText('home.sendError')).toBeTruthy();
  });
});
