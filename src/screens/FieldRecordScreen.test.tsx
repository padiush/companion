import { fireEvent, render } from '@testing-library/react-native';

import { emptyDraft, type FieldRecordDraft } from '../capture/fieldRecord';
import { useFieldRecord, type FieldRecordState } from '../capture/useFieldRecord';
import { FieldRecordScreen } from './FieldRecordScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { projectId: 9 } }),
}));
jest.mock('../capture/useFieldRecord', () => ({ useFieldRecord: jest.fn() }));

const mockMediaSection = jest.fn((_props: Record<string, unknown>) => null);
jest.mock('../capture/MediaSection', () => ({
  MediaSection: (props: Record<string, unknown>) => mockMediaSection(props),
}));
const mockAudioRecorder = jest.fn((_props: Record<string, unknown>) => null);
jest.mock('../capture/AudioRecorder', () => ({
  AudioRecorder: (props: Record<string, unknown>) => mockAudioRecorder(props),
}));

const mockUseFieldRecord = useFieldRecord as jest.Mock;
const update = jest.fn();
const locate = jest.fn();
const ensureStored = jest.fn();

const PERMIT = {
  id: 5,
  project_id: 9,
  authority: 'MARN',
  reference: 'AIMA-2026-014',
  issued_on: null,
  expires_on: null,
};

