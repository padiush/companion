import { fireEvent, render } from '@testing-library/react-native';

import { useFieldRecords } from '../hooks/useFieldRecords';
import { useProjects } from '../hooks/useProjects';
import { RecordsScreen } from './RecordsScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { project?: string }) =>
      opts?.project ? `${key}:${opts.project}` : key,
  }),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../hooks/useFieldRecords', () => ({ useFieldRecords: jest.fn() }));
jest.mock('../hooks/useProjects', () => ({ useProjects: jest.fn() }));
let mockCovers: Record<string, string> = {};
jest.mock('../hooks/useRecordCovers', () => ({ useRecordCovers: () => mockCovers }));

const mockUseFieldRecords = useFieldRecords as jest.Mock;
const mockUseProjects = useProjects as jest.Mock;

const forest = { id: 9, name: 'Cloud forest' };
const market = { id: 12, name: 'Market plants' };

function record(overrides: Record<string, unknown> = {}) {
  return {
    client_id: 'fr-1',
    project_id: 9,
    project_name: 'Cloud forest',
    basis_of_record: 'human_observation',
    vernacular_name: 'guaba',
    collection_number: null,
    collected_on: '2026-10-04',
    sync_status: 'synced',
    ...overrides,
  };
}

function mock({
  records = [] as unknown[],
  lastProjectId = null as number | null,
  projects = [forest, market] as unknown[],
} = {}) {
  mockUseFieldRecords.mockReturnValue({
    records,
    lastProjectId,
    loading: false,
    refresh: jest.fn(),
  });
  mockUseProjects.mockReturnValue({ projects, loading: false });
}

beforeEach(() => {
  jest.clearAllMocks();
  mock();
});

describe('RecordsScreen', () => {
  /** Records from every project, sent or not, in one list. */
  it('lists every record with its project and status, and reopens one', async () => {
    mock({
      records: [
        record(),
        record({
          client_id: 'fr-2',
          project_id: 12,
          project_name: 'Market plants',
          sync_status: 'draft',
        }),
      ],
    });

    const { getByTestId } = await render(<RecordsScreen />);

    expect(getByTestId('field-record-fr-1')).toHaveTextContent(/guaba/);
    expect(getByTestId('field-record-fr-1')).toHaveTextContent(/Cloud forest/);
    expect(getByTestId('field-record-fr-1')).toHaveTextContent(/drafts\.status\.synced/);
    expect(getByTestId('field-record-fr-2')).toHaveTextContent(/Market plants/);

    await fireEvent.press(getByTestId('field-record-fr-2'));

    expect(mockNavigate).toHaveBeenCalledWith('FieldRecord', { projectId: 12, clientId: 'fr-2' });
  });

  it('starts a new record in the project the last one went to', async () => {
    mock({ lastProjectId: 12 });

    const { getByTestId } = await render(<RecordsScreen />);

    expect(getByTestId('record-project')).toHaveTextContent('records.inProject:Market plants');

    await fireEvent.press(getByTestId('new-field-record'));

    expect(mockNavigate).toHaveBeenCalledWith('FieldRecord', { projectId: 12 });
  });

  it('starts in the first project when none was used before', async () => {
    const { getByTestId } = await render(<RecordsScreen />);
    await fireEvent.press(getByTestId('new-field-record'));

    expect(mockNavigate).toHaveBeenCalledWith('FieldRecord', { projectId: 9 });
  });

  /** A project dropped from the device is no place to put a record. */
  it('does not default to a project no longer on the device', async () => {
    mock({ lastProjectId: 77 });

    const { getByTestId } = await render(<RecordsScreen />);
    await fireEvent.press(getByTestId('new-field-record'));

    expect(mockNavigate).toHaveBeenCalledWith('FieldRecord', { projectId: 9 });
  });

  it('lets the project be changed before the record is started', async () => {
    const { getByTestId, queryByTestId } = await render(<RecordsScreen />);

    expect(queryByTestId('record-project-12')).toBeNull();
    await fireEvent.press(getByTestId('change-record-project'));
    await fireEvent.press(getByTestId('record-project-12'));

    // The choice closes, and is what the next record uses.
    expect(queryByTestId('record-project-12')).toBeNull();
    expect(getByTestId('record-project')).toHaveTextContent('records.inProject:Market plants');

    await fireEvent.press(getByTestId('new-field-record'));
    expect(mockNavigate).toHaveBeenCalledWith('FieldRecord', { projectId: 12 });
  });

  it('offers no choice when there is only one project', async () => {
    mock({ projects: [forest] });

    const { queryByTestId } = await render(<RecordsScreen />);

    expect(queryByTestId('change-record-project')).toBeNull();
  });

  it('points at syncing projects when there are none', async () => {
    mock({ projects: [] });

    const { getByTestId, queryByTestId } = await render(<RecordsScreen />);

    expect(getByTestId('records-no-projects')).toHaveTextContent('records.noProjects');
    expect(queryByTestId('new-field-record')).toBeNull();
  });

  it('says when nothing has been recorded yet', async () => {
    const { getByText } = await render(<RecordsScreen />);

    expect(getByText('records.empty')).toBeTruthy();
  });

  /** A record of something never collected is its photograph; the list shows it. */
  it('shows each record by its photograph', async () => {
    mock({ records: [record()] });
    mockCovers = { 'fr-1': 'photo-1' };

    const { getByTestId } = await render(<RecordsScreen />);

    // Decorative: the card already names the record for a screen reader.
    expect(getByTestId('record-cover-fr-1', { includeHiddenElements: true })).toBeTruthy();
    mockCovers = {};
  });
});
