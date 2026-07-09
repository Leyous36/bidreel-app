// BidReel — RevenueCat webhook. The ONLY writer of profiles.subscription_tier
// (clients are blocked by the profiles_protect_privileged trigger since 0007).
// Grants the tier on purchase/renewal events and downgrades to free on
// expiration, so a cancelled subscriber stops getting pro features when their
// paid period actually ends.
//
// Setup (when RevenueCat goes live — Phase 4):
//   1. supabase secrets set RC_WEBHOOK_SECRET=<any long random string>
//   2. supabase functions deploy rc-webhook --no-verify-jwt
//   3. RevenueCat Dashboard → Integrations → Webhooks →
//      URL: https://ikrjbkrhawfpekocksjw.supabase.co/functions/v1/rc-webhook
//      Authorization header value: Bearer <the same secret>
// Until the secret is set, the function rejects everything (503) — safe inert.
//
// RevenueCat app_user_id === the Supabase user id (initPurchases passes it).
// Entitlement identifiers must be "pro" and "studio" (see lib/revenue-cat.ts).
import { createClient } from "jsr:@supabase/supabase-js@2";

const SECRET = Deno.env.get("RC_WEBHOOK_SECRET") ?? "";

// Events that (re)assert what the user is entitled to right now.
const GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
]);
// EXPIRATION = access actually ended → downgrade. (CANCELLATION only means
// auto-renew was turned off; the entitlement stays active until expiry, so it
// is deliberately NOT handled here.)
const REVOKE_EVENTS = new Set(["EXPIRATION"]);

function tierFromEntitlements(ids: string[]): "pro" | "studio" | "free" {
  if (ids.includes("studio")) return "studio";
  if (ids.includes("pro")) return "pro";
  return "free";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!SECRET) {
    return new Response("Webhook not configured", { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${SECRET}` && auth !== SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { event } = await req.json();
    const type: string = event?.type ?? "";
    const uid: string = event?.app_user_id ?? "";

    // Anonymous RevenueCat ids (no signed-in user) can't map to a profile.
    if (!UUID_RE.test(uid)) {
      return new Response(JSON.stringify({ ignored: "no user id" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let tier: "pro" | "studio" | "free" | null = null;
    if (GRANT_EVENTS.has(type)) {
      tier = tierFromEntitlements(event?.entitlement_ids ?? []);
    } else if (REVOKE_EVENTS.has(type)) {
      tier = "free";
    }
    if (tier === null) {
      return new Response(JSON.stringify({ ignored: type }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await admin
      .from("profiles")
      .update({ subscription_tier: tier })
      .eq("id", uid);
    if (error) {
      console.error("rc-webhook profile update:", error.message);
      // Non-2xx → RevenueCat retries with backoff.
      return new Response("Temporary failure, retry", { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, tier }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rc-webhook error:", e);
    return new Response("Bad request", { status: 400 });
  }
});
