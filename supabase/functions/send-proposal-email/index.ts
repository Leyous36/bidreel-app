// BidReel — email a proposal to a client via Resend.
// Keeps the Resend API key server-side. Deploy:
//   supabase secrets set RESEND_API_KEY=re_...
//   (optional) supabase secrets set RESEND_FROM="proposals@send.bidreel.io"
//   supabase functions deploy send-proposal-email
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// From address must be on a domain verified in Resend (e.g. send.bidreel.io).
const FROM_ADDRESS = Deno.env.get("RESEND_FROM") ?? "proposals@send.bidreel.io";
// Per-user cap on outbound proposal emails per rolling 24h — stops a signed-in
// user turning the verified domain into an unmetered spam relay.
const DAILY_EMAIL_CAP = Number(Deno.env.get("EMAIL_DAILY_CAP") ?? "50");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const GOLD = "#C7920F";
const INK = "#15202B";
const MUTED = "#5B6678";
const LINE = "#E3E8F0";

function paras(text: string): string {
  return esc(text)
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 10px;color:${INK};font-size:15px;line-height:1.55;">${p}</p>`)
    .join("");
}

function bullets(items: string[]): string {
  return (items ?? [])
    .map((i) => `<li style="margin:0 0 6px;color:${INK};font-size:14px;line-height:1.5;">${esc(i)}</li>`)
    .join("");
}

function h2(label: string): string {
  return `<h2 style="margin:24px 0 8px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${GOLD};font-weight:bold;">${esc(label)}</h2>`;
}

