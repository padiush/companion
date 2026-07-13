import * as Haptics from 'expo-haptics';

/**
 * Thin, fail-safe wrappers around expo-haptics for eyes-off field use. Every
 * call is guarded: haptics are a non-essential nicety, and the native module is
 * absent until the dev client is rebuilt — a missing module must never break the
 * interaction that triggered it.
 */

function run(effect: () => Promise<void>): void {
  try {
    void effect().catch(() => {});
  } catch {
    // Native module unavailable (e.g. dev client not yet rebuilt) — ignore.
  }
}

/** A light tick, for selecting a choice chip. */
export function selectionTick(): void {
  run(() => Haptics.selectionAsync());
}

/** A firmer bump, for starting or stopping a recording. */
export function impact(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}
