// BidReel — lightweight, cross-platform PostHog analytics.
//
// Uses PostHog's HTTP capture API directly via fetch, so the exact same code
// runs on iOS, Android, and web with no native modules to install. If the
// PostHog key isn't set, every call is a no-op — the app runs fine without it.
//
// Config (public — safe to embed in the client):
//   EXPO_PUBLIC_POSTHOG_KEY   project API key (starts with "phc_")
//   EXPO_PUBLIC_POSTHOG_HOST  e.g. https://us.i.posthog.com (default)
import { Platform } from "react-native";

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/+$/, "");

type Props = Record<string, unknown>;

// `anonId` tracks events before sign-in; on identify it's linked to the user.
let anonId: string | null = null;
let distinctId: string | null = null;

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function send(event: string, properties: Props = {}, idOverride?: string): void {
  if (!KEY) return; // analytics disabled
  if (!anonId) anonId = uuid();
  const distinct_id = idOverride || distinctId || anonId;
  const payload = {
    api_key: KEY,
    event,
    distinct_id,
    properties: { $lib: "bidreel", platform: Platform.OS, ...properties },
    timestamp: new Date().toISOString(),
  };
  // Fire-and-forget. Analytics must never throw into the app.
  try {
    fetch(`${HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Call once on app start. */
export function initAnalytics(): void {
  if (!anonId) anonId = uuid();
  send("app_opened");
}

/** Link events to a signed-in user and set person properties. */
export function identifyUser(userId: string, props: Props = {}): void {
  const previousAnon = anonId;
  distinctId = userId;
  const cleaned: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined && v !== null) cleaned[k] = v;
  }
  send(
    "$identify",
    { $set: cleaned, ...(previousAnon ? { $anon_distinct_id: previousAnon } : {}) },
    userId,
  );
}

/** Clear identity on sign-out. */
export function resetAnalytics(): void {
  distinctId = null;
  anonId = uuid();
}

/** Track a product event. */
export function track(event: string, properties: Props = {}): void {
  send(event, properties);
}
