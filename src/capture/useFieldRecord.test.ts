import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createTestDatabase, type TestDatabase } from '../../test-utils/sqliteDatabase';
import { readSession } from '../auth/session';
import { getDatabase } from '../db/database';
import {
  getFieldRecord,
  listFieldRecords,
  setFieldRecordSyncResult,
} from '../db/fieldRecordsRepository';
import { replacePermits } from '../db/permitsRepository';
import { emptyDraft } from './fieldRecord';
import { createFieldRecord } from './fieldRecordService';
import { captureLocation } from './location';
import { useFieldRecord } from './useFieldRecord';

jest.mock('../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../auth/session', () => ({ readSession: jest.fn() }));
jest.mock('./location', () => ({ captureLocation: jest.fn() }));

let mockNextId = 0;
jest.mock('../ids', () => ({ uuid: () => `fr-${++mockNextId}` }));

const mockGetDatabase = getDatabase as jest.Mock;
const mockReadSession = readSession as jest.Mock;
const mockCaptureLocation = captureLocation as jest.Mock;

const FIX = { lat: 13.70123, lng: -89.20345, accuracyM: 8, capturedAt: '2026-10-04T10:00:00Z' };

let db: TestDatabase;

beforeEach(async () => {
  jest.clearAllMocks();
  db = await createTestDatabase();
  mockGetDatabase.mockResolvedValue(db);
  mockReadSession.mockResolvedValue({
    user: { id: 1, name: 'M. Menéndez', email: 'm@example.org' },
    verifiedAt: '2026-10-04T00:00:00Z',
  });
  mockCaptureLocation.mockResolvedValue(FIX);
});

afterEach(async () => {
  await db.closeAsync();
});

