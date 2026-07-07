// BidReel — public, read-only proposal payload for the shared link page.
// UNAUTHENTICATED: keyed only by the secret share_token. Returns a sanitized
// projection (proposal + studio branding) — never the raw bids row, the
// producer's email, or any internal ids. Logs a deduped "viewed" event.
//
// Deploy WITHOUT JWT verification:
//   supabase functions deploy proposal-public --no-verify-jwt
import { createClient } from "jsr:@supabase/supabase-js@2";
import { pushToProducer } from "../_shared/push.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Salted daily hash of the client IP — used only to dedupe views.
// We never persist a raw IP.
async function ipHash(req: Request): Promise<string> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD daily salt
  const salt = Deno.env.get("VIEW_SALT") ?? "bidreel";
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${ip}|${day}|${salt}`),
  );
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token") ?? "";
    if (!token && req.method === "POST") {
      token = (await req.json().catch(() => ({})))?.token ?? "";
    }
    if (!token) return json({ error: "Missing token" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: bid } = await admin
      .from("bids")
      .select(
        "id, client_name, proposal, accepted_at, deposit_status, deposit_amount_cents, currency, first_viewed_at, user_id",
      )
      .eq("share_token", token)
      .single();
    if (!bid || !bid.proposal) return json({ error: "Proposal not found" }, 404);

    const { data: studio } = await admin
      .from("profiles")
      .select("company_name, producer_name, logo_url, brand_color")
      .eq("id", bid.user_id)
      .single();

    // ---- deduped view logging (per token + ip-hash + day) ----
    const h = await ipHash(req);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data: seen } = await admin
      .from("bid_events")
      .select("id")
      .eq("bid_id", bid.id)
      .eq("type", "viewed")
      .eq("metadata->>ip_hash", h)
      .gte("created_at", since.toISOString())
      .maybeSingle();

    if (!seen) {
      await admin.from("bid_events").insert({
        bid_id: bid.id,
        type: "viewed",
        metadata: { ip_hash: h, ua: req.headers.get("user-agent") ?? "" },
      });
      if (!bid.first_viewed_at) {
        await admin
          .from("bids")
          .update({ first_viewed_at: new Date().toISOString() })
          .eq("id", bid.id);
        // Notify the producer the very first time their proposal is opened.
        await pushToProducer(
          admin,
          bid.user_id,
          "Proposal opened",
          `${bid.client_name} just opened your proposal`,
          { bidId: bid.id },
        );
      }
    }

    return json({
      client_name: bid.client_name,
      proposal: bid.proposal, // subject, overview, scope[], deliverables[], timeline[], investment{}, whyUs
      studio: {
        name: studio?.company_name ?? null,
        producer: studio?.producer_name ?? null,
        logo: studio?.logo_url ?? null,
        color: studio?.brand_color ?? "#F5B82E",
      },
      state: {
        accepted: !!bid.accepted_at,
        deposit_status: bid.deposit_status ?? "none",
        deposit_amount_cents: bid.deposit_amount_cents ?? null,
        currency: bid.currency ?? "usd",
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
