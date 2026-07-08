// BidReel — Stripe Connect onboarding for producers (collect deposits to their
// own account). Producer-authed. Creates an Express account if needed, stores
// the id on their profile, and returns a hosted onboarding link.
//
// Deploy:  supabase functions deploy stripe-connect
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_...
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RETURN_URL =
  Deno.env.get("STRIPE_CONNECT_RETURN_URL") ?? "https://bidreel.io/connected.html";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!jwt) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
    const uid = userData.user.id;

    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_account_id, email")
      .eq("id", uid)
      .single();

    let accountId = profile?.stripe_account_id ?? null;

    // Create an Express connected account on first use.
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: profile?.email ?? userData.user.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
      });
      accountId = account.id;
      await admin
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", uid);
    }

    // Check whether onboarding is already complete.
    const account = await stripe.accounts.retrieve(accountId);
    if (account.charges_enabled && account.payouts_enabled) {
      return json({ connected: true });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: RETURN_URL,
      return_url: RETURN_URL,
      type: "account_onboarding",
    });

    return json({ url: link.url, connected: false });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