function state(
  draft: Partial<FieldRecordDraft> = {},
  overrides: Partial<FieldRecordState> = {}
): FieldRecordState {
  return {
    draft: { ...emptyDraft({ collector: 'M. Menéndez', today: '2026-10-04' }), ...draft },
    permits: [PERMIT],
    loading: false,
    saving: false,
    stored: false,
    clientId: null,
    readOnly: false,
    syncStatus: 'draft',
    syncError: null,
    locating: false,
    locationFailed: false,
    update,
    locate,
    ensureStored,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FieldRecordScreen', () => {
  it('records what kind of encounter it was', async () => {
    mockUseFieldRecord.mockReturnValue(state());

    const { getByTestId } = await render(<FieldRecordScreen />);
    await fireEvent.press(getByTestId('record-basis-human_observation'));

    expect(update).toHaveBeenCalledWith({ basis: 'human_observation' });
  });

  it('saves what is typed into each field', async () => {
    mockUseFieldRecord.mockReturnValue(state());

    const { getByTestId } = await render(<FieldRecordScreen />);
    await fireEvent.changeText(getByTestId('record-vernacularName'), 'guaba');
    await fireEvent.changeText(getByTestId('record-collectionNumber'), 'RA-014');

    expect(update).toHaveBeenCalledWith({ vernacularName: 'guaba' });
    expect(update).toHaveBeenCalledWith({ collectionNumber: 'RA-014' });
  });

  describe('the permit', () => {
    it('clears the exemption when a permit is chosen', async () => {
      mockUseFieldRecord.mockReturnValue(state({ exemption: 'market' }));

      const { getByTestId } = await render(<FieldRecordScreen />);
      await fireEvent.press(getByTestId('record-permit-5'));

      expect(update).toHaveBeenCalledWith({ permitId: 5, exemption: null });
    });

    it('clears the permit when an exemption is chosen', async () => {
      mockUseFieldRecord.mockReturnValue(state({ permitId: 5 }));

      const { getByTestId } = await render(<FieldRecordScreen />);
      await fireEvent.press(getByTestId('record-exemption-private_land'));

      expect(update).toHaveBeenCalledWith({ exemption: 'private_land', permitId: null });
    });

    it('lets a chosen permit be taken back', async () => {
      mockUseFieldRecord.mockReturnValue(state({ permitId: 5 }));

      const { getByTestId } = await render(<FieldRecordScreen />);
      await fireEvent.press(getByTestId('record-permit-5'));

      expect(update).toHaveBeenCalledWith({ permitId: null });
    });

    it('says where permits come from when the project has none cached', async () => {
      mockUseFieldRecord.mockReturnValue(state({}, { permits: [] }));

      const { getByText, queryByTestId } = await render(<FieldRecordScreen />);

      expect(getByText('fieldRecord.noPermits')).toBeTruthy();
      expect(queryByTestId('record-permit-5')).toBeNull();
    });

    /** Revoked on the web since: still on the record, so it must still be visible and removable. */
    it('shows a permit the project no longer holds, and lets it be removed', async () => {
      mockUseFieldRecord.mockReturnValue(state({ permitId: 77 }, { permits: [] }));

      const { getByTestId, queryByText } = await render(<FieldRecordScreen />);
      await fireEvent.press(getByTestId('record-permit-unlisted'));

      expect(queryByText('fieldRecord.noPermits')).toBeNull();
      expect(update).toHaveBeenCalledWith({ permitId: null });
    });
  });

  describe('the position', () => {
    it('shows the coordinate it has', async () => {
      mockUseFieldRecord.mockReturnValue(state({ location: { lat: 13.701234, lng: -89.203456 } }));

      const { getByTestId } = await render(<FieldRecordScreen />);

      expect(getByTestId('record-coordinates')).toHaveTextContent('13.70123, -89.20346');
    });

    it('says when a fix could not be had, and offers to try again', async () => {
      mockUseFieldRecord.mockReturnValue(state({}, { locationFailed: true }));

      const { getByTestId } = await render(<FieldRecordScreen />);
      await fireEvent.press(getByTestId('record-locate'));

      expect(getByTestId('record-coordinates')).toHaveTextContent('fieldRecord.locationFailed');
      expect(locate).toHaveBeenCalled();
    });
  });

  describe('saving', () => {
    it('does not claim to have saved a record nothing has been entered in', async () => {
      mockUseFieldRecord.mockReturnValue(state());

      const { getByTestId } = await render(<FieldRecordScreen />);

      expect(getByTestId('record-save-state')).toHaveTextContent('fieldRecord.notSavedYet');
    });

    it('says the record is saved on the device once it is', async () => {
      mockUseFieldRecord.mockReturnValue(state({}, { stored: true }));

      const { getByTestId } = await render(<FieldRecordScreen />);

      expect(getByTestId('record-save-state')).toHaveTextContent('fieldRecord.savedLocally');
    });

    it('goes back when done', async () => {
      mockUseFieldRecord.mockReturnValue(state());

      const { getByTestId } = await render(<FieldRecordScreen />);
      await fireEvent.press(getByTestId('record-done'));

      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('says a sent record is corrected on the web, and offers no way to change it', async () => {
    mockUseFieldRecord.mockReturnValue(state({}, { readOnly: true, stored: true }));

    const { getByTestId, queryByTestId } = await render(<FieldRecordScreen />);

    expect(getByTestId('record-sent')).toBeTruthy();
    expect(getByTestId('record-vernacularName').props.editable).toBe(false);
    expect(queryByTestId('record-locate')).toBeNull();
    expect(queryByTestId('record-save-state')).toBeNull();
  });

  /** For an observation the photograph is the evidence; taking one stores the record. */
  it('offers photographs, storing the record on demand', async () => {
    mockUseFieldRecord.mockReturnValue(state({}, { clientId: 'fr-1' }));

    await render(<FieldRecordScreen />);

    expect(mockMediaSection).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fieldRecordId: 'fr-1',
        ensureFieldRecord: ensureStored,
        readOnly: false,
      })
    );
  });

  it('takes no new photographs for a sent record', async () => {
    mockUseFieldRecord.mockReturnValue(state({}, { readOnly: true, clientId: 'fr-1' }));

    await render(<FieldRecordScreen />);

    expect(mockMediaSection).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
  });

  /** A voice note belongs to the record the way a photograph does. */
  it('offers a voice note, storing the record on demand', async () => {
    mockUseFieldRecord.mockReturnValue(state({}, { clientId: 'fr-1' }));

    await render(<FieldRecordScreen />);

    expect(mockAudioRecorder).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fieldRecordId: 'fr-1',
        ensureFieldRecord: ensureStored,
        readOnly: false,
      })
    );
  });

  it('takes no new recordings for a sent record', async () => {
    mockUseFieldRecord.mockReturnValue(state({}, { readOnly: true, clientId: 'fr-1' }));

    await render(<FieldRecordScreen />);

    expect(mockAudioRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
  });

  it('explains why the server refused a record', async () => {
    mockUseFieldRecord.mockReturnValue(
      state({}, { syncStatus: 'rejected', syncError: 'api.sync.permit_not_in_project' })
    );

    const { getByTestId } = await render(<FieldRecordScreen />);

    expect(getByTestId('record-refused')).toHaveTextContent(
      /sync\.recordErrors\.api\.sync\.permit_not_in_project/
    );
  });
});
