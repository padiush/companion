import { dimPath, HOLE_PADDING, placeCard, visibleHole } from './placement';

const screen = { width: 400, height: 800 };
const insets = { top: 40, bottom: 20 };

describe('visibleHole', () => {
  it('pads a control that is on screen', () => {
    expect(visibleHole({ x: 20, y: 200, width: 160, height: 100 }, screen, insets)).toEqual({
      x: 20 - HOLE_PADDING,
      y: 200 - HOLE_PADDING,
      width: 160 + HOLE_PADDING * 2,
      height: 100 + HOLE_PADDING * 2,
    });
  });

  it('leaves out a control that is not measured, or has no size', () => {
    expect(visibleHole(null, screen, insets)).toBeNull();
    expect(visibleHole({ x: 0, y: 200, width: 0, height: 40 }, screen, insets)).toBeNull();
  });

  it('leaves out a control scrolled above the status bar', () => {
    expect(visibleHole({ x: 20, y: 10, width: 160, height: 100 }, screen, insets)).toBeNull();
  });

  it('leaves out a control below the fold, or barely showing above it', () => {
    expect(visibleHole({ x: 20, y: 900, width: 160, height: 60 }, screen, insets)).toBeNull();
    expect(visibleHole({ x: 20, y: 760, width: 160, height: 60 }, screen, insets)).toBeNull();
  });

  it('cuts a tall control at the bottom edge rather than leaving it out', () => {
    const hole = visibleHole({ x: 20, y: 500, width: 160, height: 900 }, screen, insets);

    expect(hole?.y).toBe(500 - HOLE_PADDING);
    expect(hole && hole.y + hole.height).toBe(screen.height - insets.bottom);
  });
});

describe('placeCard', () => {
  it('puts the card under the control when it fits, centred on it', () => {
    const placement = placeCard({ x: 100, y: 100, width: 200, height: 60 }, 180, screen, insets);

    expect(placement.side).toBe('below');
    expect(placement.top).toBeGreaterThan(160);
    expect(placement.left + placement.width / 2).toBe(200);
  });

  it('puts it over the control when there is no room under it', () => {
    const placement = placeCard({ x: 100, y: 600, width: 200, height: 60 }, 180, screen, insets);

    expect(placement.side).toBe('above');
    expect(placement.top + 180).toBeLessThan(600);
  });

  it('pins it to the bottom edge when it fits on neither side', () => {
    const placement = placeCard({ x: 10, y: 100, width: 380, height: 560 }, 300, screen, insets);

    expect(placement.top + 300).toBeLessThanOrEqual(screen.height - insets.bottom);
    expect(placement.top).toBeGreaterThanOrEqual(insets.top);
  });

  it('keeps the card on screen and the arrow over a control near the edge', () => {
    const placement = placeCard({ x: 340, y: 100, width: 50, height: 50 }, 180, screen, insets);

    expect(placement.left).toBeGreaterThanOrEqual(16);
    expect(placement.left + placement.width).toBeLessThanOrEqual(screen.width - 16);
    expect(placement.left + placement.arrowLeft).toBeGreaterThan(300);
  });

  it('does not grow past a readable width on a wide screen', () => {
    const wide = { width: 1600, height: 900 };

    expect(placeCard({ x: 700, y: 100, width: 200, height: 60 }, 180, wide, insets).width).toBe(
      420
    );
  });
});

describe('dimPath', () => {
  it('covers the screen and cuts the hole out of it', () => {
    const path = dimPath(screen, { x: 10, y: 20, width: 100, height: 50 }, 18);

    expect(path.startsWith('M0 0H400V800H0Z')).toBe(true);
    // The corner radius is capped by the hole's own size.
    expect(path).toContain('M28 20');
  });
});
