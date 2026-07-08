// BidReel — drafts a short, on-brand follow-up message for a proposal that's
// awaiting a response. Reuses the Anthropic key already set for generate-proposal.
//   supabase functions deploy generate-followup
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-haiku-4-5-20251001";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized." }, 401);

    if (!ANTHROPIC_API_KEY) return json({ error: "AI isn't configured." }, 500);

    const { clientName, subject, companyName, producerName, status, daysSince } = await req.json();
    const company = companyName || "AmeriFilms";
    const signer = producerName || company;

    const opened =
      status === "viewed" || status === "won"
        ? `opened the proposal but hasn't replied (about ${daysSince ?? "a few"} days ago)`
        : `was sent the proposal but hasn't opened it yet (about ${daysSince ?? "a few"} days ago)`;

    const system =
      `You write short follow-up messages on behalf of ${company}, a documentary-style video production studio, ` +
      `to prospective clients who received a proposal and haven't responded. Voice: warm, confident, concise, ` +
      `never desperate, pushy, or salesy. Write 3 to 5 sentences of plain text — the email body only, no subject ` +
      `line, no markdown, no bracketed placeholders. Use the client's real name. Reference the project naturally. ` +
      `Close with one easy, low-pressure next step (a quick call, or simply answering any questions). ` +
      `Sign off as ${signer}. Avoid the words "synergy", "circle back", "just checking in", "touching base", and "leverage".`;

    const userMsg =
      `Client name: ${clientName}\nProject / proposal: ${subject}\nSituation: The client ${opened}.\n` +
      `Write the follow-up message now.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        temperature: 0.7,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      return json({ error: data?.error?.message || "Could not draft a follow-up." }, 502);
    }
    const message = data?.content?.[0]?.text?.trim() ?? "";
    return json({ ok: true, message });
  } catch (_e) {
    return json({ error: "Could not draft a follow-up." }, 500);
  }
});
