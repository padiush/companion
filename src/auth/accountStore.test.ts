import { sweepCaptureCache } from '../capture/sweepCaptureCache';
import { getDatabase, resetDatabase } from '../db/database';
import { claimOwner, countPendingWork, readOwner } from '../db/ownership';
import { recordDiagnostic } from '../diagnostics';
import { claimStore, inspectStore, replaceStore, settleRestoredStore } from './accountStore';

jest.mock('../db/database', () => ({ getDatabase: jest.fn(), resetDatabase: jest.fn() }));
jest.mock('../db/ownership', () => ({
  readOwner: jest.fn(),
  claimOwner: jest.fn(),
  countPendingWork: jest.fn(),
}));
jest.mock('../capture/sweepCaptureCache', () => ({ sweepCaptureCache: jest.fn() }));
jest.mock('../diagnostics', () => ({ recordDiagnostic: jest.fn().mockResolvedValue(undefined) }));

const mockGetDatabase = getDatabase as jest.Mock;
const mockReadOwner = readOwner as jest.Mock;
const mockCountPendingWork = countPendingWork as jest.Mock;

const db = {};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDatabase.mockResolvedValue(db);
  mockCountPendingWork.mockResolvedValue({ interviews: 0, media: 0 });
});

describe('inspectStore', () => {
  it('adopts a store with no recorded owner', async () => {
    mockReadOwner.mockResolvedValue(null);

    await expect(inspectStore(7)).resolves.toEqual({ action: 'adopt' });
  });

  it('keeps the store when it already belongs to this account', async () => {
    mockReadOwner.mockResolvedValue(7);

    await expect(inspectStore(7)).resolves.toEqual({ action: 'keep' });
  });

  it('reports what a takeover would destroy', async () => {
    mockReadOwner.mockResolvedValue(3);
    mockCountPendingWork.mockResolvedValue({ interviews: 2, media: 5 });

    await expect(inspectStore(7)).resolves.toEqual({
      action: 'replace',
      pending: { interviews: 2, media: 5 },
    });
  });

  it('does not touch the store while only inspecting it', async () => {
    mockReadOwner.mockResolvedValue(3);

    await inspectStore(7);

    expect(resetDatabase).not.toHaveBeenCalled();
    expect(claimOwner).not.toHaveBeenCalled();
  });
});

describe('replaceStore', () => {
  it('destroys the store, sweeps the capture cache, then claims it', async () => {
    mockReadOwner.mockResolvedValue(null);

    await replaceStore(7);

    expect(resetDatabase).toHaveBeenCalled();
    // The camera and recorder spool plaintext temp files; they belong to the
    // outgoing account's interviews and must not survive the switch.
    expect(sweepCaptureCache).toHaveBeenCalled();
    expect(claimOwner).toHaveBeenCalledWith(db, 7);
  });

  it('claims the store only after it has been destroyed', async () => {
    const order: string[] = [];
    (resetDatabase as jest.Mock).mockImplementation(async () => void order.push('reset'));
    (claimOwner as jest.Mock).mockImplementation(async () => void order.push('claim'));

    await replaceStore(7);

    expect(order).toEqual(['reset', 'claim']);
  });
});

describe('claimStore', () => {
  it('records the owner without destroying anything', async () => {
    await claimStore(7);

    expect(claimOwner).toHaveBeenCalledWith(db, 7);
    expect(resetDatabase).not.toHaveBeenCalled();
  });
});

describe('settleRestoredStore', () => {
  /**
   * The upgrade path: a device already in use has data but no recorded owner,
   * and the first launch after the upgrade must adopt it rather than treat it
   * as a stranger's and wipe the user's unsent work.
   */
  it('adopts an unowned store, keeping work from before ownership existed', async () => {
    mockReadOwner.mockResolvedValue(null);
    mockCountPendingWork.mockResolvedValue({ interviews: 4, media: 0 });

    await settleRestoredStore(7);

    expect(claimOwner).toHaveBeenCalledWith(db, 7);
    expect(resetDatabase).not.toHaveBeenCalled();
  });

  it('does nothing when the store already belongs to this account', async () => {
    mockReadOwner.mockResolvedValue(7);

    await settleRestoredStore(7);

    expect(claimOwner).not.toHaveBeenCalled();
    expect(resetDatabase).not.toHaveBeenCalled();
  });

  /**
   * Unreachable through the sign-in flow, which settles ownership before the
   * session exists. Getting here means an earlier switch was interrupted, and
   * showing this account another's informant data is the failure being
   * prevented — so the store goes, loudly.
   */
  it('resets a store belonging to someone else', async () => {
    mockReadOwner.mockResolvedValue(3);

    await settleRestoredStore(7);

    expect(resetDatabase).toHaveBeenCalled();
    expect(claimOwner).toHaveBeenCalledWith(db, 7);
    // A path believed unreachable was reached, and it destroyed whatever the
    // previous account had not sent. Reportable rather than merely logged.
    expect(recordDiagnostic).toHaveBeenCalledWith('store_reset_foreign_account');
  });
});
