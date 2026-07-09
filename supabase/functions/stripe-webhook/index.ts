// BidReel — Stripe webhook. Verifies the signature, then converges local state
// with what Stripe says happened. Idempotent via the unique
// provider_session_id and transition-gated updates in _shared/stripe-sync.ts.
//
// Any DB failure returns 500 so Stripe RETRIES — a transient outage must never
// silently drop a real payment. Handles delayed payment methods
// (async_payment_*) and expired sessions, and only ever marks paid when
// Stripe reports payment_status === "paid".
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
// Stripe Dashboard endpoint events: checkout.session.completed,
//   checkout.session.async_payment_succeeded,
//   checkout.session.async_payment_failed, checkout.session.expired
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";
import { applyPaidSession, markSessionFailed } from "../_shared/stripe-sync.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
// Deno needs the async crypto provider for signature verification.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      WEBHOOK_SECRET,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    return new Response(
      `Webhook signature verification failed: ${
        err instanceof Error ? err.message : "error"
      }`,
      { status: 400 },
    );
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (event.type) {
      // "completed" fires for card payments with payment_status="paid", and
      // for delayed methods with payment_status="unpaid" — applyPaidSession
      // only acts on "paid", so the unpaid case waits for async_payment_*.
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        const res = await applyPaidSession(admin, s);
        if (!res.ok) {
          console.error("stripe-webhook apply failed:", res.error);
          return new Response("Temporary failure, retry", { status: 500 });
        }
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const s = event.data.object as Stripe.Checkout.Session;
        const res = await markSessionFailed(admin, s.id);
        if (!res.ok) {
          console.error("stripe-webhook mark-failed failed:", res.error);
          return new Response("Temporary failure, retry", { status: 500 });
        }
        break;
      }
      default:
        break; // unrecognized events are acknowledged, not errors
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-webhook handler error:", e);
    return new Response(
      `Handler error: ${e instanceof Error ? e.message : "error"}`,
      { status: 500 },
    );
  }
});
