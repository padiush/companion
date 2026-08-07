import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { ApiError } from '../api/client';
import { SignInCancelled } from '../auth/accountStore';
import { useAuth } from '../auth/AuthContext';
import type { PendingWork } from '../db/ownership';
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

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('field@example.org', 'password', expect.any(Function))
    );
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

  describe('taking over a device holding another account’s work', () => {
    type AlertButton = { text?: string; style?: string; onPress?: () => void };

    /** Run the screen's confirmation prompt and answer it the given way. */
    async function answerPrompt(style: 'cancel' | 'destructive', pending: PendingWork) {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const signIn = jest.fn().mockResolvedValue(undefined);
      mockAuth({ signIn });

      const { getByTestId } = await render(<SignInScreen />);
      await fireEvent.changeText(getByTestId('email'), 'field@example.org');
      await fireEvent.changeText(getByTestId('password'), 'password');
      await fireEvent.press(getByTestId('submit'));

      await waitFor(() => expect(signIn).toHaveBeenCalled());
      const confirmReplace = signIn.mock.calls[0][2] as (work: PendingWork) => Promise<boolean>;

      const answer = confirmReplace(pending);
      const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[] | undefined;
      buttons?.find((button) => button.style === style)?.onPress?.();

      return { answered: await answer, alert };
    }

    it('confirms a takeover only when the user accepts it', async () => {
      const { answered } = await answerPrompt('destructive', { interviews: 2, media: 0 });

      expect(answered).toBe(true);
    });

    it('refuses the takeover when the user cancels', async () => {
      const { answered } = await answerPrompt('cancel', { interviews: 2, media: 0 });

      expect(answered).toBe(false);
    });

    it('counts interviews when there are any, and files otherwise', async () => {
      const withInterviews = await answerPrompt('cancel', { interviews: 2, media: 9 });
      expect(withInterviews.alert.mock.calls.at(-1)?.[1]).toBe('auth.replaceStoreInterviews');

      const mediaOnly = await answerPrompt('cancel', { interviews: 0, media: 9 });
      expect(mediaOnly.alert.mock.calls.at(-1)?.[1]).toBe('auth.replaceStoreMedia');
    });

    it('says nothing when the user chose to keep the other account’s work', async () => {
      const signIn = jest.fn().mockRejectedValue(new SignInCancelled());
      mockAuth({ signIn });

      const { getByTestId, queryByText } = await render(<SignInScreen />);
      await fireEvent.changeText(getByTestId('email'), 'field@example.org');
      await fireEvent.changeText(getByTestId('password'), 'password');
      await fireEvent.press(getByTestId('submit'));

      await waitFor(() => expect(signIn).toHaveBeenCalled());
      // Cancelling is a choice, not a failure — no error copy.
      expect(queryByText('auth.errors.generic')).toBeNull();
      expect(queryByText('auth.errors.invalidCredentials')).toBeNull();
    });
  });
});
