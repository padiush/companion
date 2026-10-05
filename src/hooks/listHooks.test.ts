import { renderHook, waitFor } from '@testing-library/react-native';

import { getDatabase } from '../db/database';
import { listAllFieldRecords, listWaitingFieldRecords } from '../db/fieldRecordsRepository';
import { listInstancesWithMeta } from '../db/instancesRepository';
import { useDrafts } from './useDrafts';
import { useFieldRecords } from './useFieldRecords';

// Focus is the screen opening: here, the hook mounting.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]),
}));
jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../db/instancesRepository', () => ({ listInstancesWithMeta: jest.fn() }));
jest.mock('../db/fieldRecordsRepository', () => ({
  listWaitingFieldRecords: jest.fn(),
  listAllFieldRecords: jest.fn(),
}));
jest.mock('../capture/recordProject', () => ({
  getLastRecordProject: jest.fn().mockResolvedValue(null),
}));

const mockGetDatabase = getDatabase as jest.Mock;
const mockListInstances = listInstancesWithMeta as jest.Mock;
const mockListWaiting = listWaitingFieldRecords as jest.Mock;
const mockListAll = listAllFieldRecords as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDatabase.mockResolvedValue({});
  mockListInstances.mockResolvedValue([]);
  mockListWaiting.mockResolvedValue([]);
  mockListAll.mockResolvedValue([]);
});

/**
 * A list whose read fails stops loading. Left loading, its tab showed a
 * spinner until it was opened again, though nothing was still being read.
 */
describe('a list that cannot be read', () => {
  it('stops loading the outbox', async () => {
    mockListWaiting.mockRejectedValue(new Error('database is locked'));

    const { result } = await renderHook(() => useDrafts());

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('stops loading the field records', async () => {
    mockListAll.mockRejectedValue(new Error('database is locked'));

    const { result } = await renderHook(() => useFieldRecords());

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  /** Pull-to-refresh awaits it; a rejection there would go unhandled. */
  it('does not throw from a refresh', async () => {
    const { result } = await renderHook(() => useDrafts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockListInstances.mockRejectedValue(new Error('database is locked'));

    await expect(result.current.refresh()).resolves.toBeUndefined();
  });

  it('keeps what it showed when a later read fails', async () => {
    mockListInstances.mockResolvedValue([{ id: 'i1' }]);
    const { result } = await renderHook(() => useDrafts());
    await waitFor(() => expect(result.current.drafts).toHaveLength(1));

    mockListInstances.mockRejectedValue(new Error('database is locked'));
    await result.current.refresh();

    expect(result.current.drafts).toHaveLength(1);
  });
});
