import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../auth/AuthContext';
import { useProjects } from '../hooks/useProjects';
import { HomeScreen } from './HomeScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key),
  }),
}));
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../hooks/useProjects', () => ({ useProjects: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockUseProjects = useProjects as jest.Mock;

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

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth();
  mockProjects();
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
