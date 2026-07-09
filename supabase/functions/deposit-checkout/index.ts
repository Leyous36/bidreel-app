// BidReel — create a Stripe Checkout Session for the booking deposit.
// UNAUTHENTICATED: keyed only by the secret share_token. The deposit amount is
// decided SERVER-SIDE from the snapshot on the bid — the client never sends it.
// If the studio has connected a Stripe account, the money is routed straight to
// them (destination charge, no platform fee at launch).
//
// Hardening (0007): reuses an existing open Checkout Session instead of
// minting a new one per tap (closes the two-tabs double-charge window), aborts
// if the payments row can't be recorded (expiring the just-created session so
// nothing stays payable without a record), converges state inline when the
// session already got paid but the webhook was lost, and returns only generic
// error strings to the public caller.
//
// Deploy:  supabase functions deploy deposit-checkout --no-verify-jwt
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_...
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";
import { applyPaidSession, markSessionFailed } from "../_shared/stripe-sync.ts";

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

    // Reuse the most recent unfinished session for this bid instead of minting
    // a new payable session on every tap/tab.
    const { data: openPay, error: openErr } = await admin
      .from("payments")
      .select("provider_session_id")
      .eq("bid_id", bid.id)
      .eq("status", "created")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openErr) {
      console.error("deposit-checkout payments lookup:", openErr.message);
      return json({ error: "Couldn't start checkout. Please try again." }, 500);
    }
    if (openPay?.provider_session_id) {
      try {
        const prior = await stripe.checkout.sessions.retrieve(
          openPay.provider_session_id,
        );
        if (prior.status === "open" && prior.url) {
          return json({ url: prior.url });
        }
        if (prior.status === "complete" && prior.payment_status === "paid") {
          // Paid but the webhook never landed — converge now.
          const res = await applyPaidSession(admin, prior);
          if (!res.ok) {
            console.error("deposit-checkout inline converge:", res.error);
            return json(
              { error: "Couldn't start checkout. Please try again." },
              500,
            );
          }
          return json({ alreadyPaid: true });
        }
        // Expired or otherwise dead — record it and fall through to a new one.
        await markSessionFailed(admin, openPay.provider_session_id);
      } catch (e) {
        // Session unknown to Stripe (test/live mix etc.) — don't block payment.
        console.error("deposit-checkout session retrieve:", e);
      }
    }

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
      // 30-minute window; the webhook's checkout.session.expired handler (and
      // the reuse logic above) then retires it. bid_id only — the share_token
      // is a bearer secret and doesn't belong in a third-party dashboard.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      metadata: { bid_id: bid.id },
    });

    // The payments row is the webhook's anchor — if we can't record it, kill
    // the session so nothing stays payable without a record.
    const { error: insErr } = await admin.from("payments").insert({
      bid_id: bid.id,
      user_id: bid.user_id,
      provider_session_id: session.id,
      amount_cents: amount,
      currency,
      status: "created",
    });
    if (insErr) {
      console.error("deposit-checkout payments insert:", insErr.message);
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch (e) {
        console.error("deposit-checkout session expire:", e);
      }
      return json({ error: "Couldn't start checkout. Please try again." }, 500);
    }

    // Best-effort bookkeeping — a failure here shouldn't block the payment,
    // but it must be visible in the logs.
    const { error: bidErr } = await admin
      .from("bids")
      .update({ deposit_status: "requested" })
      .eq("id", bid.id)
      .neq("deposit_status", "paid");
    if (bidErr) console.error("deposit-checkout bid update:", bidErr.message);
    const { error: evErr } = await admin.from("bid_events").insert({
      bid_id: bid.id,
      type: "deposit_requested",
      metadata: { amount_cents: amount },
    });
    if (evErr) console.error("deposit-checkout event insert:", evErr.message);

    return json({ url: session.url });
  } catch (e) {
    console.error("deposit-checkout error:", e);
    return json({ error: "Couldn't start checkout. Please try again." }, 500);
  }
});
