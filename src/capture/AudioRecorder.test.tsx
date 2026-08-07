import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import { listMediaForInstance } from '../db/mediaRepository';
import { impact } from '../haptics';
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
  uri: 'file:///rec.m4a' as string | null,
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
jest.mock('../haptics', () => ({ impact: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { number?: number }) => (opts?.number ? `${key}:${opts.number}` : key),
  }),
}));

const mockPermission = requestRecordingPermissionsAsync as jest.Mock;
const mockSetAudioMode = setAudioModeAsync as jest.Mock;
const mockList = listMediaForInstance as jest.Mock;

// A faithful stand-in for AppState: handlers are added and genuinely removed,
// so a test can tell the difference between "ignored the event" and "was no
// longer listening for it".
let appStateHandlers: ((state: string) => void)[] = [];
const foreground = () => appStateHandlers.forEach((handler) => handler('active'));

beforeEach(() => {
  jest.clearAllMocks();
  mockRecorder.record.mockReset();
  mockRecorder.prepareToRecordAsync.mockResolvedValue(undefined);
  mockRecorder.stop.mockResolvedValue(undefined);
  mockRecorder.uri = 'file:///rec.m4a';
  mockStatus.isRecording = true;
  mockStatus.durationMillis = 5000;
  mockList.mockResolvedValue([]);

  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _event: string,
    handler: (state: string) => void
  ) => {
    appStateHandlers.push(handler);
    return {
      remove: () => {
        appStateHandlers = appStateHandlers.filter((each) => each !== handler);
      },
    };
  }) as never);
});

// Platform is a shared singleton and `Version` is a getter, so posing as an
// Android release means redefining the property, then putting the original
// descriptor back. Tests that do not call this run as iOS, the jest default.
const realOS = Platform.OS;
const realVersion = Object.getOwnPropertyDescriptor(Platform, 'Version');

const poseAsAndroid = (version: number) => {
  Platform.OS = 'android';
  Object.defineProperty(Platform, 'Version', { value: version, configurable: true });
};

afterEach(() => {
  jest.restoreAllMocks();
  Platform.OS = realOS;
  if (realVersion) {
    Object.defineProperty(Platform, 'Version', realVersion);
  }
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
      allowsBackgroundRecording: true,
    });
    expect(mockRecorder.prepareToRecordAsync).toHaveBeenCalled();
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalled();
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

  it('asks to show the recording notification, and records even if refused', async () => {
    mockPermission.mockResolvedValue({ granted: true });
    poseAsAndroid(34);
    const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied' as never);

    const { getByTestId } = await render(<AudioRecorder instanceId="inst-1" />);
    await fireEvent.press(getByTestId('record-audio'));

    expect(request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    // The notification is a courtesy; refusing it must not cost the interview.
    await waitFor(() => expect(getByTestId('stop-recording')).toBeTruthy());
    expect(mockRecorder.record).toHaveBeenCalled();
  });

  it('does not ask about notifications on Android versions that never gated them', async () => {
    mockPermission.mockResolvedValue({ granted: true });
    poseAsAndroid(31);
    const request = jest.spyOn(PermissionsAndroid, 'request');

    const { getByTestId } = await render(<AudioRecorder instanceId="inst-1" />);
    await fireEvent.press(getByTestId('record-audio'));

    await waitFor(() => expect(getByTestId('stop-recording')).toBeTruthy());
    expect(request).not.toHaveBeenCalled();
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

  describe('when the system ends a recording while the app is away', () => {
    /** Start a take and let one poll land, so its length is known. */
    const startRecording = async () => {
      mockPermission.mockResolvedValue({ granted: true });
      const screen = await render(<AudioRecorder instanceId="inst-1" />);
      await fireEvent.press(screen.getByTestId('record-audio'));
      await waitFor(() => expect(screen.getByTestId('stop-recording')).toBeTruthy());
      await waitFor(() => expect(screen.getByTestId('recording-clock')).toHaveTextContent('0:05'));
      return screen;
    };

    it('keeps what was captured and says the recording was cut short', async () => {
      const { getByTestId, findByText } = await startRecording();

      // The notification's stop button, an incoming call, or Android
      // reclaiming the service — from here they all look the same.
      mockStatus.isRecording = false;
      await act(async () => foreground());

      await waitFor(() =>
        expect(attachMedia).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            instanceId: 'inst-1',
            kind: 'audio',
            localUri: 'file:///rec.m4a',
            // The length the poll last saw: a stopped recorder reports zero.
            durationS: 5,
          })
        )
      );
      expect(await findByText('interview.recordingInterrupted')).toBeTruthy();
      // Idle again, rather than a frozen clock still claiming to record.
      expect(getByTestId('record-audio')).toBeTruthy();
    });

    it('salvages the take even when stopping the dead recorder throws', async () => {
      const { findByText } = await startRecording();

      mockStatus.isRecording = false;
      mockRecorder.stop.mockRejectedValueOnce(new Error('recorder released'));
      await act(async () => foreground());

      expect(await findByText('interview.recordingInterrupted')).toBeTruthy();
      expect(attachMedia).toHaveBeenCalled();
    });

    it('reports a take that left nothing behind', async () => {
      const { findByText } = await startRecording();

      mockStatus.isRecording = false;
      mockRecorder.uri = null;
      await act(async () => foreground());

      expect(await findByText('interview.recordingLost')).toBeTruthy();
      expect(attachMedia).not.toHaveBeenCalled();
    });

    it('leaves a recording that survived the trip alone', async () => {
      const { getByTestId } = await startRecording();

      // Still running: coming back to the app must not end the interview.
      await act(async () => foreground());

      expect(attachMedia).not.toHaveBeenCalled();
      expect(getByTestId('stop-recording')).toBeTruthy();
    });

    it('does not mistake a deliberate pause for an interruption', async () => {
      const { getByTestId, queryByText } = await startRecording();

      await fireEvent.press(getByTestId('pause-recording'));
      // Paused reads as "not recording" too, so the only thing keeping this
      // safe is that the listener is torn down on the way into a pause.
      await act(async () => foreground());

      expect(attachMedia).not.toHaveBeenCalled();
      expect(queryByText('interview.recordingInterrupted')).toBeNull();
      expect(getByTestId('resume-recording')).toBeTruthy();
    });
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
