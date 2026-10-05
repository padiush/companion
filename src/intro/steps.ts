import type { IconName } from '../ui/Icon';

/**
 * The first-run walkthrough, in order: what the app is for, then the three
 * tabs, in the order the work happens. Each step's words are
 * `intro.<key>.title` and `.body` in the locale files.
 */
export const INTRO_STEPS: readonly { key: string; icon: IconName }[] = [
  { key: 'welcome', icon: 'location' },
  { key: 'interviews', icon: 'interview' },
  { key: 'records', icon: 'record' },
  { key: 'outbox', icon: 'send' },
];
