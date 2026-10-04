import { fireEvent, render } from '@testing-library/react-native';

import type { FieldRecordRow } from '../db/types';
import { useFieldRecords } from '../hooks/useFieldRecords';
import { useForms } from '../hooks/useForms';
import { ProjectScreen } from './ProjectScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { projectId: 9, projectName: 'Cloud forest' } }),
}));
jest.mock('../hooks/useForms', () => ({ useForms: jest.fn() }));
jest.mock('../hooks/useFieldRecords', () => ({ useFieldRecords: jest.fn() }));

const mockUseForms = useForms as jest.Mock;
const mockUseFieldRecords = useFieldRecords as jest.Mock;

function record(overrides: Partial<FieldRecordRow> = {}): FieldRecordRow {
  return {
    client_id: 'fr-1',
    project_id: 9,
    server_id: null,
    basis_of_record: 'human_observation',
    vernacular_name: 'guaba',
    collection_number: null,
    collector: null,
    collected_on: '2026-10-04',
    locality: null,
    location_lat: null,
    location_lng: null,
    notes: null,
    collecting_permit_id: null,
    permit_exemption: null,
    answer_client_id: null,
    edited_at: null,
    sync_status: 'draft',
    sync_error: null,
    created_at: '2026-10-04T10:00:00Z',
    updated_at: '2026-10-04T10:00:00Z',
    ...overrides,
  };
}

const form = (id: number, name: string, isActive = true) => ({
  id,
  projectId: 9,
  name,
  description: null,
  isActive,
  updatedAt: null,
  sections: [],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFieldRecords.mockReturnValue({ records: [], loading: false });
});

describe('ProjectScreen', () => {
  it('lists only the active forms', async () => {
    mockUseForms.mockReturnValue({
      forms: [form(1, 'Plant uses'), form(2, 'Retired form', false)],
      loading: false,
    });

    const { getByTestId, queryByTestId } = await render(<ProjectScreen />);

    expect(getByTestId('form-1')).toBeTruthy();
    expect(queryByTestId('form-2')).toBeNull();
  });

  it('starts an interview for the tapped form', async () => {
    mockUseForms.mockReturnValue({ forms: [form(1, 'Plant uses')], loading: false });

    const { getByTestId } = await render(<ProjectScreen />);
    await fireEvent.press(getByTestId('form-1'));

    expect(mockNavigate).toHaveBeenCalledWith('Interview', {
      formId: 1,
      projectId: 9,
      formName: 'Plant uses',
    });
  });

  it('shows the empty state when there are no active forms', async () => {
    mockUseForms.mockReturnValue({ forms: [], loading: false });

    const { getByText } = await render(<ProjectScreen />);
    expect(getByText('project.empty')).toBeTruthy();
  });

  describe('field records', () => {
    beforeEach(() => {
      mockUseForms.mockReturnValue({ forms: [], loading: false });
    });

    it('starts a new record for the project', async () => {
      const { getByTestId } = await render(<ProjectScreen />);
      await fireEvent.press(getByTestId('new-field-record'));

      expect(mockNavigate).toHaveBeenCalledWith('FieldRecord', { projectId: 9 });
    });

    it('reopens a record from the list', async () => {
      mockUseFieldRecords.mockReturnValue({ records: [record()], loading: false });

      const { getByTestId } = await render(<ProjectScreen />);
      await fireEvent.press(getByTestId('field-record-fr-1'));

      expect(mockNavigate).toHaveBeenCalledWith('FieldRecord', { projectId: 9, clientId: 'fr-1' });
    });

    it('names each record and says whether it has been sent', async () => {
      mockUseFieldRecords.mockReturnValue({
        records: [
          record(),
          record({ client_id: 'fr-2', vernacular_name: null, sync_status: 'rejected' }),
        ],
        loading: false,
      });

      const { getByTestId } = await render(<ProjectScreen />);

      expect(getByTestId('field-record-fr-1')).toHaveTextContent(/guaba/);
      expect(getByTestId('field-record-fr-1')).toHaveTextContent(/fieldRecord\.status\.notSent/);
      expect(getByTestId('field-record-fr-2')).toHaveTextContent(/fieldRecord\.untitled/);
      expect(getByTestId('field-record-fr-2')).toHaveTextContent(/fieldRecord\.status\.refused/);
    });

    it('says when nothing has been recorded yet', async () => {
      const { getByText } = await render(<ProjectScreen />);

      expect(getByText('project.noFieldRecords')).toBeTruthy();
    });
  });
});
