import { render, waitFor } from '@testing-library/react-native';

import { getThumbnail } from '../db/mediaRepository';
import { Thumbnail } from './Thumbnail';

jest.mock('../db/database', () => ({ getDatabase: jest.fn().mockResolvedValue({}) }));
jest.mock('../db/mediaRepository', () => ({ getThumbnail: jest.fn() }));

const mockGetThumbnail = getThumbnail as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Thumbnail', () => {
  /** The decoded photograph must never land in the image library's disk cache. */
  it('draws the preview from memory, with caching off', async () => {
    mockGetThumbnail.mockResolvedValue(Uint8Array.from([1, 2, 3]));

    const { findByTestId } = await render(<Thumbnail testID="thumb" mediaId="p-1" />);

    const image = await findByTestId('thumb-image', { includeHiddenElements: true });
    expect(image.props.source).toEqual([{ uri: 'data:image/jpeg;base64,AQID' }]);
    expect(image.props.cachePolicy).toBe('none');
    expect(mockGetThumbnail).toHaveBeenCalledWith({}, 'p-1');
  });

  it('shows a placeholder when there is no preview', async () => {
    mockGetThumbnail.mockResolvedValue(null);

    const { queryByTestId } = await render(<Thumbnail testID="thumb" mediaId="p-1" />);

    await waitFor(() => expect(mockGetThumbnail).toHaveBeenCalled());
    expect(queryByTestId('thumb-image', { includeHiddenElements: true })).toBeNull();
  });

  it('reads nothing for a record without photographs', async () => {
    await render(<Thumbnail testID="thumb" mediaId={null} />);

    expect(mockGetThumbnail).not.toHaveBeenCalled();
  });
});
