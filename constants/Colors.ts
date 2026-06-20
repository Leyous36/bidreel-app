/** BidReel design tokens — dark, cinematic, confident. */
export const Colors = {
  bg: "#0B0E13",
  surface: "#141923",
  surfaceRaised: "#1C2230",
  border: "#262E3F",
  text: "#F4F6FA",
  textSecondary: "#94A0B8",
  textMuted: "#5B6678",
  accent: "#F5B82E", // gold — the "win" color
  accentDark: "#C7920F",
  blue: "#4D8DF7",
  green: "#3DBE7B",
  red: "#E5564F",
  purple: "#8E6FF7",

  status: {
    draft: "#5B6678",
    sent: "#4D8DF7",
    viewed: "#8E6FF7",
    pending: "#F5B82E",
    won: "#3DBE7B",
    lost: "#E5564F",
  } as Record<string, string>,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};
