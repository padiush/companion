import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { SignInScreen } from './SignInScreen';

// Translate to the key itself so assertions don't depend on wording.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

function mockAuth(overrides: Record<string, unknown> = {}) {
  mockUseAuth.mockReturnValue({
    status: 'signedOut',
    user: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    ...overrides,
  });
}

describe('SignInScreen', () => {
  it('submits the entered credentials (trimmed email)', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    mockAuth({ signIn });

    const { getByTestId } = await render(<SignInScreen />);
    await fireEvent.changeText(getByTestId('email'), '  field@example.org ');
    await fireEvent.changeText(getByTestId('password'), 'password');
    await fireEvent.press(getByTestId('submit'));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('field@example.org', 'password'));
  });

  it('requires both fields before calling signIn', async () => {
    const signIn = jest.fn();
    mockAuth({ signIn });

    const { getByTestId, getByText } = await render(<SignInScreen />);
    await fireEvent.press(getByTestId('submit'));

    expect(signIn).not.toHaveBeenCalled();
    expect(getByText('auth.errors.missingFields')).toBeTruthy();
  });

  it('shows a friendly error when the credentials are rejected', async () => {
    const signIn = jest
      .fn()
      .mockRejectedValue(new ApiError(422, { message: 'x', message_type: 'error' }));
    mockAuth({ signIn });

    const { getByTestId, findByText } = await render(<SignInScreen />);
    await fireEvent.changeText(getByTestId('email'), 'field@example.org');
    await fireEvent.changeText(getByTestId('password'), 'wrong');
    await fireEvent.press(getByTestId('submit'));

    expect(await findByText('auth.errors.invalidCredentials')).toBeTruthy();
  });
});
