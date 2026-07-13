/**
 * BidReel design tokens — dark, cinematic, confident.
 *
 * Deep blue-black surfaces with visible 1px borders, gold as the "win"
 * accent, saturated semantic hues, and generous 12–16px radii. Text on a
 * gold fill is always near-black (#1A1405).
 */
export const Colors = {
  bg: "#0B0E13",
  surface: "#141923",
  surfaceRaised: "#1C2230",
  surfaceHover: "#232B3C", // hover target — one step above surfaceRaised

  border: "#262E3F",
  borderStrong: "#37425A", // focused inputs, pressed outlines

  text: "#F4F6FA",
  textSecondary: "#94A0B8",
  textMuted: "#5B6678",

  accent: "#F5B82E", // gold — the "win" color
  accentHover: "#FFC94D",
  accentMuted: "rgba(245,184,46,0.16)", // selected/active row fill
  accentDark: "#C7920F",

  blue: "#4D8DF7",
  green: "#3DBE7B",
  red: "#E5564F",
  purple: "#8E6FF7",

  status: {
    draft: "#5B6678",
    sent: "#4D8DF7",
    viewed: "#8E6FF7",
    accepted: "#36C5D6",
    pending: "#F5B82E",
    won: "#3DBE7B",
    lost: "#E5564F",
  } as Record<string, string>,
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

/** System font; weight does the hierarchy work (600 labels, 700–800 headings). */
export const Type = {
  ui: 13,
  body: 15,
  bodyLg: 16,
  heading: 18,
  trackHeading: 0,
  trackUi: 0,
};

export const Motion = {
  fast: 150,
};

export const Shadow = {
  overlay: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
};
