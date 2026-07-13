import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';

import { attachMedia } from './mediaService';
import { MediaSection } from './MediaSection';

const mockRecorder = {
  prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
  record: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
  uri: 'file:///audio.m4a',
};

jest.mock('expo-audio', () => ({
  useAudioRecorder: () => mockRecorder,
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('../db/database', () => ({ getDatabase: jest.fn().mockResolvedValue({}) }));
jest.mock('../db/mediaRepository', () => ({
  listMediaForInstance: jest.fn().mockResolvedValue([]),
}));
jest.mock('./mediaService', () => ({ attachMedia: jest.fn().mockResolvedValue('media-1') }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const mockCameraPermission = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const mockLaunchCamera = ImagePicker.launchCameraAsync as jest.Mock;
const mockAudioPermission = requestRecordingPermissionsAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MediaSection', () => {
  it('takes a photo and attaches it', async () => {
    mockCameraPermission.mockResolvedValue({ granted: true });
    mockLaunchCamera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///p.jpg', fileSize: 2000, mimeType: 'image/jpeg' }],
    });

    const { getByTestId } = await render(<MediaSection instanceId="inst-1" />);
    await fireEvent.press(getByTestId('add-photo'));

    await waitFor(() =>
      expect(attachMedia).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          instanceId: 'inst-1',
          kind: 'photo',
          localUri: 'file:///p.jpg',
          contentType: 'image/jpeg',
        })
      )
    );
  });

  it('shows a message when the capture cannot be saved', async () => {
    mockCameraPermission.mockResolvedValue({ granted: true });
    mockLaunchCamera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///p.jpg', mimeType: 'image/jpeg' }],
    });
    (attachMedia as jest.Mock).mockRejectedValue(new Error('ingest failed'));

    const { getByTestId, findByText } = await render(<MediaSection instanceId="inst-1" />);
    await fireEvent.press(getByTestId('add-photo'));

    expect(await findByText('interview.mediaSaveFailed')).toBeTruthy();
  });

  it('records audio and attaches it on stop', async () => {
    mockAudioPermission.mockResolvedValue({ granted: true });

    const { getByTestId } = await render(<MediaSection instanceId="inst-1" />);

    await fireEvent.press(getByTestId('record-audio'));
    expect(mockRecorder.record).toHaveBeenCalled();

    await fireEvent.press(getByTestId('record-audio'));
    expect(mockRecorder.stop).toHaveBeenCalled();

    await waitFor(() =>
      expect(attachMedia).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ kind: 'audio', localUri: 'file:///audio.m4a' })
      )
    );
  });

  it('shows a message when camera permission is denied', async () => {
    mockCameraPermission.mockResolvedValue({ granted: false });

    const { getByTestId, findByText } = await render(<MediaSection instanceId="inst-1" />);
    await fireEvent.press(getByTestId('add-photo'));

    expect(await findByText('interview.mediaPermission')).toBeTruthy();
    expect(attachMedia).not.toHaveBeenCalled();
  });
});
