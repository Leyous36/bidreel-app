// BidReel — Stripe webhook. Verifies the signature, then on a completed
// checkout marks the payment paid, sets the bid's deposit_status='paid', and
// flips the bid to "won". Idempotent via the unique provider_session_id.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
// Then add the function URL as an endpoint in the Stripe Dashboard
// (event: checkout.session.completed) and paste the signing secret above.
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";
import { pushToProducer } from "../_shared/push.ts";

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
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;

      // Idempotent: only the first completion flips status from non-paid → paid.
      const { data: pay } = await admin
        .from("payments")
        .update({
          status: "paid",
          provider_payment_id:
            typeof s.payment_intent === "string" ? s.payment_intent : null,
        })
        .eq("provider_session_id", s.id)
        .neq("status", "paid")
        .select("bid_id, amount_cents, user_id")
        .maybeSingle();

      if (pay) {
        const { data: bidRow } = await admin
          .from("bids")
          .update({ deposit_status: "paid", status: "won" })
          .eq("id", pay.bid_id)
          .select("client_name")
          .maybeSingle();
        await admin.from("bid_events").insert({
          bid_id: pay.bid_id,
          type: "deposit_paid",
          metadata: { amount_cents: pay.amount_cents },
        });
        const amt = Math.round((pay.amount_cents ?? 0) / 100).toLocaleString();
        await pushToProducer(
          admin,
          pay.user_id,
          "Deposit paid 🎉",
          `${bidRow?.client_name ?? "A client"} paid a $${amt} deposit — you're booked`,
          { bidId: pay.bid_id },
        );
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      `Handler error: ${e instanceof Error ? e.message : "error"}`,
      { status: 500 },
    );
  }
});
