import { forgetSeenTours, readSeenTours, writeSeenTours } from './tipsSeen';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

beforeEach(() => mockStore.clear());

describe('the tours seen on this device', () => {
  it('are none until some are recorded', async () => {
    expect([...(await readSeenTours(7))]).toEqual([]);

    await writeSeenTours(7, new Set(['home', 'outbox']));

    expect([...(await readSeenTours(7))]).toEqual(['home', 'outbox']);
  });

  it('are kept per account', async () => {
    await writeSeenTours(7, new Set(['home']));

    expect([...(await readSeenTours(8))]).toEqual([]);
  });

  it('can be forgotten, so every tour runs again', async () => {
    await writeSeenTours(7, new Set(['home']));

    await forgetSeenTours(7);

    expect([...(await readSeenTours(7))]).toEqual([]);
  });

  it('drop a tour this version no longer has, and survive a damaged value', async () => {
    mockStore.set('padiush.tips.seen.7', JSON.stringify(['home', 'retired']));
    expect([...(await readSeenTours(7))]).toEqual(['home']);

    mockStore.set('padiush.tips.seen.7', '{not json');
    expect([...(await readSeenTours(7))]).toEqual([]);
  });
});
