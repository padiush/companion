import { hasSeenIntro, markIntroSeen } from './introSeen';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
}));

beforeEach(() => mockStore.clear());

describe('the walkthrough seen on this device', () => {
  it('is unseen until it is marked', async () => {
    await expect(hasSeenIntro(7)).resolves.toBe(false);

    await markIntroSeen(7);

    await expect(hasSeenIntro(7)).resolves.toBe(true);
  });

  /** A shared device: someone new signing in has not seen it. */
  it('is kept per account', async () => {
    await markIntroSeen(7);

    await expect(hasSeenIntro(8)).resolves.toBe(false);
  });
});
