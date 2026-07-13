import { sweepCaptureCache } from './sweepCaptureCache';

let mockExists = true;
let mockThrowOn: string | null = null;
const mockDeleted: string[] = [];

jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  Directory: class {
    dirName: string;
    constructor(_parent: unknown, dirName: string) {
      this.dirName = dirName;
    }
    get exists() {
      return mockExists;
    }
    delete() {
      if (this.dirName === mockThrowOn) {
        throw new Error('locked');
      }
      mockDeleted.push(this.dirName);
    }
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockExists = true;
  mockThrowOn = null;
  mockDeleted.length = 0;
});

describe('sweepCaptureCache', () => {
  it('deletes every capture spool directory', () => {
    sweepCaptureCache();

    expect(mockDeleted).toEqual(['ExpoAudio', 'Audio', 'ImagePicker']);
  });

  it('leaves missing directories alone', () => {
    mockExists = false;

    sweepCaptureCache();

    expect(mockDeleted).toEqual([]);
  });

  it('continues past a directory that cannot be deleted', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockThrowOn = 'Audio';

    sweepCaptureCache();

    expect(mockDeleted).toEqual(['ExpoAudio', 'ImagePicker']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
