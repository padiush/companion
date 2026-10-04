import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { listMediaForFieldRecord } from '../db/mediaRepository';
import { attachMedia } from './mediaService';
import { MediaSection } from './MediaSection';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('../db/database', () => ({ getDatabase: jest.fn().mockResolvedValue({}) }));
jest.mock('../db/mediaRepository', () => ({
  listMediaForInstance: jest.fn().mockResolvedValue([]),
  listMediaForFieldRecord: jest.fn().mockResolvedValue([]),
}));
jest.mock('./mediaService', () => ({ attachMedia: jest.fn().mockResolvedValue('media-1') }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const mockCameraPermission = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const mockLaunchCamera = ImagePicker.launchCameraAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MediaSection', () => {
  it('takes a photo and attaches it', async () => {
    mockCameraPermission.mockResolvedValue({ granted: true });
    mockLaunchCamera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///p.jpg', mimeType: 'image/jpeg' }],
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

  it('shows a message when camera permission is denied', async () => {
    mockCameraPermission.mockResolvedValue({ granted: false });

    const { getByTestId, findByText } = await render(<MediaSection instanceId="inst-1" />);
    await fireEvent.press(getByTestId('add-photo'));

    expect(await findByText('interview.mediaPermission')).toBeTruthy();
    expect(attachMedia).not.toHaveBeenCalled();
  });

  it('shows a message when the photo cannot be saved', async () => {
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

  describe('on a field record', () => {
    function takesAPhoto() {
      // Set here, not inherited: clearAllMocks keeps implementations, and an
      // earlier test leaves attachMedia rejecting.
      (attachMedia as jest.Mock).mockResolvedValue('media-2');
      mockCameraPermission.mockResolvedValue({ granted: true });
      mockLaunchCamera.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///r.jpg', mimeType: 'image/jpeg' }],
      });
    }

    /** For an observation the photograph is often the first thing captured. */
    it('stores a new record first, then attaches the photograph to it', async () => {
      takesAPhoto();
      const ensureFieldRecord = jest.fn().mockResolvedValue('fr-1');

      const { getByTestId } = await render(
        <MediaSection fieldRecordId={null} ensureFieldRecord={ensureFieldRecord} />
      );
      await fireEvent.press(getByTestId('add-photo'));

      await waitFor(() =>
        expect(attachMedia).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            fieldRecordId: 'fr-1',
            kind: 'photo',
            localUri: 'file:///r.jpg',
          })
        )
      );
      expect(ensureFieldRecord).toHaveBeenCalled();
      expect((attachMedia as jest.Mock).mock.calls[0][1]).not.toHaveProperty('instanceId');
      // The list is reloaded for the record the photograph now belongs to.
      await waitFor(() =>
        expect(listMediaForFieldRecord).toHaveBeenLastCalledWith(expect.anything(), 'fr-1')
      );
    });

    it('stores nothing when the camera is closed without a photograph', async () => {
      mockCameraPermission.mockResolvedValue({ granted: true });
      mockLaunchCamera.mockResolvedValue({ canceled: true, assets: [] });
      const ensureFieldRecord = jest.fn();

      const { getByTestId } = await render(
        <MediaSection fieldRecordId={null} ensureFieldRecord={ensureFieldRecord} />
      );
      await fireEvent.press(getByTestId('add-photo'));

      await waitFor(() => expect(mockLaunchCamera).toHaveBeenCalled());
      expect(ensureFieldRecord).not.toHaveBeenCalled();
      expect(attachMedia).not.toHaveBeenCalled();
    });

    it('lists the photographs a stored record already has', async () => {
      (listMediaForFieldRecord as jest.Mock).mockResolvedValueOnce([
        { client_id: 'm-1', kind: 'photo' },
        { client_id: 'm-2', kind: 'audio' },
      ]);

      const { findByTestId, queryByTestId } = await render(
        <MediaSection fieldRecordId="fr-1" ensureFieldRecord={jest.fn()} />
      );

      expect(await findByTestId('media-m-1')).toBeTruthy();
      expect(queryByTestId('media-m-2')).toBeNull();
    });

    it('takes no new photographs for a sent record', async () => {
      const { queryByTestId } = await render(
        <MediaSection fieldRecordId="fr-1" ensureFieldRecord={jest.fn()} readOnly />
      );

      expect(queryByTestId('add-photo')).toBeNull();
    });
  });
});
