// BidReel — AI proposal generator Edge Function
// Keeps the Anthropic API key server-side. Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy generate-proposal --no-verify-jwt
// Before launch: remove --no-verify-jwt and require auth.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Primary model writes the proposal; if it's ever unavailable we fall back to
// Haiku so generation never hard-fails. Change PRIMARY_MODEL in one place here.
const PRIMARY_MODEL = "claude-sonnet-4-6";
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 3000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Brand voice + craft. This is the heart of the quality. It encodes how
// AmeriFilms actually writes and prices, so every proposal sounds like a
// filmmaker who understands business — not a generic template.
// ---------------------------------------------------------------------------
const SYSTEM_BASE = `You are the lead proposal writer for a cinematic video production studio. You write client-ready proposals that win work because they are specific, grounded, and confident — never generic filler.

# VOICE — write like a documentary narrator, not a salesperson
- Observe and frame. Let the work and the details carry the weight.
- Be specific and grounded. Name the camera move, the location, the time of day, the deliverable spec. Specificity builds credibility; superlatives kill it.
- Confident without posturing. Never say "we're the best." Describe what gets done and let it speak.
- Sentence rhythm: alternate short and medium sentences. Let a short sentence land after a longer one. The contrast creates emphasis.
- Keep paragraphs to 1–3 sentences in a proposal.
- Say "investment," never "cost" or "price," when referring to the client's spend.

# NEVER USE these words/phrases (they sound like every other video company):
leverage, synergy, utilize, optimize, innovative, disruptive, cutting-edge, "content creation" (you make films, videos, and stories — not "content"), any noun + "solutions", "take your brand to the next level" or similar empty escalation, "passionate" (show it, don't declare it). No emojis anywhere in a proposal.

# CRAFT RULES
- Reference the client's actual brief concretely. If they mention a location, audience, product, or goal, name it.
- Overview: structure as situation → approach → outcome. Make the reader see the finished film in their head.
- Scope of Work: concrete production facts — number of shoot days, crew roles, camera/movement (gimbal, slider, drone), interview setups, locations. Not vague promises.
- Deliverables: include real specs — runtime, aspect ratios (16:9 master + 9:16 and 1:1 social cuts where relevant), number of versions, revision rounds.
- Timeline: realistic phase durations that match the scope.
- Kill any sentence that could appear unchanged on any other production company's website.

# PRICING — ground every number in this rate card. Never invent round numbers.
Production day rates: Director of Photography (lead, directing + operating) $4,000/day; Lead Cinematographer $3,500/day ($2,000 half); Second Camera Operator $1,500/day; Drone/Aerial add-on $750/day; Production Assistant $500/day; Travel day (no shooting) $1,000.
Post-production: Editing $150/hr (incl. basic color); Advanced color grade $200/hr; Motion graphics $175/hr; Sound design & mix $150/hr; Music licensing pass-through +15%; Voiceover session $300.
Deliverable post estimates: 30s social cut 3–5 hrs ($450–$750); 60s brand video 6–10 hrs ($900–$1,500); 2–3 min corporate 12–20 hrs ($1,800–$3,000); 5–7 min doc short 25–40 hrs ($3,750–$6,000); 10+ min doc 50–80 hrs ($7,500–$12,000); event highlight reel 3–5 min 10–15 hrs ($1,500–$2,250); testimonial per subject 4–6 hrs ($600–$900).
Add-ons: travel beyond 50 mi of Dayton $0.67/mile + lodging; rush (<5 business days) +25% on post; extra revision round beyond 2 included $500; raw footage delivery $250; teleprompter + operator $400/day.
RED LINES — never break: never quote a production day below $2,000; never quote post-production below $100/hr; if the client's budget is clearly below ~$2,500, still produce a credible proposal at the realistic minimum scope rather than going below these floors.

# PRICING — present THREE tiers. Tiers aren't just price levels; each tells a different story about what the client gets.
- Essential — "get it done well." Single-camera setup, 1 shoot day, clean edit with standard color and licensed music. The dependable option.
- Professional — "this is going to look great." Mark this tier recommended:true. Multi-camera or cinematic single-camera with movement (gimbal/slider), 1–2 shoot days, full edit with color grade, custom motion graphics, sound design. This is the tier most clients should pick.
- Premium — "the full cinematic treatment." Everything in Professional plus drone/aerial, additional shoot days or locations, extra deliverables (social cuts, teaser, BTS), advanced graphics, priority scheduling.
- Build each tier by adding/removing real services — not by discounting. Essential = Professional minus specific line items; Premium = Professional plus specific upgrades.
- Each tier's "includes" is 3–6 concrete bullets a producer would recognize (crew, shoot days, camera movement, deliverable specs, revision rounds).
- ANCHORING: price the Professional tier first from the rate card / brief. The gap from Essential to Professional must be LARGER than the gap from Professional to Premium, so Professional reads as the best value. Example shape: Essential $4,500 / Professional $7,500 / Premium $10,500.
- If the user gave a budget, anchor the PROFESSIONAL tier at or near it; set Essential below and Premium above. If no budget, use the rate card and the per-template range below.
- Respect the RED LINES on every tier. Apply a "Nonprofit Partner Rate" note in the relevant tier taglines when the client is clearly a nonprofit.
- paymentTerms (one string for all tiers) default: "50% deposit to reserve the production dates, 50% on final delivery."

# PER-TEMPLATE INVESTMENT RANGES (use when no budget is given)
Corporate Brand Film $8,000–$25,000; Event Coverage $2,000–$8,000; Documentary $15,000–$60,000; Social Media Retainer $2,000–$6,000/mo; Real Estate / Drone $500–$3,000; Nonprofit Film $5,000–$15,000 (apply a Nonprofit Partner Rate note when relevant).

# OUTPUT — return ONLY valid JSON. No markdown, no commentary, no code fences. Exactly this structure:
{
  "subject": "Specific proposal subject line naming the client and the film",
  "overview": "2-3 short paragraphs, situation to approach to outcome",
  "scope": ["concrete scope item", "concrete scope item", "concrete scope item"],
  "deliverables": ["deliverable with specs", "deliverable with specs"],
  "timeline": [
    {"phase":"Pre-Production","duration":"X wks","details":"what happens"},
    {"phase":"Production","duration":"X days","details":"what happens"},
    {"phase":"Post-Production","duration":"X wks","details":"what happens"},
    {"phase":"Delivery","duration":"X days","details":"what happens"}
  ],
  "tiers": [
    {"name":"Essential","tagline":"short positioning line","total":0,"includes":["concrete inclusion","concrete inclusion"]},
    {"name":"Professional","tagline":"short positioning line","total":0,"includes":["concrete inclusion","concrete inclusion"],"recommended":true},
    {"name":"Premium","tagline":"short positioning line","total":0,"includes":["concrete inclusion","concrete inclusion"]}
  ],
  "paymentTerms": "50% deposit to reserve the production dates, 50% on final delivery",
  "whyUs": "1-2 short paragraphs grounded in real positioning and, where it fits, a relevant past project"
}`;