// Email-safe HTML (tables + inline styles render reliably across mail clients).
function buildEmailHtml(p: any, clientName: string, company: string, proposalUrl?: string): string {
  const timeline = (p.timeline ?? [])
    .map(
      (t: any) =>
        `<tr><td style="padding:5px 10px 5px 0;font-weight:bold;color:${INK};font-size:14px;vertical-align:top;white-space:nowrap;">${esc(t.phase)} <span style="color:${MUTED};font-weight:normal;">(${esc(t.duration)})</span></td><td style="padding:5px 0;color:${INK};font-size:14px;vertical-align:top;">${esc(t.details)}</td></tr>`,
    )
    .join("");

  let investment = "";
  if (p.tiers && p.tiers.length) {
    investment = p.tiers
      .map((tier: any) => {
        const rec = tier.recommended;
        const inc = (tier.includes ?? [])
          .map((i: string) => `<li style="margin:0 0 4px;color:${INK};font-size:13px;">${esc(i)}</li>`)
          .join("");
        return `<table width="100%" cellpadding="0" cellspacing="0" style="border:${rec ? `2px solid ${GOLD}` : `1px solid ${LINE}`};border-radius:10px;margin:0 0 10px;background:${rec ? "#FFFBF0" : "#ffffff"};"><tr><td style="padding:14px 16px;">
          ${rec ? `<div style="display:inline-block;background:${GOLD};color:#fff;font-size:9px;font-weight:bold;letter-spacing:1px;padding:3px 8px;border-radius:999px;margin-bottom:6px;">RECOMMENDED</div><br/>` : ""}
          <span style="font-size:15px;font-weight:bold;color:${INK};">${esc(tier.name)}</span>
          <span style="font-size:20px;font-weight:bold;color:${GOLD};float:right;">$${Number(tier.total).toLocaleString()}</span>
          <div style="font-size:11px;color:${MUTED};font-style:italic;margin:2px 0 8px;">${esc(tier.tagline)}</div>
          <ul style="margin:6px 0 0;padding-left:18px;">${inc}</ul>
        </td></tr></table>`;
      })
      .join("");
    if (p.paymentTerms) {
      investment += `<p style="color:${MUTED};font-style:italic;font-size:12px;margin:6px 0 0;">${esc(p.paymentTerms)}</p>`;
    }
  } else if (p.investment) {
    const rows = (p.investment.breakdown ?? [])
      .map(
        (b: any) =>
          `<tr><td style="padding:5px 0;color:${INK};font-size:14px;">${esc(b.item)}</td><td style="padding:5px 0;text-align:right;font-weight:bold;color:${INK};font-size:14px;">$${Number(b.amount).toLocaleString()}</td></tr>`,
      )
      .join("");
    investment = `<table width="100%" cellpadding="0" cellspacing="0">${rows}<tr><td style="padding-top:8px;border-top:2px solid ${INK};font-weight:bold;color:${INK};">Total</td><td style="padding-top:8px;border-top:2px solid ${INK};text-align:right;font-weight:bold;color:${GOLD};">$${Number(p.investment.total).toLocaleString()}</td></tr></table><p style="color:${MUTED};font-style:italic;font-size:12px;margin:8px 0 0;">${esc(p.investment.paymentTerms)}</p>`;
  }

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
      <tr><td style="border-top:4px solid ${GOLD};padding:28px 32px 8px;">
        <span style="font-size:20px;font-weight:bold;color:${INK};">${esc(company)}</span>
        <span style="float:right;font-size:11px;letter-spacing:2px;color:${GOLD};font-weight:bold;">PROPOSAL</span>
      </td></tr>
      <tr><td style="padding:8px 32px 28px;">
        <h1 style="margin:0 0 4px;font-size:20px;color:${INK};">${esc(p.subject)}</h1>
        <p style="margin:0 0 14px;color:${MUTED};font-size:13px;">Prepared for ${esc(clientName)}</p>
        ${proposalUrl ? `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:2px 0 18px;"><a href="${esc(proposalUrl)}" style="display:inline-block;background:${GOLD};color:#1A1405;font-weight:bold;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:8px;">View &amp; Accept Proposal</a><div style="color:${MUTED};font-size:11px;margin-top:8px;">Review the packages and accept online in one tap.</div></td></tr></table>` : ""}
        ${h2("Overview")}${paras(p.overview)}
        ${h2("Scope of Work")}<ul style="margin:0 0 8px;padding-left:18px;">${bullets(p.scope)}</ul>
        ${h2("Deliverables")}<ul style="margin:0 0 8px;padding-left:18px;">${bullets(p.deliverables)}</ul>
        ${h2("Timeline")}<table width="100%" cellpadding="0" cellspacing="0">${timeline}</table>
        ${h2("Investment")}${investment}
        ${h2("Why Us")}${paras(p.whyUs)}
        <p style="margin:28px 0 0;padding-top:14px;border-top:1px solid ${LINE};color:${MUTED};font-size:12px;">Sent via ${esc(company)} · Reply to this email to get in touch.</p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

// Short, personal follow-up note (vs. the full proposal document) — the
// message text is written/edited by the sender in the app.
function buildFollowupHtml(message: string, company: string, proposalUrl?: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
      <tr><td style="border-top:4px solid ${GOLD};padding:28px 32px 6px;">
        <span style="font-size:18px;font-weight:bold;color:${INK};">${esc(company)}</span>
      </td></tr>
      <tr><td style="padding:12px 32px 28px;">
        ${paras(message)}
        ${proposalUrl ? `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:14px 0 4px;"><a href="${esc(proposalUrl)}" style="display:inline-block;background:${GOLD};color:#1A1405;font-weight:bold;font-size:14px;text-decoration:none;padding:11px 24px;border-radius:8px;">View the Proposal</a></td></tr></table>` : ""}
        <p style="margin:24px 0 0;padding-top:14px;border-top:1px solid ${LINE};color:${MUTED};font-size:12px;">Sent via ${esc(company)} · Reply to this email to get in touch.</p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Require a signed-in user.
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized." }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email isn't configured yet." }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { bidId, to, proposal, clientName, companyName, replyTo, subject, proposalUrl, followupMessage } = await req.json();
    if (!to || !proposal || !clientName) {
      return new Response(
        JSON.stringify({ error: "Missing client email, proposal, or client name." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(to))) {
      return new Response(
        JSON.stringify({ error: "Enter a valid client email address." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Service-role client for ownership + rate checks (bypasses RLS).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // The proposal being emailed must belong to one of the caller's own bids —
    // otherwise any signed-in user could send arbitrary content from our domain.
    if (!bidId) {
      return new Response(
        JSON.stringify({ error: "Missing bid reference." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    const { data: ownBid, error: bidErr } = await admin
      .from("bids")
      .select("id")
      .eq("id", bidId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (bidErr) {
      console.error("send-proposal-email bid check:", bidErr.message);
      return new Response(
        JSON.stringify({ error: "Couldn't verify the proposal. Try again." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    if (!ownBid) {
      return new Response(
        JSON.stringify({ error: "You can only email your own proposals." }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Rolling-24h per-user send cap.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: cntErr } = await admin
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if (cntErr) {
      console.error("send-proposal-email cap check:", cntErr.message);
      return new Response(
        JSON.stringify({ error: "Couldn't verify your send limit. Try again." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    if ((count ?? 0) >= DAILY_EMAIL_CAP) {
      return new Response(
        JSON.stringify({
          error: `Daily email limit reached (${DAILY_EMAIL_CAP}). Try again tomorrow.`,
        }),
        { status: 429, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const company = companyName || "AmeriFilms";
    // A follow-up sends the short note instead of the full proposal document.
    const followup = typeof followupMessage === "string" ? followupMessage.trim() : "";
    if (followup.length > 4000) {
      return new Response(
        JSON.stringify({ error: "Follow-up message is too long." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    const html = followup
      ? buildFollowupHtml(followup, company, proposalUrl)
      : buildEmailHtml(proposal, clientName, company, proposalUrl);

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${company} <${FROM_ADDRESS}>`,
        to: [to],
        reply_to: replyTo || user.email,
        subject: subject || proposal.subject || `Proposal from ${company}`,
        html,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("Resend error:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: data?.message || "Failed to send email." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Record the send so it counts against the cap (best-effort).
    const { error: logErr } = await admin.from("email_log").insert({
      user_id: user.id,
      bid_id: bidId,
      to_email: to,
    });
    if (logErr) console.error("send-proposal-email log insert:", logErr.message);

    return new Response(JSON.stringify({ ok: true, id: data?.id }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Could not send the email." }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
