/**
 * BidReel design tokens — Linear-inspired design language.
 *
 * Dark-first, grayscale surfaces that layer upward in small lightness steps,
 * a single indigo accent used sparingly (primary buttons, active states,
 * focus rings), and white-opacity text tiers. Semantic hues exist only for
 * bid status and success/error signals — never decoration.
 */
export const Colors = {
  // Surface ladder: separate regions with background shifts, not borders.
  bg: "#0E0E10", // app background
  surface: "#141416", // one step up: sidebar, cards, inputs
  surfaceRaised: "#19191C", // two steps up: popovers, modals, active rows
  surfaceHover: "#1E1E22", // hover target — ~4% lighter than surface

  // Borders are the exception, not the rule: 1px at 8% white.
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)", // focused inputs, pressed outlines

  // Text tiers — muted text is white at reduced opacity, not gray hexes.
  text: "#F7F8F8",
  textSecondary: "rgba(255,255,255,0.60)",
  textMuted: "rgba(255,255,255,0.50)",

  // The one accent. Primary buttons, active nav, focus rings — nothing else.
  accent: "#5E6AD2",
  accentHover: "#6872D9",
  accentMuted: "rgba(94,106,210,0.15)", // selected/active row fill
  accentDark: "#4F5ABF",

  // Semantic signals only (status dots, success/error text). Muted, never
  // used as fills for decoration.
  blue: "#7C8AEB",
  green: "#4CB782",
  red: "#EB5757",
  purple: "#9E8CFC",

  status: {
    draft: "rgba(255,255,255,0.50)",
    sent: "#7C8AEB",
    viewed: "#9E8CFC",
    accepted: "#67CBC3",
    pending: "#D2A65E",
    won: "#4CB782",
    lost: "#EB5757",
  } as Record<string, string>,
};

/** 4px base grid. 8 inside components, 16–24 between groups, 48–64 between sections. */
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
  sm: 4,
  md: 6, // buttons, inputs, rows
  lg: 8, // cards, popovers, modals — never larger
  pill: 999, // reserved for status dots
};

/**
 * Inter everywhere. Weight does the hierarchy work, not size:
 * 400 body, 500 labels, 600 headings. Use fontFamily (never fontWeight —
 * static font files on Android ignore it).
 */
export const Fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
};

/** Text sizes: 13 UI chrome, 14–15 body. Line-height tight (~1.4). */
export const Type = {
  ui: 13,
  body: 14,
  bodyLg: 15,
  heading: 16,
  // letterSpacing -0.01em, precomputed in px for common sizes
  trackHeading: -0.16,
  trackUi: -0.13,
};

/** 100–150ms ease-out only. Nothing bounces, nothing slides in from off-screen. */
export const Motion = {
  fast: 120,
};

/** The one permitted shadow — never heavier. */
export const Shadow = {
  overlay: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
};
