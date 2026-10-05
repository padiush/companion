import { File } from 'expo-file-system';
import { ImageManipulator } from 'expo-image-manipulator';

import { recordDiagnostic } from '../diagnostics';
import { base64ToBytes, bytesToBase64, makeThumbnail } from './thumbnail';

const mockDeleted: string[] = [];
let mockDeleteFails = false;

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    delete: () => {
      if (mockDeleteFails) throw new Error('busy');
      mockDeleted.push(uri);
    },
  })),
}));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('../diagnostics', () => ({ recordDiagnostic: jest.fn().mockResolvedValue(undefined) }));

const mockManipulate = ImageManipulator.manipulate as jest.Mock;

function manipulatorSaving(result: { uri: string; base64?: string } | Error) {
  const saveAsync = jest.fn(async () => {
    if (result instanceof Error) throw result;
    return { width: 320, height: 240, ...result };
  });
  const resize = jest.fn(() => ({ renderAsync: async () => ({ saveAsync }) }));
  mockManipulate.mockReturnValue({ resize });
  return { resize, saveAsync };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleted.length = 0;
  mockDeleteFails = false;
});

describe('makeThumbnail', () => {
  it('returns a small JPEG and deletes the file the manipulator wrote', async () => {
    const { resize, saveAsync } = manipulatorSaving({
      uri: 'file:///cache/ImageManipulator/t.jpg',
      base64: bytesToBase64(Uint8Array.from([255, 216, 1])),
    });

    const bytes = await makeThumbnail('file:///cache/ImagePicker/p.jpg');

    expect(mockManipulate).toHaveBeenCalledWith('file:///cache/ImagePicker/p.jpg');
    expect(resize).toHaveBeenCalledWith({ width: 320, height: null });
    expect(saveAsync).toHaveBeenCalledWith(expect.objectContaining({ base64: true }));
    expect(Array.from(bytes ?? [])).toEqual([255, 216, 1]);
    // The preview is plaintext on disk until this point.
    expect(mockDeleted).toEqual(['file:///cache/ImageManipulator/t.jpg']);
  });

  it('gives up quietly when the image cannot be read', async () => {
    manipulatorSaving(new Error('decode failed'));

    await expect(makeThumbnail('file:///x.jpg')).resolves.toBeNull();
    expect(File).not.toHaveBeenCalled();
  });

  it('reports a preview file it could not delete', async () => {
    mockDeleteFails = true;
    manipulatorSaving({ uri: 'file:///cache/ImageManipulator/t.jpg', base64: 'AQI=' });

    await makeThumbnail('file:///x.jpg');

    expect(recordDiagnostic).toHaveBeenCalledWith('plaintext_capture_retained');
  });
});

describe('base64', () => {
  it('round-trips bytes, including ones larger than a single slice', () => {
    const bytes = new Uint8Array(70000).map((_, i) => i % 256);

    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});