async function openNew() {
  const hook = await renderHook(() => useFieldRecord(9));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('a new record', () => {
  it('fills in the collector, today and the device’s position without storing anything', async () => {
    const { result } = await openNew();

    await waitFor(() =>
      expect(result.current.draft?.location).toEqual({ lat: 13.70123, lng: -89.20345 })
    );
    expect(result.current.draft?.collector).toBe('M. Menéndez');
    expect(result.current.draft?.collectedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.current.stored).toBe(false);
    expect(await listFieldRecords(db, 9)).toHaveLength(0);
  });

  it('is stored by the first edit, with the defaults and the fix it already had', async () => {
    const { result } = await openNew();
    await waitFor(() => expect(result.current.draft?.location).not.toBeNull());

    await act(async () => result.current.update({ vernacularName: 'guaba' }));
    await waitFor(() => expect(result.current.saving).toBe(false));

    const [stored] = await listFieldRecords(db, 9);
    expect(stored).toMatchObject({
      vernacular_name: 'guaba',
      collector: 'M. Menéndez',
      location_lat: 13.70123,
      location_lng: -89.20345,
      sync_status: 'draft',
    });
    expect(result.current.stored).toBe(true);
  });

  /** The first write mints the id every later write needs; quick edits must not race it. */
  it('keeps quick successive edits to one record, ending with the last of them', async () => {
    const { result } = await openNew();

    await act(async () => {
      result.current.update({ vernacularName: 'g' });
      result.current.update({ vernacularName: 'gu' });
      result.current.update({ vernacularName: 'guaba' });
    });
    await waitFor(() => expect(result.current.saving).toBe(false));

    const records = await listFieldRecords(db, 9);
    expect(records).toHaveLength(1);
    expect(records[0].vernacular_name).toBe('guaba');
  });

  it('is stored when someone asks for the position, even before anything else', async () => {
    mockCaptureLocation.mockResolvedValueOnce(null);
    const { result } = await openNew();
    await waitFor(() => expect(result.current.locationFailed).toBe(true));

    await act(async () => result.current.locate());
    await waitFor(() => expect(result.current.saving).toBe(false));

    const [stored] = await listFieldRecords(db, 9);
    expect(stored.location_lat).toBe(13.70123);
    expect(result.current.locationFailed).toBe(false);
  });

  it('says the fix failed rather than waiting for one forever', async () => {
    mockCaptureLocation.mockResolvedValue(null);
    const { result } = await openNew();

    await waitFor(() => expect(result.current.locationFailed).toBe(true));
    expect(result.current.locating).toBe(false);
    expect(result.current.draft?.location).toBeNull();
  });
});

describe('a stored record', () => {
  async function store(overrides = {}) {
    return createFieldRecord(db, 9, {
      ...emptyDraft({ collector: 'R. Arévalo', today: '2026-10-01' }),
      vernacularName: 'guaba',
      location: { lat: 1, lng: 2 },
      ...overrides,
    });
  }

  it('reopens with what was recorded, keeping the coordinate it was captured with', async () => {
    const clientId = await store();

    const { result } = await renderHook(() => useFieldRecord(9, clientId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.draft).toMatchObject({
      vernacularName: 'guaba',
      location: { lat: 1, lng: 2 },
    });
    expect(result.current.stored).toBe(true);
    expect(mockCaptureLocation).not.toHaveBeenCalled();
  });

  it('saves edits to the same row and puts it back in the outbox', async () => {
    const clientId = await store();
    await setFieldRecordSyncResult(db, clientId, {
      status: 'rejected',
      error: 'api.sync.permit_not_in_project',
    });

    const { result } = await renderHook(() => useFieldRecord(9, clientId));
    await waitFor(() => expect(result.current.syncStatus).toBe('rejected'));

    await act(async () => result.current.update({ permitId: null, exemption: 'market' }));
    await waitFor(() => expect(result.current.saving).toBe(false));

    expect(result.current.syncStatus).toBe('draft');
    expect(result.current.syncError).toBeNull();
    expect(await getFieldRecord(db, clientId)).toMatchObject({
      permit_exemption: 'market',
      sync_status: 'draft',
    });
    expect(await listFieldRecords(db, 9)).toHaveLength(1);
  });

  /** Once the server holds it, the web identifies and deposits it; this copy may not drift. */
  it('cannot be edited once sent', async () => {
    const clientId = await store();
    await setFieldRecordSyncResult(db, clientId, { status: 'synced', serverId: 41 });

    const { result } = await renderHook(() => useFieldRecord(9, clientId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.readOnly).toBe(true);
    await act(async () => {
      result.current.update({ vernacularName: 'something else' });
      result.current.locate();
    });

    expect(result.current.draft?.vernacularName).toBe('guaba');
    expect((await getFieldRecord(db, clientId))?.vernacular_name).toBe('guaba');
    expect(mockCaptureLocation).not.toHaveBeenCalled();
  });

  it('starts a new record when the one asked for is not on the device', async () => {
    const { result } = await renderHook(() => useFieldRecord(9, 'gone'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.stored).toBe(false);
    await act(async () => result.current.update({ vernacularName: 'guaba' }));
    await waitFor(() => expect(result.current.saving).toBe(false));

    const records = await listFieldRecords(db, 9);
    expect(records).toHaveLength(1);
    expect(records[0].client_id).not.toBe('gone');
  });
});

it('offers the permits cached for the project', async () => {
  await replacePermits(db, 9, [
    { id: 5, authority: 'MARN', reference: 'AIMA-2026-014', issued_on: null, expires_on: null },
  ]);

  const { result } = await openNew();

  expect(result.current.permits.map((permit) => permit.id)).toEqual([5]);
});

describe('storing on demand, for a photograph', () => {
  /** For an observation, the photograph is often the first thing captured. */
  it('stores a new record and resolves its id, once', async () => {
    const { result } = await openNew();

    let first: string | null = null;
    let second: string | null = null;
    await act(async () => {
      first = await result.current.ensureStored();
      second = await result.current.ensureStored();
    });

    expect(first).toBe(second);
    expect(await listFieldRecords(db, 9)).toHaveLength(1);
    expect(result.current.clientId).toBe(first);
    expect(result.current.stored).toBe(true);
  });

  it('stores nothing for a record that can no longer change', async () => {
    const clientId = await createFieldRecord(
      db,
      9,
      emptyDraft({ collector: 'R. Arévalo', today: '2026-10-01' })
    );
    await setFieldRecordSyncResult(db, clientId, { status: 'synced', serverId: 41 });

    const { result } = await renderHook(() => useFieldRecord(9, clientId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resolved: string | null = 'unset';
    await act(async () => {
      resolved = await result.current.ensureStored();
    });

    expect(resolved).toBeNull();
  });
});

describe('a record made from an interview answer', () => {
  async function openFromAnswer(vernacularName?: string) {
    const hook = await renderHook(() =>
      useFieldRecord(9, undefined, { answerClientId: 'ans-1', vernacularName })
    );
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
  }

  it('starts from the name the informant gave, without storing anything yet', async () => {
    const { result } = await openFromAnswer('  manzanilla ');

    expect(result.current.draft?.vernacularName).toBe('manzanilla');
    expect(result.current.fromAnswer).toBe(true);
    expect(result.current.stored).toBe(false);
    expect(await listFieldRecords(db, 9)).toHaveLength(0);
  });

  it('keeps the name within what the server accepts', async () => {
    const { result } = await openFromAnswer('m'.repeat(300));

    expect(result.current.draft?.vernacularName).toHaveLength(255);
  });

  it('is stored linked to the answer it came out of', async () => {
    const { result } = await openFromAnswer('manzanilla');

    await act(async () => result.current.update({ basis: 'human_observation' }));
    await waitFor(() => expect(result.current.saving).toBe(false));

    const [stored] = await listFieldRecords(db, 9);
    expect(stored).toMatchObject({
      answer_client_id: 'ans-1',
      vernacular_name: 'manzanilla',
      basis_of_record: 'human_observation',
    });
  });

  it('says so when reopened', async () => {
    const clientId = await createFieldRecord(
      db,
      9,
      emptyDraft({ collector: 'M. Menéndez', today: '2026-10-04' }),
      'ans-1'
    );

    const hook = await renderHook(() => useFieldRecord(9, clientId));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    expect(hook.result.current.fromAnswer).toBe(true);
  });

  it('a record made on its own says nothing of the kind', async () => {
    const { result } = await openNew();

    expect(result.current.fromAnswer).toBe(false);
  });
});
