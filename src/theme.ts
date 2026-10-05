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
  // The field look: tinted surfaces behind icons, and a soft fill for each
  // state a capture can be in, each with a text colour that reads on it.
  primarySoft: '#e2ead4',
  primaryText: '#3c6200',
  success: '#00704f',
  successSoft: '#d8f1e5',
  warn: '#8a4700',
  warnSoft: '#fbead3',
  info: '#005a75',
  infoSoft: '#d8ecf3',
  dangerSoft: '#fbe0e4',
  neutralSoft: '#e9eae7',
  // Text on the green header, beside `onPrimary` for its title.
  heroMuted: '#d6e5bd',
  // The part of a voice note's waveform not yet played.
  track: '#a9c08a',
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
  primarySoft: '#2a3a1b',
  primaryText: '#a6cc75',
  success: '#62d4a5',
  successSoft: '#16342a',
  warn: '#f3b866',
  warnSoft: '#3b2b14',
  info: '#80d1ea',
  infoSoft: '#13303a',
  dangerSoft: '#3d1a20',
  neutralSoft: '#30362e',
  heroMuted: '#13200a',
  track: '#4f6b31',
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
 * The field look: rounder and larger than the web, because it is used with
 * one hand, outdoors, often in a hurry. `control` rounds buttons and inputs,
 * `card` the rows and tiles they sit among, and `hero` the green header's
 * lower edge. Pills stay pills.
 *
 * `border` stays at 1 rather than adopting the web's 1.5px: a phone renders 1
 * logical point as two or three physical pixels already. Shadows are kept for
 * the few things that float over the page — the action tiles and the tab bar
 * — and nowhere down a list, where RN elevation costs render time.
 */
export const radius = { control: 14, card: 18, hero: 28, pill: 999 } as const;

export const border = { width: 1 } as const;

/** A 4pt rhythm, replacing sixteen ad-hoc spacing values. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * Montserrat, as on the web. It is embedded in the build (the expo-font
 * plugin in app.json) with one face per weight from 400 to 800, so
 * `fontWeight` picks the face on both platforms.
 */
export const font = { family: 'Montserrat' } as const;

/**
 * Five steps, replacing ten font sizes. `title` heads a screen, `heading` a
 * section of the researcher's form, `body` is answers and content, `label`
 * names a field, `caption` is metadata and helper text.
 */
export const type = {
  title: { fontFamily: font.family, fontSize: 28, fontWeight: '800' },
  heading: { fontFamily: font.family, fontSize: 18, fontWeight: '800' },
  body: { fontFamily: font.family, fontSize: 16, fontWeight: '400' },
  label: { fontFamily: font.family, fontSize: 14, fontWeight: '600' },
  caption: { fontFamily: font.family, fontSize: 13, fontWeight: '400' },
  /** Section labels: the web's kicker, in the heavier field weight. */
  kicker: {
    fontFamily: font.family,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
} as const;

/** Minimum tap target. Native convention, and no web equivalent to inherit. */
export const touch = { min: 44 } as const;
