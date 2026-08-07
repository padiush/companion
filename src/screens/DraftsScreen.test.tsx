import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useDrafts } from '../hooks/useDrafts';
import { useOutbox } from '../hooks/useOutbox';
import { DraftsScreen } from './DraftsScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../hooks/useDrafts', () => ({ useDrafts: jest.fn() }));
jest.mock('../hooks/useOutbox', () => ({ useOutbox: jest.fn() }));

const mockUseDrafts = useDrafts as jest.Mock;
const mockUseOutbox = useOutbox as jest.Mock;

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    form_id: 27,
    project_id: 9,
    form_name: 'Plant uses',
    captured_at: '2026-07-13T10:00:00Z',
    created_at: '2026-07-13T09:00:00Z',
    sync_status: 'draft',
    answer_count: 3,
    media_count: 1,
    preview: 'Ruda',
    ...overrides,
  };
}

function mockDrafts(overrides: Record<string, unknown> = {}) {
  mockUseDrafts.mockReturnValue({ drafts: [], loading: false, refresh: jest.fn(), ...overrides });
}

function mockOutbox(overrides: Record<string, unknown> = {}) {
  const state = {
    count: 0,
    pendingMedia: 0,
    sending: false,
    error: false,
    send: jest.fn(),
    ...overrides,
  };

  mockUseOutbox.mockReturnValue({
    ...state,
    hasWork: state.count > 0 || state.pendingMedia > 0,
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

  it('shows a content preview to tell same-form drafts apart', async () => {
    mockDrafts({ drafts: [draft({ preview: 'Ruda' }), draft({ id: 'd2', preview: 'Sábila' })] });

    const { getByText } = await render(<DraftsScreen />);

    expect(getByText('Ruda')).toBeTruthy();
    expect(getByText('Sábila')).toBeTruthy();
  });

  it('offers no send action when everything has reached the server', async () => {
    mockOutbox({ count: 0, pendingMedia: 0 });

    const { queryByTestId } = await render(<DraftsScreen />);

    expect(queryByTestId('send')).toBeNull();
  });

  /**
   * The gap this closes: media upload only ran behind the Send action, which
   * appeared only when there were draft interviews. Photos or audio attached
   * after an interview synced could therefore never be uploaded at all.
   */
  it('offers to upload media even when no interview is waiting', async () => {
    mockOutbox({ count: 0, pendingMedia: 3 });

    const { getByTestId, getByText } = await render(<DraftsScreen />);

    expect(getByTestId('send')).toBeTruthy();
    expect(getByText('drafts.sendMedia')).toBeTruthy();
  });

  it('counts interviews on the send action when there are any', async () => {
    mockOutbox({ count: 2, pendingMedia: 3 });

    const { getByText } = await render(<DraftsScreen />);

    expect(getByText('drafts.send · 2')).toBeTruthy();
  });

  it('shows the empty state when there are no interviews', async () => {
    mockDrafts({ drafts: [] });

    const { getByText } = await render(<DraftsScreen />);
    expect(getByText('drafts.empty')).toBeTruthy();
  });

  it('reopens a draft as an interview when a row is tapped', async () => {
    mockDrafts({ drafts: [draft()] });

    const { getByTestId } = await render(<DraftsScreen />);
    await fireEvent.press(getByTestId('draft-d1'));

    expect(mockNavigate).toHaveBeenCalledWith('Interview', {
      formId: 27,
      projectId: 9,
      formName: 'Plant uses',
      instanceId: 'd1',
    });
  });

  it('sends, refreshes the list, and confirms how many went', async () => {
    const send = jest.fn().mockResolvedValue({ synced: 2, rejected: 0 });
    const refresh = jest.fn().mockResolvedValue(undefined);
    mockDrafts({ refresh });
    mockOutbox({ count: 2, send });

    const { getByTestId, findByText } = await render(<DraftsScreen />);
    await fireEvent.press(getByTestId('send'));

    expect(send).toHaveBeenCalled();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await findByText('drafts.sent')).toBeTruthy();
  });

  it('hides the send button when there is nothing to send', async () => {
    mockOutbox({ count: 0 });

    const { queryByTestId } = await render(<DraftsScreen />);
    expect(queryByTestId('send')).toBeNull();
  });

  it('refreshes the list on pull-to-refresh', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    mockDrafts({ refresh });

    const { getByTestId } = await render(<DraftsScreen />);
    getByTestId('drafts-scroll').props.refreshControl.props.onRefresh();

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
