/** dBFS below which the input counts as silence for the waveform. */
const SILENCE_FLOOR_DB = -60;

/**
 * Map a recorder metering reading (dBFS, ≤ 0) to a 0–1 bar height for the
 * waveform. Silence and missing readings (metering is optional, and absent on
 * devices without a live level, e.g. the simulator) map to 0.
 */
export function meteringToLevel(metering: number | undefined | null): number {
  if (metering == null || Number.isNaN(metering)) {
    return 0;
  }
  if (metering >= 0) {
    return 1;
  }
  if (metering <= SILENCE_FLOOR_DB) {
    return 0;
  }
  return (metering - SILENCE_FLOOR_DB) / -SILENCE_FLOOR_DB;
}

/** Format a duration in milliseconds as `M:SS` (minutes are not zero-padded). */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
