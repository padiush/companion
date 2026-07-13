import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../auth/AuthContext';
import { HomeScreen } from './HomeScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key),
  }),
}));
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

describe('HomeScreen', () => {
  it('greets the signed-in user and signs out on tap', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      status: 'signedIn',
      user: { id: 1, name: 'Field', email: 'field@example.org' },
      signIn: jest.fn(),
      signOut,
    });

    const { getByTestId, getByText } = await render(<HomeScreen />);
    expect(getByText('home.greeting:Field')).toBeTruthy();

    await fireEvent.press(getByTestId('sign-out'));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });
});
