import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useDrafts } from '../hooks/useDrafts';
import { useOutbox } from '../hooks/useOutbox';
import { OutboxScreen } from './OutboxScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
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
    audio_count: 1,
    preview: 'Ruda',
    ...overrides,
  };
}

function mockDrafts(overrides: Record<string, unknown> = {}) {
  mockUseDrafts.mockReturnValue({
    drafts: [],
    fieldRecords: [],
    loading: false,
    refresh: jest.fn(),
    ...overrides,
  });
}

function mockOutbox(overrides: Record<string, unknown> = {}) {
  const state = {
    count: 0,
    fieldRecords: 0,
    pendingMedia: 0,
    lastRecordResult: null,
    sending: false,
    error: false,
    send: jest.fn(),
    ...overrides,
  };

  mockUseOutbox.mockReturnValue({
    ...state,
    hasWork: state.count > 0 || state.fieldRecords > 0 || state.pendingMedia > 0,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDrafts();
  mockOutbox();
});

describe('OutboxScreen', () => {
  it('lists interviews with their status', async () => {
    mockDrafts({
      drafts: [draft(), draft({ id: 'd2', preview: 'Sábila', sync_status: 'rejected' })],
    });

    const { getByTestId, getByText } = await render(<OutboxScreen />);

    expect(getByTestId('draft-d1')).toBeTruthy();
    // The row leads with what tells two interviews apart, not the form name
    // they share.
    expect(getByText('Ruda')).toBeTruthy();
    expect(getByText('drafts.status.draft')).toBeTruthy();
    expect(getByText('drafts.status.rejected')).toBeTruthy();
  });

  it('shows a content preview to tell same-form drafts apart', async () => {
    mockDrafts({ drafts: [draft({ preview: 'Ruda' }), draft({ id: 'd2', preview: 'Sábila' })] });

    const { getByText } = await render(<OutboxScreen />);

    expect(getByText('Ruda')).toBeTruthy();
    expect(getByText('Sábila')).toBeTruthy();
  });

  it('offers no send action when everything has reached the server', async () => {
    mockOutbox({ count: 0, pendingMedia: 0 });

    const { queryByTestId } = await render(<OutboxScreen />);

    expect(queryByTestId('send')).toBeNull();
  });

  /**
   * The gap this closes: media upload only ran behind the Send action, which
   * appeared only when there were draft interviews. Photos or audio attached
   * after an interview synced could therefore never be uploaded at all.
   */
  it('offers to upload media even when no interview is waiting', async () => {
    mockOutbox({ count: 0, pendingMedia: 3 });

    const { getByTestId, getByText } = await render(<OutboxScreen />);

    expect(getByTestId('send')).toBeTruthy();
    expect(getByText('drafts.sendMedia')).toBeTruthy();
  });

  it('counts interviews on the send action when there are any', async () => {
    mockOutbox({ count: 2, pendingMedia: 3 });

    const { getByText } = await render(<OutboxScreen />);

    expect(getByText('drafts.send · 2')).toBeTruthy();
  });

  /** Records are made in a project, but this is the Send that carries them. */
  it('counts field records on the send action alongside interviews', async () => {
    mockOutbox({ count: 2, fieldRecords: 3 });

    const { getByText } = await render(<OutboxScreen />);

    expect(getByText('drafts.send · 5')).toBeTruthy();
  });

  it('offers to send when only field records are waiting', async () => {
    mockOutbox({ count: 0, fieldRecords: 1 });

    const { getByText } = await render(<OutboxScreen />);

    expect(getByText('drafts.send · 1')).toBeTruthy();
  });

  it('says how many field records went, and how many the server refused', async () => {
    const send = jest.fn().mockResolvedValue({ synced: 0, partial: 0, rejected: 0 });
    mockOutbox({ fieldRecords: 3, send, lastRecordResult: { synced: 2, rejected: 1 } });

    const { getByTestId, findByTestId } = await render(<OutboxScreen />);
    await fireEvent.press(getByTestId('send'));

    expect(await findByTestId('records-sent')).toHaveTextContent('drafts.recordsSent');
    expect(await findByTestId('records-refused')).toHaveTextContent('drafts.recordsRefused');
  });

  describe('field records waiting to be sent', () => {
    const waiting = (overrides: Record<string, unknown> = {}) => ({
      client_id: 'fr-1',
      project_id: 9,
      project_name: 'Cloud forest',
      basis_of_record: 'human_observation',
      vernacular_name: 'guaba',
      collection_number: null,
      collected_on: '2026-10-04',
      sync_status: 'draft',
      ...overrides,
    });

    /**
     * The Send count would otherwise point at nothing on this screen. Records
     * come after the interviews, as they are sent after them.
     */
    it('lists them after the interviews, saying which project each is in', async () => {
      mockDrafts({ drafts: [draft()], fieldRecords: [waiting()] });

      const { getByTestId, getByText } = await render(<OutboxScreen />);

      expect(getByText('drafts.interviews')).toBeTruthy();
      expect(getByText('drafts.fieldRecords')).toBeTruthy();
      expect(getByTestId('waiting-record-fr-1')).toHaveTextContent(/guaba/);
      expect(getByTestId('waiting-record-fr-1')).toHaveTextContent(/Cloud forest/);
      expect(getByTestId('waiting-record-fr-1')).toHaveTextContent(/drafts\.status\.draft/);
    });

    it('opens a record in its project', async () => {
      mockDrafts({ fieldRecords: [waiting()] });

      const { getByTestId } = await render(<OutboxScreen />);
      await fireEvent.press(getByTestId('waiting-record-fr-1'));

      expect(mockNavigate).toHaveBeenCalledWith('FieldRecord', { projectId: 9, clientId: 'fr-1' });
    });

    it('marks a refused record, and names one with nothing to call it by', async () => {
      mockDrafts({
        fieldRecords: [waiting({ vernacular_name: null, sync_status: 'rejected' })],
      });

      const { getByTestId } = await render(<OutboxScreen />);

      expect(getByTestId('waiting-record-fr-1')).toHaveTextContent(/fieldRecord\.untitled/);
      expect(getByTestId('waiting-record-fr-1')).toHaveTextContent(/drafts\.status\.rejected/);
    });

    it('heads only the kinds that have something waiting', async () => {
      mockDrafts({ drafts: [draft()] });

      const { getByText, queryByText } = await render(<OutboxScreen />);

      expect(getByText('drafts.interviews')).toBeTruthy();
      expect(queryByText('drafts.fieldRecords')).toBeNull();
    });
  });

  it('says everything has been sent when nothing is waiting', async () => {
    mockDrafts({ drafts: [] });

    const { getByTestId } = await render(<OutboxScreen />);
    expect(getByTestId('outbox-empty')).toHaveTextContent('outbox.empty');
  });

  /** A sent interview stays in Entrevistas; this tab is only what the server lacks. */
  it('leaves out the interviews the server already has in full', async () => {
    mockDrafts({
      drafts: [
        draft({ id: 'sent', sync_status: 'synced' }),
        draft({ id: 'refused-answers', sync_status: 'partial' }),
      ],
    });

    const { queryByTestId, getByTestId } = await render(<OutboxScreen />);

    expect(queryByTestId('draft-sent')).toBeNull();
    expect(getByTestId('draft-refused-answers')).toBeTruthy();
  });

  it('says what is left when only files of sent work remain', async () => {
    mockDrafts({ drafts: [draft({ sync_status: 'synced' })] });
    mockOutbox({ pendingMedia: 2 });

    const { getByText, queryByTestId } = await render(<OutboxScreen />);

    expect(getByText('outbox.onlyMedia')).toBeTruthy();
    expect(queryByTestId('outbox-empty')).toBeNull();
  });

  it('reopens a draft as an interview when a row is tapped', async () => {
    mockDrafts({ drafts: [draft()] });

    const { getByTestId } = await render(<OutboxScreen />);
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

    const { getByTestId, findByText } = await render(<OutboxScreen />);
    await fireEvent.press(getByTestId('send'));

    expect(send).toHaveBeenCalled();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await findByText('drafts.sent')).toBeTruthy();
  });

  it('hides the send button when there is nothing to send', async () => {
    mockOutbox({ count: 0 });

    const { queryByTestId } = await render(<OutboxScreen />);
    expect(queryByTestId('send')).toBeNull();
  });

  it('refreshes the list on pull-to-refresh', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    mockDrafts({ refresh });

    const { getByTestId } = await render(<OutboxScreen />);
    getByTestId('outbox-scroll').props.refreshControl.props.onRefresh();

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
