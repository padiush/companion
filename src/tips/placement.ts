/** A box on screen, in the window's coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  bottom: number;
}

/** Room left between the highlight and the control it rings. */
export const HOLE_PADDING = 6;
/** The gap between the highlight and the card. */
const GAP = 14;
/** The card never comes closer than this to the screen's edges. */
const MARGIN = 16;
/** Widest the card gets, on a tablet or an unfolded phone. */
const MAX_CARD_WIDTH = 420;
/** The arrow's side, and how far it stays from the card's corners. */
export const ARROW = 16;
const ARROW_INSET = 22;
/** Less of a control than this showing, and it is not worth pointing at. */
const MIN_VISIBLE = 44;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * The part of a control worth highlighting, or null when it is not on
 * screen: its top must be in view, below the status bar, with enough of it
 * showing to be recognisable above the system's bottom edge. A long control
 * (a whole recorder card) is cut at that edge rather than ruled out.
 */
export function visibleHole(target: Rect | null, screen: Size, insets: Insets): Rect | null {
  if (!target || target.width <= 0 || target.height <= 0) {
    return null;
  }

  const floor = screen.height - insets.bottom;
  if (target.y < insets.top || target.y + Math.min(target.height, MIN_VISIBLE) > floor) {
    return null;
  }

  const top = target.y - HOLE_PADDING;
  const bottom = Math.min(target.y + target.height + HOLE_PADDING, floor);
  return {
    x: target.x - HOLE_PADDING,
    y: top,
    width: target.width + HOLE_PADDING * 2,
    height: bottom - top,
  };
}

export interface CardPlacement {
  left: number;
  top: number;
  width: number;
  /** Which side of the highlight the card sits on; the arrow points back at it. */
  side: 'below' | 'above';
  /** The arrow's offset from the card's left edge. */
  arrowLeft: number;
}

/**
 * Where the card goes: under the highlight when it fits, over it when not,
 * and pinned to the bottom edge as a last resort (it then covers part of a
 * very tall control, which is still better than going off screen). The card
 * is centred on the control as far as the screen's edges allow.
 */
export function placeCard(
  hole: Rect,
  cardHeight: number,
  screen: Size,
  insets: Insets
): CardPlacement {
  const width = Math.min(screen.width - MARGIN * 2, MAX_CARD_WIDTH);
  const centre = hole.x + hole.width / 2;
  const left = clamp(centre - width / 2, MARGIN, screen.width - MARGIN - width);
  const arrowLeft = clamp(centre - left - ARROW / 2, ARROW_INSET, width - ARROW_INSET - ARROW);

  const below = hole.y + hole.height + GAP;
  const floor = screen.height - insets.bottom - MARGIN;
  if (below + cardHeight <= floor) {
    return { left, top: below, width, side: 'below', arrowLeft };
  }

  const above = hole.y - GAP - cardHeight;
  if (above >= insets.top + MARGIN) {
    return { left, top: above, width, side: 'above', arrowLeft };
  }

  return { left, top: floor - cardHeight, width, side: 'below', arrowLeft };
}

/**
 * The dimmed layer as one SVG path: the whole screen, with the highlight cut
 * out of it as a rounded rectangle (drawn with the even-odd rule).
 */
export function dimPath(screen: Size, hole: Rect, radius: number): string {
  const r = Math.min(radius, hole.width / 2, hole.height / 2);
  const { x, y, width: w, height: h } = hole;
  return [
    `M0 0H${screen.width}V${screen.height}H0Z`,
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`,
  ].join('');
}
