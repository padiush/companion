import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getDatabase } from '../db/database';
import { getProjects } from '../db/projectsRepository';
import { pull } from '../sync/pull';
import { useProjects } from './useProjects';

// Focus is the screen opening: here, the hook mounting.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]),
}));
jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../db/projectsRepository', () => ({ getProjects: jest.fn() }));
jest.mock('../sync/pull', () => ({ pull: jest.fn() }));

const mockGetDatabase = getDatabase as jest.Mock;
const mockGetProjects = getProjects as jest.Mock;
const mockPull = pull as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDatabase.mockResolvedValue({});
  mockGetProjects.mockResolvedValue([{ id: 9, name: 'Cloud forest' }]);
});

async function opened() {
  const hook = await renderHook(() => useProjects());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook.result;
}

describe('syncing the projects', () => {
  it('reports a sync that was asked for and failed', async () => {
    mockPull.mockRejectedValue(new Error('offline'));
    const result = await opened();

    await act(async () => {
      expect(await result.current.sync()).toBe(false);
    });

    expect(result.current.error).toBe(true);
  });

  /** The cached projects are still there; Sync reports properly when pressed. */
  it('keeps a quiet sync’s failure to itself', async () => {
    mockPull.mockRejectedValue(new Error('offline'));
    const result = await opened();

    await act(async () => {
      expect(await result.current.sync({ quiet: true })).toBe(false);
    });

    expect(result.current.error).toBe(false);
    expect(result.current.projects).toEqual([{ id: 9, name: 'Cloud forest' }]);
  });

  it('shows what a quiet sync brought', async () => {
    mockPull.mockResolvedValue(undefined);
    const result = await opened();
    mockGetProjects.mockResolvedValue([
      { id: 9, name: 'Cloud forest' },
      { id: 12, name: 'Market plants' },
    ]);

    await act(async () => {
      expect(await result.current.sync({ quiet: true })).toBe(true);
    });

    expect(result.current.projects).toHaveLength(2);
  });
});
