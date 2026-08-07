import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import { api } from '../api/client';
import {
  countDiagnostics,
  insertDiagnostic,
  listPendingDiagnostics,
} from '../db/diagnosticsRepository';
import type { DiagnosticRow } from '../db/types';
import { pushDiagnostics } from './pushDiagnostics';

jest.mock('../api/client', () => ({
  api: { reportDiagnostics: jest.fn() },
}));

const mockReport = api.reportDiagnostics as jest.Mock;

let db: TestDatabase;

beforeEach(async () => {
  jest.clearAllMocks();
  db = await createTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

function event(overrides: Partial<DiagnosticRow> = {}): DiagnosticRow {
  return {
    client_id: 'evt-1',
    code: 'store_reset_unrecoverable',
    occurred_at: '2026-08-07T10:00:00.000Z',
    app_version: '1.0.0',
    platform: 'android',
    os_version: '34',
    ...overrides,
  };
}

describe('pushDiagnostics', () => {
  it('does not call the API when there is nothing queued', async () => {
    const summary = await pushDiagnostics(db);

    expect(summary).toEqual({ reported: 0, failed: false });
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('reports queued events and clears the acknowledged ones', async () => {
    await insertDiagnostic(db, event({ client_id: 'a' }));
    await insertDiagnostic(db, event({ client_id: 'b' }));
    mockReport.mockResolvedValue({ accepted: ['a', 'b'] });

    const summary = await pushDiagnostics(db);

    expect(mockReport).toHaveBeenCalledWith({
      events: [
        expect.objectContaining({ client_id: 'a', code: 'store_reset_unrecoverable' }),
        expect.objectContaining({ client_id: 'b' }),
      ],
    });
    expect(summary).toEqual({ reported: 2, failed: false });
    expect(await countDiagnostics(db)).toBe(0);
  });

  it('keeps an event the server did not acknowledge', async () => {
    await insertDiagnostic(db, event({ client_id: 'a' }));
    await insertDiagnostic(db, event({ client_id: 'b' }));
    mockReport.mockResolvedValue({ accepted: ['a'] });

    const summary = await pushDiagnostics(db);

    expect(summary.reported).toBe(1);
    const pending = await listPendingDiagnostics(db, 100);
    expect(pending.map((row) => row.client_id)).toEqual(['b']);
  });

  it('sends no field that could carry what an informant said', async () => {
    await insertDiagnostic(db, event());
    mockReport.mockResolvedValue({ accepted: ['evt-1'] });

    await pushDiagnostics(db);

    // The wire shape is the guarantee: if a free-text member ever appears
    // here, the reason this endpoint exists instead of a vendor is gone.
    const [sent] = mockReport.mock.calls[0][0].events;
    expect(Object.keys(sent).sort()).toEqual([
      'app_version',
      'client_id',
      'code',
      'occurred_at',
      'os_version',
      'platform',
    ]);
  });

  it('leaves everything queued when the report fails', async () => {
    await insertDiagnostic(db, event());
    mockReport.mockRejectedValue(new Error('offline'));

    const summary = await pushDiagnostics(db);

    // Reported nowhere, but not lost — a failed report must not also cost the
    // record of what happened.
    expect(summary).toEqual({ reported: 0, failed: true });
    expect(await countDiagnostics(db)).toBe(1);
  });

  it('never throws, so a failed report cannot fail the sync around it', async () => {
    await insertDiagnostic(db, event());
    mockReport.mockRejectedValue(new Error('500'));

    await expect(pushDiagnostics(db)).resolves.toEqual({ reported: 0, failed: true });
  });

  it('ignores ids in the response that were not in the batch', async () => {
    await insertDiagnostic(db, event({ client_id: 'a' }));
    mockReport.mockResolvedValue({ accepted: ['a', 'never-sent'] });

    const summary = await pushDiagnostics(db);

    expect(summary.reported).toBe(1);
    expect(await countDiagnostics(db)).toBe(0);
  });

  it('survives a response with no accepted list', async () => {
    await insertDiagnostic(db, event());
    mockReport.mockResolvedValue({});

    const summary = await pushDiagnostics(db);

    expect(summary).toEqual({ reported: 0, failed: false });
    expect(await countDiagnostics(db)).toBe(1);
  });

  it('sends at most one batch, leaving a backlog for the next sync', async () => {
    for (let i = 0; i < 120; i++) {
      await insertDiagnostic(
        db,
        event({
          client_id: `e-${String(i).padStart(3, '0')}`,
          occurred_at: `2026-08-07T10:00:${String(i % 60).padStart(2, '0')}.000Z`,
        })
      );
    }
    mockReport.mockImplementation(({ events }) => ({
      accepted: events.map((e: { client_id: string }) => e.client_id),
    }));

    const summary = await pushDiagnostics(db);

    expect(summary.reported).toBe(100);
    expect(await countDiagnostics(db)).toBe(20);
  });
});
