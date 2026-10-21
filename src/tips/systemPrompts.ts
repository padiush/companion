/**
 * Whether the app is waiting on a system prompt it asked for itself — the
 * location permission an interview or a record asks for as it opens. A tip
 * that started then would sit behind the prompt and point at a screen the
 * person cannot reach yet, so the tips wait until it is answered.
 *
 * Prompts that follow a tap (camera, microphone) need no guard: a tour covers
 * the screen, so nothing under it can be tapped while one runs.
 */
let pending = 0;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

/** Run `ask` with the tips held back until it settles, however it settles. */
export async function whilePrompting<T>(ask: () => Promise<T>): Promise<T> {
  pending += 1;
  notify();
  try {
    return await ask();
  } finally {
    pending -= 1;
    notify();
  }
}

export function isPrompting(): boolean {
  return pending > 0;
}

export function subscribePrompting(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
