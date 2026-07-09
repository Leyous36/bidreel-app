// BidReel — payment reconciliation. Safety net for "the client paid but the
// webhook never arrived": finds payments stuck in 'created' for 30+ minutes,
// asks Stripe what actually happened to each session, and converges local
// state (paid → applyPaidSession, expired → failed). Bounded to 20 rows per
// run and driven purely by Stripe's answers — it takes no input and changes
// nothing that isn't confirmed by Stripe, so it is safe to call repeatedly.
//
// Deploy:   supabase functions deploy reconcile-payments --no-verify-jwt
// Schedule: hourly via pg_cron + pg_net (see the commented block at the end of
//           supabase/migrations/0007_server_side_entitlements.sql), or hit it
//           manually after any suspected webhook outage.
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";
import { applyPaidSession, markSessionFailed } from "../_shared/stripe-sync.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: stale, error } = await admin
    .from("payments")
    .select("provider_session_id")
    .eq("status", "created")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) {
    console.error("reconcile-payments query:", error.message);
    return new Response(JSON.stringify({ error: "query failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let markedPaid = 0;
  let markedFailed = 0;
  let skipped = 0;

  for (const row of stale ?? []) {
    if (!row.provider_session_id) {
      skipped++;
      continue;
    }
    try {
      const s = await stripe.checkout.sessions.retrieve(
        row.provider_session_id,
      );
      if (s.payment_status === "paid") {
        const res = await applyPaidSession(admin, s);
        if (res.ok) markedPaid++;
        else console.error("reconcile apply:", res.error);
      } else if (s.status === "expired") {
        const res = await markSessionFailed(admin, row.provider_session_id);
        if (res.ok) markedFailed++;
        else console.error("reconcile mark-failed:", res.error);
      } else {
        skipped++; // still open — leave it alone
      }
    } catch (e) {
      console.error("reconcile retrieve:", row.provider_session_id, e);
      skipped++;
    }
  }

  return new Response(
    JSON.stringify({
      checked: stale?.length ?? 0,
      markedPaid,
      markedFailed,
      skipped,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
