import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useDrafts } from '../hooks/useDrafts';
import { useOutbox } from '../hooks/useOutbox';
import { DraftsScreen } from './DraftsScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ setOptions: jest.fn() }),
}));
jest.mock('../hooks/useDrafts', () => ({ useDrafts: jest.fn() }));
jest.mock('../hooks/useOutbox', () => ({ useOutbox: jest.fn() }));

const mockUseDrafts = useDrafts as jest.Mock;
const mockUseOutbox = useOutbox as jest.Mock;

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    form_id: 27,
    form_name: 'Plant uses',
    captured_at: '2026-07-13T10:00:00Z',
    created_at: '2026-07-13T09:00:00Z',
    sync_status: 'draft',
    answer_count: 3,
    media_count: 1,
    ...overrides,
  };
}

function mockDrafts(overrides: Record<string, unknown> = {}) {
  mockUseDrafts.mockReturnValue({ drafts: [], loading: false, refresh: jest.fn(), ...overrides });
}

function mockOutbox(overrides: Record<string, unknown> = {}) {
  mockUseOutbox.mockReturnValue({
    count: 0,
    sending: false,
    error: false,
    send: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDrafts();
  mockOutbox();
});

describe('DraftsScreen', () => {
  it('lists interviews with their status', async () => {
    mockDrafts({
      drafts: [draft(), draft({ id: 'd2', form_name: 'Other form', sync_status: 'rejected' })],
    });

    const { getByTestId, getByText } = await render(<DraftsScreen />);

    expect(getByTestId('draft-d1')).toBeTruthy();
    expect(getByText('Plant uses')).toBeTruthy();
    expect(getByText('drafts.status.draft')).toBeTruthy();
    expect(getByText('drafts.status.rejected')).toBeTruthy();
  });

  it('shows the empty state when there are no interviews', async () => {
    mockDrafts({ drafts: [] });

    const { getByText } = await render(<DraftsScreen />);
    expect(getByText('drafts.empty')).toBeTruthy();
  });

  it('sends and then refreshes the list', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const refresh = jest.fn().mockResolvedValue(undefined);
    mockDrafts({ refresh });
    mockOutbox({ count: 2, send });

    const { getByTestId } = await render(<DraftsScreen />);
    await fireEvent.press(getByTestId('send'));

    expect(send).toHaveBeenCalled();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('hides the send button when there is nothing to send', async () => {
    mockOutbox({ count: 0 });

    const { queryByTestId } = await render(<DraftsScreen />);
    expect(queryByTestId('send')).toBeNull();
  });
});