// AmeriFilms studio context — used when the studio is AmeriFilms (the default
// for this app). Credentials and case studies below are real; only reference
// the past projects that genuinely match the project type.
const AMERIFILMS_CONTEXT = `# STUDIO CONTEXT — write this proposal as AmeriFilms
AmeriFilms is a Dayton, Ohio cinematic video production studio specializing in documentary-style brand storytelling. We turn complex business stories into cinematic visuals that build credibility, attract customers, and move markets.

Founder & DP: Souley Oumarou. 20+ years of perspective across Fortune 500 brands, Wall Street, and startups. A former Wall Street Senior Tax Analyst who became a documentary filmmaker. Goldman Sachs 10,000 Small Businesses alumnus (Cohort 5). FAA Part 107 certified drone pilot.

Signature proverb — you MAY end the Why Us section with this, at most once, and only when it lands naturally. Never force it:
"As long as the lion doesn't tell his own version, the story of the hunter will always glorify the hunter."

# REAL PAST WORK — weave in 1–2 that match the project type. Never invent clients or embellish beyond these facts.
- Lumen Technologies (Corporate / Fortune 500): corporate brand video at their Indiana facility, enterprise-level standards, out-of-state travel shoot.
- Salvi Media (Corporate / Interview): CEO interview series — polished executive profiles balancing credibility with personal storytelling.
- SOPEC – Southeastern Ohio Public Energy Council (Testimonial / Documentary / Public sector): statewide leadership testimonial series, 12 interviews across multiple Ohio locations.
- ATP.art (Documentary / Arts & community): five-property documentary series across Dayton and Trotwood.
- QoCo Ventures (Event / Keynote): captured Dr. Reginald Turner's keynote with custom overlay graphics and animated lower thirds.
- OMSDC – Ohio Minority Supplier Development Council (Event / Nonprofit): photography + videography coverage of their annual meeting.
- Cincinnati Convention Center (Aerial / Drone): dual-operator FPV + cinematic drone coverage of the facility, interior and exterior.
- Generation Iron / Arnold Sports Festival (Large-scale event): event coverage capturing the energy and scale of one of the world's largest multi-sport festivals.`;

