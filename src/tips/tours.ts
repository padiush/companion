/**
 * The interactive tips, one tour per screen, each step pointing at a control
 * on that screen. A tour runs the first time its screen is reached, once per
 * account on this device; the intro sheet stays the overview, and these show
 * where things are.
 *
 * A step's control registers itself as the anchor `<tour>.<step>` (see
 * `TipAnchor`), and its words are `tips.<tour>.<step>.title` and `.body` in
 * the locale files. Steps are listed top to bottom, the order the eye reads
 * the screen in. A step whose control is not on screen when the tour starts
 * is left out of that run.
 */
export const TOURS = {
  home: ['newInterview', 'newRecord', 'sync'],
  project: ['forms'],
  interview: ['recorder', 'questions', 'addSet'],
  records: ['project'],
  fieldRecord: ['basis', 'media'],
  outbox: ['send', 'waiting'],
} as const satisfies Record<string, readonly string[]>;

export type TourId = keyof typeof TOURS;

export const TOUR_IDS = Object.keys(TOURS) as TourId[];

/** The anchor id a step's control registers under. */
export function anchorId(tour: TourId, step: string): string {
  return `${tour}.${step}`;
}
