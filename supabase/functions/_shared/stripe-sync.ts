// Shared convergence for "this Checkout Session is paid": claims the payments
// row, flips the bid, logs the timeline event, and notifies the producer.
// Used by stripe-webhook (normal path), deposit-checkout (client re-tapped Pay
// after paying) and reconcile-payments (webhook never arrived).
//
// Every DB write checks its error and reports failure so callers can return a
// non-2xx and let Stripe (or the cron) retry — a transient DB failure must
// never be swallowed as success. All steps converge: re-running after a
// partial failure completes the remaining transitions without duplicating the
// completed ones.
// deno-lint-ignore-file no-explicit-any
import { pushToProducer } from "./push.ts";

export type SyncResult = { ok: boolean; error?: string };

type SessionLike = {
  id: string;
  payment_status?: string | null;
  payment_intent?: unknown;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
};

export async function applyPaidSession(
  admin: any,
  s: SessionLike,
): Promise<SyncResult> {
  if (s.payment_status !== "paid") return { ok: true }; // nothing to apply yet

  const paymentIntentId =
    typeof s.payment_intent === "string" ? s.payment_intent : null;

  // 1 · Claim the payments row (first caller wins; retries find 0 rows).
  const { data: pay, error: payErr } = await admin
    .from("payments")
    .update({ status: "paid", provider_payment_id: paymentIntentId })
    .eq("provider_session_id", s.id)
    .neq("status", "paid")
    .select("bid_id, amount_cents, currency, user_id")
    .maybeSingle();
  if (payErr) return { ok: false, error: `payments update: ${payErr.message}` };

  let bidId: string | null = pay?.bid_id ?? null;
  let amountCents: number | null = pay?.amount_cents ?? null;
  let currency: string = pay?.currency ?? s.currency ?? "usd";
  let producerId: string | null = pay?.user_id ?? null;

  if (!pay) {
    // Either already claimed (normal retry) or the row was never written
    // (insert failed during checkout). Distinguish, and rebuild from the
    // session metadata in the second case so the payment is never orphaned.
    const { data: existing, error: exErr } = await admin
      .from("payments")
      .select("bid_id, user_id")
      .eq("provider_session_id", s.id)
      .maybeSingle();
    if (exErr) return { ok: false, error: `payments select: ${exErr.message}` };

    if (existing) {
      // Already claimed — still converge the bid below in case that step
      // failed on the previous attempt.
      bidId = existing.bid_id;
      producerId = existing.user_id;
    } else if (s.metadata?.bid_id) {
      const { data: bid, error: bidErr } = await admin
        .from("bids")
        .select("id, user_id")
        .eq("id", s.metadata.bid_id)
        .maybeSingle();
      if (bidErr) return { ok: false, error: `bids select: ${bidErr.message}` };
      if (!bid) return { ok: true }; // bid deleted; nothing to converge

      const { error: insErr } = await admin.from("payments").upsert(
        {
          bid_id: bid.id,
          user_id: bid.user_id,
          provider_session_id: s.id,
          provider_payment_id: paymentIntentId,
          amount_cents: s.amount_total ?? 0,
          currency,
          status: "paid",
        },
        { onConflict: "provider_session_id" },
      );
      if (insErr) {
        return { ok: false, error: `payments upsert: ${insErr.message}` };
      }
      bidId = bid.id;
      producerId = bid.user_id;
      amountCents = s.amount_total ?? null;
    } else {
      return { ok: true }; // unknown session (not ours)
    }
  }

  if (!bidId) return { ok: true };

  // 2 · Converge the bid. Idempotent: only rows not already paid transition,
  //     and the timeline event + push fire only on an actual transition.
  const { data: bidRows, error: bErr } = await admin
    .from("bids")
    .update({ deposit_status: "paid", status: "won" })
    .eq("id", bidId)
    .neq("deposit_status", "paid")
    .select("client_name");
  if (bErr) return { ok: false, error: `bids update: ${bErr.message}` };

  if (bidRows && bidRows.length > 0) {
    const { error: evErr } = await admin.from("bid_events").insert({
      bid_id: bidId,
      type: "deposit_paid",
      metadata: { amount_cents: amountCents },
    });
    if (evErr) return { ok: false, error: `bid_events insert: ${evErr.message}` };

    if (producerId) {
      const amt = ((amountCents ?? 0) / 100).toLocaleString("en-US", {
        style: "currency",
        currency: (currency || "usd").toUpperCase(),
      });
      // Push failures are non-fatal by design (see _shared/push.ts).
      await pushToProducer(
        admin,
        producerId,
        "Deposit paid 🎉",
        `${bidRows[0]?.client_name ?? "A client"} paid a ${amt} deposit — you're booked`,
        { bidId },
      );
    }
  }

  return { ok: true };
}

/** Mark a session's payment failed/expired. Converging and error-checked. */
export async function markSessionFailed(
  admin: any,
  sessionId: string,
): Promise<SyncResult> {
  const { error } = await admin
    .from("payments")
    .update({ status: "failed" })
    .eq("provider_session_id", sessionId)
    .eq("status", "created");
  if (error) return { ok: false, error: `payments update: ${error.message}` };
  return { ok: true };
}
