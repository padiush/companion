import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import {
  countDiagnostics,
  deleteDiagnostics,
  insertDiagnostic,
  listPendingDiagnostics,
} from './diagnosticsRepository';
import type { DiagnosticRow } from './types';

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

function event(overrides: Partial<DiagnosticRow> = {}): DiagnosticRow {
  return {
    client_id: 'evt-1',
    code: 'plaintext_capture_retained',
    occurred_at: '2026-08-07T10:00:00.000Z',
    app_version: '1.0.0',
    platform: 'android',
    os_version: '34',
    ...overrides,
  };
}

describe('diagnosticsRepository', () => {
  it('stores an event and hands it back for reporting', async () => {
    await insertDiagnostic(db, event());

    const pending = await listPendingDiagnostics(db, 100);

    expect(pending).toEqual([
      expect.objectContaining({
        client_id: 'evt-1',
        code: 'plaintext_capture_retained',
        platform: 'android',
      }),
    ]);
  });

  it('keeps nullable device metadata as null rather than dropping the event', async () => {
    await insertDiagnostic(db, event({ app_version: null, platform: null, os_version: null }));

    const [row] = await listPendingDiagnostics(db, 100);

    expect(row).toMatchObject({ app_version: null, platform: null, os_version: null });
  });

  it('ignores a repeat of an event it already holds', async () => {
    await insertDiagnostic(db, event());
    await insertDiagnostic(db, event({ code: 'store_reset_unrecoverable' }));

    // Same client_id: the first write wins rather than raising or duplicating.
    expect(await countDiagnostics(db)).toBe(1);
    const [row] = await listPendingDiagnostics(db, 100);
    expect(row.code).toBe('plaintext_capture_retained');
  });

  it('reports oldest first so a backlog drains in order', async () => {
    await insertDiagnostic(db, event({ client_id: 'b', occurred_at: '2026-08-07T12:00:00.000Z' }));
    await insertDiagnostic(db, event({ client_id: 'a', occurred_at: '2026-08-05T09:00:00.000Z' }));
    await insertDiagnostic(db, event({ client_id: 'c', occurred_at: '2026-08-09T08:00:00.000Z' }));

    const pending = await listPendingDiagnostics(db, 100);

    expect(pending.map((row) => row.client_id)).toEqual(['a', 'b', 'c']);
  });

  it('caps a batch, leaving the rest for the next sync', async () => {
    for (let i = 0; i < 5; i++) {
      await insertDiagnostic(
        db,
        event({ client_id: `e-${i}`, occurred_at: `2026-08-0${i + 1}T00:00:00.000Z` })
      );
    }

    const pending = await listPendingDiagnostics(db, 2);

    expect(pending.map((row) => row.client_id)).toEqual(['e-0', 'e-1']);
    expect(await countDiagnostics(db)).toBe(5);
  });

  it('deletes only the events named, so unacknowledged ones are retried', async () => {
    await insertDiagnostic(db, event({ client_id: 'kept' }));
    await insertDiagnostic(db, event({ client_id: 'acked' }));

    await deleteDiagnostics(db, ['acked']);

    const pending = await listPendingDiagnostics(db, 100);
    expect(pending.map((row) => row.client_id)).toEqual(['kept']);
  });

  it('treats an empty acknowledgement as a no-op', async () => {
    await insertDiagnostic(db, event());

    await deleteDiagnostics(db, []);

    expect(await countDiagnostics(db)).toBe(1);
  });
});
