import type { SQLiteDatabase } from 'expo-sqlite';

import { describeLastSync, recordSyncSuccess } from './lastSync';

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as never;

const now = new Date('2026-10-05T12:00:00Z');
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000);

describe('describeLastSync', () => {
  it('says so when the device has never synced', () => {
    expect(describeLastSync(null, t, 'es', now)).toBe('home.neverSynced');
  });

  it('counts minutes, then hours, then names the day', () => {
    expect(describeLastSync(ago(0.5), t, 'es', now)).toBe('home.syncedJustNow');
    expect(describeLastSync(ago(5), t, 'es', now)).toBe('home.syncedMinutes:{"count":5}');
    expect(describeLastSync(ago(150), t, 'es', now)).toBe('home.syncedHours:{"count":2}');
    expect(describeLastSync(ago(60 * 30), t, 'es', now)).toMatch(/^home\.syncedOn:/);
  });
});

describe('recordSyncSuccess', () => {
  /** Writing down when it happened must not turn a working sync into a failed one. */
  it('never throws, even when the store cannot be written', async () => {
    const db = {
      runAsync: jest.fn().mockRejectedValue(new Error('locked')),
    } as unknown as SQLiteDatabase;

    await expect(recordSyncSuccess(db)).resolves.toBeUndefined();
  });
});
