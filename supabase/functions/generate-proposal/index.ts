// BidReel — AI proposal generator Edge Function
// Keeps the Anthropic API key server-side. Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy generate-proposal --no-verify-jwt
// Before launch: remove --no-verify-jwt and require auth.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a professional video production proposal writer with 20 years of experience winning work for cinematographers and small studios. Generate a complete, client-ready proposal that is specific to the brief — never generic filler.
Return ONLY valid JSON with this exact structure:
{
  "subject": "Proposal subject line",
  "overview": "2-3 paragraph project overview",
  "scope": ["item1", "item2", "item3"],
  "deliverables": ["deliverable1", "deliverable2"],
  "timeline": [
    {"phase":"Pre-Production","duration":"X wks","details":"..."},
    {"phase":"Production","duration":"X days","details":"..."},
    {"phase":"Post-Production","duration":"X wks","details":"..."},
    {"phase":"Delivery","duration":"X days","details":"..."}
  ],
  "investment": {
    "total": 0,
    "breakdown": [{"item":"name","amount":0}],
    "paymentTerms": "50% deposit, 50% on delivery"
  },
  "whyUs": "1-2 paragraphs"
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const {
      template,
      clientName,
      brief,
      budget,
      timeline,
      producerName,
      companyName,
    } = await req.json();

    if (!clientName || !template) {
      return new Response(
        JSON.stringify({ error: "clientName and template are required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Client: ${clientName}, Type: ${template},
Brief: ${brief || "General project"},
Budget: ${budget || "Market rate"},
Timeline: ${timeline || "Standard"},
Producer: ${producerName || "Producer"},
Company: ${companyName || "Production Company"}`,
          },
        ],
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "AI generation failed. Try again." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const text: string = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const proposal = JSON.parse(clean);

    return new Response(JSON.stringify(proposal), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Invalid request or malformed AI output." }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
