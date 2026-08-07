import { radius, space, themes, type Theme } from './theme';

/**
 * Contrast is a property of the palette, so it is checked here rather than
 * left to be noticed on a screen. The web's own palette drifted out of
 * compliance once and nothing caught it; these are the guarantees the app
 * depends on, written down.
 *
 * Thresholds are WCAG 2.1: 4.5:1 for body text (1.4.3), 3:1 for the boundary
 * of a user-interface component (1.4.11).
 */

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe.each(Object.entries(themes))('the %s palette', (_name, theme: Theme) => {
  it('reads body text against every surface', () => {
    for (const surface of [theme.bg, theme.card, theme.inputBg, theme.chip]) {
      expect(contrast(theme.text, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * This is what carries every required marker and validation message. The web
   * darkened its own error colour for exactly this reason; the app had kept the
   * pre-fix value.
   */
  it('reads danger text against the surfaces it appears on', () => {
    for (const surface of [theme.bg, theme.card]) {
      expect(contrast(theme.danger, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reads the primary action’s label on the primary fill', () => {
    expect(contrast(theme.onPrimary, theme.primary)).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * Selecting chips is the main interaction on the interview screen, and this
   * app gets used outdoors. An unselected chip has to be visibly a target.
   */
  it('draws an unselected chip’s edge against both its fill and the page', () => {
    expect(contrast(theme.chipBorder, theme.chip)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme.chipBorder, theme.bg)).toBeGreaterThanOrEqual(3);
  });

  it('separates a chip’s surface from the page behind it', () => {
    expect(contrast(theme.chip, theme.bg)).toBeGreaterThan(1.1);
  });

  it('keeps muted text legible rather than merely quiet', () => {
    expect(contrast(theme.muted, theme.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the shape and rhythm tokens', () => {
  it('offers one control radius, so nothing invents its own', () => {
    expect(radius.control).toBe(10);
  });

  it('keeps spacing on a 4pt rhythm', () => {
    for (const value of Object.values(space)) {
      expect(value % 4).toBe(0);
    }
  });
});
