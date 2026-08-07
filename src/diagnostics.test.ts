import { createTestDatabase, type TestDatabase } from '../test-utils/sqliteDatabase';
import { countDiagnostics, listPendingDiagnostics } from './db/diagnosticsRepository';
import {
  attachDiagnosticsStore,
  bufferedDiagnosticCount,
  detachDiagnosticsStore,
  recordDiagnostic,
  resetDiagnosticsForTest,
} from './diagnostics';

jest.mock('./ids', () => {
  let next = 0;
  return { uuid: () => `evt-${next++}` };
});

let db: TestDatabase;

beforeEach(async () => {
  resetDiagnosticsForTest();
  db = await createTestDatabase();
});

afterEach(async () => {
  resetDiagnosticsForTest();
  await db.closeAsync();
});

describe('recordDiagnostic', () => {
  it('writes straight through once a store is attached', async () => {
    attachDiagnosticsStore(db);

    await recordDiagnostic('plaintext_capture_retained');

    const [row] = await listPendingDiagnostics(db, 100);
    expect(row).toMatchObject({ code: 'plaintext_capture_retained' });
    expect(bufferedDiagnosticCount()).toBe(0);
  });

  it('holds an event raised before any store exists, then persists it', async () => {
    // The case that forced the buffer: the store is being deleted, so there is
    // nowhere to write the very event that says so.
    await recordDiagnostic('store_reset_unrecoverable');

    expect(bufferedDiagnosticCount()).toBe(1);
    expect(await countDiagnostics(db)).toBe(0);

    attachDiagnosticsStore(db);
    // attach drains in the background; let the microtask queue settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(await countDiagnostics(db)).toBe(1);
    expect(bufferedDiagnosticCount()).toBe(0);
  });

  it('keeps buffered events in the order they happened', async () => {
    await recordDiagnostic('store_reset_unrecoverable');
    await recordDiagnostic('capture_cache_sweep_failed');

    attachDiagnosticsStore(db);
    await Promise.resolve();
    await Promise.resolve();

    const pending = await listPendingDiagnostics(db, 100);
    expect(pending.map((row) => row.code)).toEqual([
      'store_reset_unrecoverable',
      'capture_cache_sweep_failed',
    ]);
  });

  it('stops buffering rather than growing without bound', async () => {
    for (let i = 0; i < 60; i++) {
      await recordDiagnostic('capture_cache_sweep_failed');
    }

    expect(bufferedDiagnosticCount()).toBe(50);
  });

  it('buffers again after the store it was writing to goes away', async () => {
    attachDiagnosticsStore(db);
    await recordDiagnostic('plaintext_capture_retained');

    detachDiagnosticsStore();
    await recordDiagnostic('store_reset_foreign_account');

    expect(bufferedDiagnosticCount()).toBe(1);
    // The first event is still in the store it was written to.
    expect(await countDiagnostics(db)).toBe(1);
  });

  it('never throws when the store rejects the write', async () => {
    // Every caller is already handling a failure; reporting must not add one.
    const broken = {
      runAsync: jest.fn().mockRejectedValue(new Error('disk I/O error')),
    } as unknown as TestDatabase;
    attachDiagnosticsStore(broken);

    await expect(recordDiagnostic('store_reset_unrecoverable')).resolves.toBeUndefined();

    // Kept, not dropped — it is retried when a working store appears.
    expect(bufferedDiagnosticCount()).toBe(1);
  });

  it('records the build and platform so a spike can be traced to one', async () => {
    attachDiagnosticsStore(db);

    await recordDiagnostic('store_reset_unrecoverable');

    const [row] = await listPendingDiagnostics(db, 100);
    // jest-expo runs as iOS; the point is that these are populated at all.
    expect(row.platform).toBe('ios');
    expect(row.occurred_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
