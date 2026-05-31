/**
 * Design-phase wireframe palette.
 *
 * These mirror the grayscale tokens from the Figma Make mid-fidelity wireframe
 * (`design-reference/`). They are intentionally monochrome — this is the
 * "shaping the form" stage, not the final visual design. When we move to the
 * real look, change the values here and they propagate to every ported screen.
 *
 * NOTE: everything under `src/components/design/` is a design-only mock with
 * fake data. It is mounted at the dev-only `/design` route and is NOT wired to
 * Twilio. It must not be imported by the real video flow.
 */
export const wf = {
  bg: '#F5F5F5',
  white: '#FFFFFF',
  ink: '#000000',
  gray700: '#424242',
  gray500: '#9E9E9E',
  gray300: '#E0E0E0',
  // Dark "live session" surfaces & chrome — mock-only today. These mimic a
  // real video session; when these screens wire to Twilio they map onto the
  // real theme's galleryViewBackgroundColor (#121C2D). Centralized here so the
  // live-look swap happens in ONE place.
  darkStage: '#2A2A2A', // session stage / gallery / generic card surface
  darkTile: '#3A3A3A', // elevated video tile / main video block
  darkRail: '#1A1A1A', // top/bottom bars and side rails
  darkPanel: '#1F1F1F', // side panels
  darkBorder: '#333333', // hairline border on dark surfaces
  darkBorderStrong: '#444444', // border on elevated tiles
  darkBorderActive: '#555555', // active tab / focused border
  darkFgMuted: '#AAAAAA', // muted label / active signal bar on dark
  darkFgDim: '#555555', // inactive signal bar / placeholder fg on dark
  darkFgFaint: '#666666', // placeholder icon / faint footer text on dark
};

/** Height of the design gallery top navigation bar, in px. */
export const GALLERY_NAV_HEIGHT = 44;
