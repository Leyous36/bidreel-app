// BidReel — mint a public share link for a proposal.
// Producer-authed. Creates (or reuses) a secret share_token, snapshots the
// deposit amount, moves the bid to "sent", and logs a "shared" event.
// Deploy:  supabase functions deploy share-proposal
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Where the public proposal page lives. Override with PUBLIC_PROPOSAL_BASE.
const PUBLIC_BASE =
  Deno.env.get("PUBLIC_PROPOSAL_BASE") ?? "https://bidreel.io/p/";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Identify the caller from their JWT.
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
    const uid = userData.user.id;

    const { bidId } = await req.json();
    if (!bidId) return json({ error: "bidId is required" }, 400);

    // Load the bid and verify ownership (service role bypasses RLS, so we
    // scope by user_id explicitly).
    const { data: bid, error: bidErr } = await admin
      .from("bids")
      .select(
        "id, user_id, status, share_token, proposal, budget, deposit_amount_cents, currency",
      )
      .eq("id", bidId)
      .eq("user_id", uid)
      .single();
    if (bidErr || !bid) return json({ error: "Bid not found" }, 404);

    // Studio's default deposit % for the snapshot.
    const { data: profile } = await admin
      .from("profiles")
      .select("default_deposit_pct")
      .eq("id", uid)
      .single();
    const pct = profile?.default_deposit_pct ?? 50;
    // Headline value: recommended tier → first tier → legacy investment → budget.
    const p = bid.proposal as {
      tiers?: { total?: number; recommended?: boolean }[];
      investment?: { total?: number };
    } | null;
    const recTier =
      p?.tiers?.find((t) => t.recommended) ?? p?.tiers?.[0] ?? null;
    const total =
      recTier?.total ?? p?.investment?.total ?? bid.budget ?? 0;
    const depositCents = Math.round(total * (pct / 100) * 100);

    const isFirstShare = !bid.share_token;
    const shareToken = bid.share_token ?? crypto.randomUUID();

    const update: Record<string, unknown> = {
      share_token: shareToken,
      shared_at: new Date().toISOString(),
      deposit_amount_cents: bid.deposit_amount_cents ?? depositCents,
      currency: bid.currency ?? "usd",
    };
    // Only advance a brand-new bid to "sent"; never downgrade later states.
    if (bid.status === "draft") update.status = "sent";

    const { error: upErr } = await admin.from("bids").update(update).eq("id", bid.id);
    if (upErr) return json({ error: upErr.message }, 500);

    if (isFirstShare) {
      await admin.from("bid_events").insert({ bid_id: bid.id, type: "shared" });
    }

    return json({
      url: `${PUBLIC_BASE}${shareToken}`,
      token: shareToken,
      status: update.status ?? bid.status,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
