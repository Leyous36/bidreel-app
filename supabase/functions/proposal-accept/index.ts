// BidReel — client accepts a proposal from the shared link.
// UNAUTHENTICATED: keyed only by the secret share_token. Records the
// acceptance (typed name = signature), sets accepted_at + status, and logs an
// "accepted" event. Idempotent: accepting twice is a no-op.
//
// Deploy WITHOUT JWT verification:
//   supabase functions deploy proposal-accept --no-verify-jwt
import { createClient } from "jsr:@supabase/supabase-js@2";
import { pushToProducer } from "../_shared/push.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const body = await req.json().catch(() => ({}));
    const token: string = (body.token ?? "").trim();
    const name: string = (body.name ?? "").trim().slice(0, 120);
    if (!token) return json({ error: "Missing token" }, 400);
    if (!name) return json({ error: "Please type your name to accept." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: bid } = await admin
      .from("bids")
      .select("id, user_id, client_name, status, accepted_at")
      .eq("share_token", token)
      .single();
    if (!bid) return json({ error: "Proposal not found" }, 404);

    // Already accepted → idempotent success, don't overwrite the original.
    if (bid.accepted_at) {
      return json({ ok: true, accepted: true, alreadyAccepted: true });
    }

    const now = new Date().toISOString();
    const { error: upErr } = await admin
      .from("bids")
      .update({ accepted_at: now, accepted_by_name: name, status: "accepted" })
      .eq("id", bid.id);
    if (upErr) return json({ error: upErr.message }, 500);

    await admin
      .from("bid_events")
      .insert({ bid_id: bid.id, type: "accepted", metadata: { name } });

    await pushToProducer(
      admin,
      bid.user_id,
      "Proposal accepted 🎉",
      `${name} accepted your ${bid.client_name} proposal`,
      { bidId: bid.id },
    );

    return json({ ok: true, accepted: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