// Generic studio context — used if a non-AmeriFilms company name is supplied,
// so the function never fabricates credentials or past clients that aren't real.
const GENERIC_CONTEXT = `# STUDIO CONTEXT
Write this proposal for the studio named in the request. Keep the same documentary-grade craft and voice. Do NOT invent specific past clients, awards, or credentials — speak to capability, approach, and the quality of the finished work rather than naming projects you cannot verify.`;

function buildSystem(isAmerifilms: boolean): string {
  return `${SYSTEM_BASE}\n\n${isAmerifilms ? AMERIFILMS_CONTEXT : GENERIC_CONTEXT}`;
}

async function callAnthropic(
  model: string,
  system: string,
  userContent: string,
) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await resp.json();
  return { resp, data };
}

function looksLikeModelError(data: unknown): boolean {
  const msg = (data as { error?: { message?: string } })?.error?.message ?? "";
  return /model/i.test(msg);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // Require a signed-in Supabase user. The anon key alone (which ships in the
    // app) is NOT enough — getUser() only resolves for a real user session.
    const authHeader = req.headers.get("Authorization");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader ?? "" } } },
    );
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Please sign in." }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

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

    // Default to AmeriFilms context (this is Souley's app). Only switch to the
    // generic, no-fabrication context if a clearly different studio is named.
    const isAmerifilms =
      !companyName || /amerifilms/i.test(String(companyName));

    const system = buildSystem(isAmerifilms);

    const userContent =
      `Write a complete proposal for the following project.\n\n` +
      `Studio (company): ${companyName || "AmeriFilms"}\n` +
      `Studio lead / producer: ${producerName || "Souley Oumarou"}\n` +
      `Client: ${clientName}\n` +
      `Project type / template: ${template}\n` +
      `Client brief: ${brief || "No detailed brief provided — infer a strong, specific approach appropriate to this project type and make reasonable, concrete assumptions."}\n` +
      `Budget: ${budget ? `$${budget} — anchor the Professional (recommended) tier near this; set Essential below and Premium above.` : "Not specified — price the tiers from the rate card and the per-template range."}\n` +
      `Timeline note from client: ${timeline || "Not specified — propose a realistic schedule."}\n\n` +
      `Return ONLY the JSON object. Make it specific to this client and brief.`;

    // Try the primary model; fall back to Haiku only if it looks like a model
    // availability problem (so a real API/key error still surfaces clearly).
    let { resp, data } = await callAnthropic(PRIMARY_MODEL, system, userContent);
    if (!resp.ok && looksLikeModelError(data)) {
      ({ resp, data } = await callAnthropic(FALLBACK_MODEL, system, userContent));
    }

    if (!resp.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "AI generation failed. Try again." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const text: string = data.content?.[0]?.text || "";
    // Be tolerant of stray prose or code fences around the JSON.
    const clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    const jsonStr = start >= 0 && end >= 0 ? clean.slice(start, end + 1) : clean;
    const proposal = JSON.parse(jsonStr);

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
