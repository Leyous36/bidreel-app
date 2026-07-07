// BidReel — create a Stripe Checkout Session for the booking deposit.
// UNAUTHENTICATED: keyed only by the secret share_token. The deposit amount is
// decided SERVER-SIDE from the snapshot on the bid — the client never sends it.
// If the studio has connected a Stripe account, the money is routed straight to
// them (destination charge, no platform fee at launch).
//
// Deploy:  supabase functions deploy deposit-checkout --no-verify-jwt
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_...
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PUBLIC_BASE =
  Deno.env.get("PUBLIC_PROPOSAL_BASE") ?? "https://bidreel.io/p/";

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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { token } = await req.json().catch(() => ({}));
    if (!token) return json({ error: "Missing token" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: bid } = await admin
      .from("bids")
      .select(
        "id, user_id, client_name, proposal, accepted_at, deposit_status, deposit_amount_cents, currency",
      )
      .eq("share_token", token)
      .single();
    if (!bid) return json({ error: "Proposal not found" }, 404);
    if (!bid.accepted_at) {
      return json({ error: "Please accept the proposal first." }, 409);
    }
    if (bid.deposit_status === "paid") {
      return json({ alreadyPaid: true });
    }

    const amount = bid.deposit_amount_cents ?? 0;
    if (amount < 100) {
      return json({ error: "No deposit is configured for this proposal." }, 400);
    }
    const currency = (bid.currency ?? "usd").toLowerCase();

    // Route to the studio's connected account if they've onboarded.
    const { data: studio } = await admin
      .from("profiles")
      .select("stripe_account_id, company_name")
      .eq("id", bid.user_id)
      .single();

    const subject =
      bid.proposal?.subject ?? `${bid.client_name} — video production`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount,
            product_data: { name: `Booking deposit — ${subject}` },
          },
        },
      ],
      // Connect destination charge (no application fee at launch).
      payment_intent_data: studio?.stripe_account_id
        ? { transfer_data: { destination: studio.stripe_account_id } }
        : undefined,
      success_url: `${PUBLIC_BASE}${token}?paid=1`,
      cancel_url: `${PUBLIC_BASE}${token}`,
      metadata: { bid_id: bid.id, token },
    });

    await admin.from("payments").insert({
      bid_id: bid.id,
      user_id: bid.user_id,
      provider_session_id: session.id,
      amount_cents: amount,
      currency,
      status: "created",
    });
    await admin
      .from("bids")
      .update({ deposit_status: "requested" })
      .eq("id", bid.id);
    await admin.from("bid_events").insert({
      bid_id: bid.id,
      type: "deposit_requested",
      metadata: { amount_cents: amount },
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
