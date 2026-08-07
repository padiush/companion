import { sweepCaptureCache } from '../capture/sweepCaptureCache';
import { getDatabase, resetDatabase } from '../db/database';
import { claimOwner, countPendingWork, readOwner, type PendingWork } from '../db/ownership';
import { recordDiagnostic } from '../diagnostics';

/**
 * Binds the local store to one account.
 *
 * A device belongs to one researcher at a time. Rather than partitioning every
 * table by owner, a different account signing in destroys the store: the
 * capture tables carry no owner column, so a second researcher would otherwise
 * open the first one's cached projects, forms, interviews, answers and media.
 *
 * Signing out deliberately does NOT wipe — the same researcher must be able to
 * sign back in and still hold their unsent work, including with no signal.
 */

/** Thrown when the user declines to give up another account's unsent work. */
export class SignInCancelled extends Error {
  constructor() {
    super('Sign-in cancelled: the local store was not replaced.');
    this.name = 'SignInCancelled';
  }
}

export type StoreDecision =
  /** No owner recorded — an empty store, or one from before ownership existed. */
  | { action: 'adopt' }
  /** Already this account's store. */
  | { action: 'keep' }
  /** Another account's store; taking it over destroys `pending`. */
  | { action: 'replace'; pending: PendingWork };

/** What signing this account in would do to the local store, without doing it. */
export async function inspectStore(userId: number): Promise<StoreDecision> {
  const db = await getDatabase();
  const owner = await readOwner(db);

  if (owner === null) {
    return { action: 'adopt' };
  }

  if (owner === userId) {
    return { action: 'keep' };
  }

  return { action: 'replace', pending: await countPendingWork(db) };
}

/**
 * Destroy the previous account's store and start a clean one for this account.
 * The capture cache is swept too: those are the plaintext temp files the camera
 * and recorder spool into, which belong to the outgoing account's interviews.
 */
export async function replaceStore(userId: number): Promise<void> {
  await resetDatabase();
  sweepCaptureCache();
  await claimStore(userId);
}

/** Record this account as the store's owner. */
export async function claimStore(userId: number): Promise<void> {
  const db = await getDatabase();
  await claimOwner(db, userId);
}

/**
 * Settle ownership for a session that is already established — a restored one,
 * where there are no credentials being offered and so nothing to confirm.
 *
 * An unowned store is adopted, which is how devices upgrading from before this
 * existed keep their unsent work: the first launch after the upgrade stamps
 * whoever is signed in. A store owned by someone else cannot be reached this
 * way (signing in always settles ownership first), so if it happens an earlier
 * switch was interrupted — and showing this account another's informant data is
 * the exact failure being prevented, so the store goes.
 */
export async function settleRestoredStore(userId: number): Promise<void> {
  const decision = await inspectStore(userId);

  if (decision.action === 'keep') {
    return;
  }

  if (decision.action === 'adopt') {
    await claimStore(userId);
    return;
  }

  // Reachable only if an earlier switch was interrupted, and it destroys
  // whatever the previous account had not sent, so it is worth knowing that a
  // path we believe unreachable is being reached.
  await recordDiagnostic('store_reset_foreign_account');
  await replaceStore(userId);
}
