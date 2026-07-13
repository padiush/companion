import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';

import { listMediaForInstance } from '../db/mediaRepository';
import { AudioRecorder } from './AudioRecorder';
import { attachMedia } from './mediaService';

const mockStatus = {
  canRecord: true,
  isRecording: true,
  durationMillis: 5000,
  mediaServicesDidReset: false,
  metering: -20,
  url: null,
};
const mockRecorder = {
  prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
  record: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn(() => mockStatus),
  uri: 'file:///rec.m4a',
};

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioRecorder: () => mockRecorder,
}));
jest.mock('../db/database', () => ({ getDatabase: jest.fn().mockResolvedValue({}) }));
jest.mock('../db/mediaRepository', () => ({ listMediaForInstance: jest.fn() }));
jest.mock('./mediaService', () => ({ attachMedia: jest.fn().mockResolvedValue('audio-1') }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { number?: number }) =>
      opts?.number ? `${key}:${opts.number}` : key,
  }),
}));

const mockPermission = requestRecordingPermissionsAsync as jest.Mock;
const mockSetAudioMode = setAudioModeAsync as jest.Mock;
const mockList = listMediaForInstance as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockRecorder.record.mockReset();
  mockRecorder.prepareToRecordAsync.mockResolvedValue(undefined);
  mockRecorder.stop.mockResolvedValue(undefined);
  mockList.mockResolvedValue([]);
});

describe('AudioRecorder', () => {
  it('sets the recording audio mode, prepares, and starts on record', async () => {
    mockPermission.mockResolvedValue({ granted: true });

    const { getByTestId } = await render(<AudioRecorder instanceId="inst-1" />);
    await fireEvent.press(getByTestId('record-audio'));

    await waitFor(() => expect(getByTestId('stop-recording')).toBeTruthy());
    expect(mockSetAudioMode).toHaveBeenCalledWith({
      playsInSilentMode: true,
      allowsRecording: true,
    });
    expect(mockRecorder.prepareToRecordAsync).toHaveBeenCalled();
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
    // A running recording exposes pause + stop, not the initial record button.
    expect(getByTestId('pause-recording')).toBeTruthy();
  });

  it('surfaces an error and stays idle if starting throws', async () => {
    mockPermission.mockResolvedValue({ granted: true });
    mockRecorder.record.mockImplementationOnce(() => {
      throw new Error('native shared object not found');
    });

    const { getByTestId, findByText, queryByTestId } = await render(
      <AudioRecorder instanceId="inst-1" />
    );
    await fireEvent.press(getByTestId('record-audio'));

    expect(await findByText('interview.recordStartFailed')).toBeTruthy();
    expect(queryByTestId('stop-recording')).toBeNull();
    expect(getByTestId('record-audio')).toBeTruthy();
  });

  it('asks for permission and does not record when denied', async () => {
    mockPermission.mockResolvedValue({ granted: false });

    const { getByTestId, findByText } = await render(<AudioRecorder instanceId="inst-1" />);
    await fireEvent.press(getByTestId('record-audio'));

    expect(await findByText('interview.mediaPermission')).toBeTruthy();
    expect(mockSetAudioMode).not.toHaveBeenCalled();
    expect(mockRecorder.record).not.toHaveBeenCalled();
  });

  it('pauses and resumes a recording', async () => {
    mockPermission.mockResolvedValue({ granted: true });

    const { getByTestId } = await render(<AudioRecorder instanceId="inst-1" />);
    await fireEvent.press(getByTestId('record-audio'));
    await waitFor(() => expect(getByTestId('pause-recording')).toBeTruthy());

    await fireEvent.press(getByTestId('pause-recording'));
    expect(mockRecorder.pause).toHaveBeenCalled();

    // Paused shows resume; resuming records again without re-preparing.
    await fireEvent.press(getByTestId('resume-recording'));
    expect(mockRecorder.record).toHaveBeenCalledTimes(2);
    expect(getByTestId('pause-recording')).toBeTruthy();
  });

  it('ingests the recording with its recorded duration on stop', async () => {
    mockPermission.mockResolvedValue({ granted: true });

    const { getByTestId } = await render(<AudioRecorder instanceId="inst-1" />);
    await fireEvent.press(getByTestId('record-audio'));
    await waitFor(() => expect(getByTestId('stop-recording')).toBeTruthy());

    await fireEvent.press(getByTestId('stop-recording'));

    await waitFor(() =>
      expect(attachMedia).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          instanceId: 'inst-1',
          kind: 'audio',
          localUri: 'file:///rec.m4a',
          contentType: 'audio/mp4',
          durationS: 5,
        })
      )
    );
    // Back to idle, ready for another take.
    await waitFor(() => expect(getByTestId('record-audio')).toBeTruthy());
  });

  it('lists recordings already attached to the interview', async () => {
    mockList.mockResolvedValue([
      {
        client_id: 'aud-1',
        instance_id: 'inst-1',
        kind: 'audio',
        duration_s: 74,
        upload_status: 'pending',
      },
      { client_id: 'pho-1', instance_id: 'inst-1', kind: 'photo', upload_status: 'pending' },
    ]);

    const { findByTestId, queryByTestId } = await render(<AudioRecorder instanceId="inst-1" />);

    // Audio is listed here; photos are not (they live in MediaSection).
    expect(await findByTestId('recording-aud-1')).toBeTruthy();
    expect(queryByTestId('recording-pho-1')).toBeNull();
  });
});
