import { useColorScheme } from 'react-native';

/**
 * The Padiush brand palette, ported from the web app's daisyUI themes
 * (`padiushlight`/`padiushdark`) — the oklch values converted to hex. Roles map
 * to daisyUI tokens: bg = base-200, card = base-100, border = base-300,
 * text = base-content, primary/onPrimary = primary/primary-content, danger = error.
 *
 * Two roles deliberately do NOT track the web:
 *
 * - `chip` / `chipBorder` have no web counterpart. Unselected chips used the
 *   page colour with a hairline border, which measured about 1.2:1 — the
 *   faintest thing on a screen made mostly of them, in an app used outdoors.
 *   They now sit on their own surface with a border strong enough to read.
 * - the dark `border` is *lighter* than the surface it outlines, where the web
 *   makes it darker. Light-on-dark separators are the native convention, and
 *   the web's near-black outline on a dark card is barely visible.
 */
const light = {
  bg: '#e4e4e4',
  card: '#f5f5f5',
  border: '#d4d4d4',
  text: '#0b0908',
  // Secondary, not decorative: this carries section kickers, metadata, helper
  // text and placeholders, all below the large-text threshold, so it has to
  // clear 4.5:1 on the page as well as on a card. The previous tone managed
  // 4.50:1 on card but only 3.86:1 on the page behind it.
  muted: '#64675e',
  primary: '#3c6200',
  onPrimary: '#f5fce5',
  // Matches the web's --color-error after its contrast fix: the previous 58%
  // lightness only reached 4.22:1 on base-100, under the 4.5:1 minimum, and
  // this colour carries every required marker and validation message.
  danger: '#ca002f',
  inputBg: '#ffffff',
  chip: '#ffffff',
  chipBorder: '#80837a',
};

const dark = {
  bg: '#131712',
  card: '#1a1e19',
  border: '#2a2f28',
  text: '#dbe5d8',
  muted: '#97a091',
  primary: '#6c9543',
  onPrimary: '#071001',
  danger: '#fb5669',
  inputBg: '#30342e',
  chip: '#252a24',
  chipBorder: '#70736a',
};

export type Theme = typeof light;

/** Both palettes, so contrast can be asserted over them rather than assumed. */
export const themes = { light, dark } satisfies Record<string, Theme>;

/** The active palette, following the device's light/dark setting. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/**
 * Shape, rhythm and type, in one place so a change lands once rather than in
 * nine stylesheets.
 *
 * `radius` is a single value on purpose. The app had five (2, 6, 10, 12, 22)
 * for no reason anyone could name; 10 is both the one it already used most and
 * a step from the web's 8, close enough that the two read as the same family
 * at phone scale. Pills stay pills.
 *
 * `border` stays at 1 rather than adopting the web's 1.5px: desktop displays
 * are often 1x where a hairline looks fragile, while a phone renders 1 logical
 * point as two or three physical pixels already. There are no shadows for the
 * same kind of reason — the web theme is flat (`--depth: 0`), and RN elevation
 * diverges across platforms and costs render time in lists.
 */
export const radius = { control: 10, pill: 999 } as const;

export const border = { width: 1 } as const;

/** A 4pt rhythm, replacing sixteen ad-hoc spacing values. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * Five steps, replacing ten font sizes. `title` heads a screen, `heading` a
 * section of the researcher's form, `body` is answers and content, `label`
 * names a field, `caption` is metadata and helper text.
 */
export const type = {
  title: { fontSize: 24, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '500' },
  caption: { fontSize: 13, fontWeight: '400' },
  /** The uppercase kicker the web uses for section labels. */
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
} as const;

/** Minimum tap target. Native convention, and no web equivalent to inherit. */
export const touch = { min: 44 } as const;
