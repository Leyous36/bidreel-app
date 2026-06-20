# BidReel

AI-powered bid & proposal engine for video producers. Built by Souley Oumarou / AmeriFilms.

This codebase covers **Phases 1–3** of the implementation guide (project scaffold, database & auth, core app) plus the paywall shell for Phase 4. It runs in **Expo Go** today.

## What's here

```
bidreel/
  app/                       # Screens (Expo Router file-based routing)
    _layout.tsx              # Root layout + auth gate
    auth.tsx                 # Email sign in / sign up
    onboarding.tsx           # First-run studio profile setup
    (tabs)/
      index.tsx              # Dashboard: metrics + recent bids
      create.tsx             # Template picker → bid form → AI generation
      bids.tsx               # Full pipeline list w/ filters + search
      settings.tsx           # Profile, subscription, sign out
    bid/[id].tsx             # Proposal viewer + status + copy/delete
    paywall.tsx              # Pro/Studio tiers (RevenueCat hooks in Phase 4)
  components/                # ProposalView, StatusBadge, MetricCard, TemplateCard, ui
  constants/Colors.ts        # Design tokens (dark, cinematic, gold accent)
  lib/                       # supabase, ai, templates, types, auth-context, revenue-cat
  supabase/
    migrations/0001_init.sql # Tables, RLS, triggers, proposal counter
    functions/generate-proposal/index.ts  # Edge Function (holds Anthropic key)
```

## Setup — do these once (≈30 min)

### 1. Verify/create accounts (Phase 0)

You said some may exist — check each:
- [ ] **Supabase** project at supabase.com → note Project URL + anon key (Settings > API)
- [ ] **Anthropic API** key at console.anthropic.com (needs ~$5 credit)
- [ ] Node 20+ installed (`node --version`)
- [ ] **Expo Go** app on your phone

Apple/Google developer accounts, RevenueCat, Resend, PostHog, Vercel are NOT needed yet — those start at Phase 4–6.

### 2. Install dependencies

```bash
cd bidreel
npm install
npx expo install --fix    # aligns native package versions with the Expo SDK
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env: paste your Supabase URL and anon key
```

### 4. Set up the database

Open Supabase Dashboard → SQL Editor → paste the contents of
`supabase/migrations/0001_init.sql` → Run.

Then in Authentication → Providers → Email: turn OFF "Confirm email" (faster testing).

### 5. Deploy the AI Edge Function

```bash
npm install -g supabase            # if not installed
supabase login
supabase link --project-ref YOUR_PROJECT_REF   # Settings > General
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key
supabase functions deploy generate-proposal --no-verify-jwt
```

> Before launch: remove `--no-verify-jwt` so only signed-in users can call it.

### 6. Run it

```bash
npx expo start
```

Scan the QR code with Expo Go. Create an account, set up your studio profile, and generate your first proposal.

## Free-tier enforcement (built in)

- 3 proposals/month (counted server-side via `increment_proposal_count`)
- 2 templates unlocked (Corporate Brand Film, Event Coverage); rest route to paywall
- "Created with BidReel" branding appended to copied proposals

## Phase 4+ (not yet active)

- **RevenueCat**: `lib/revenue-cat.ts` is a safe stub — flip `USE_REVENUECAT` to `true` after `npx expo install react-native-purchases` and moving to a dev build (`eas build --profile development`). Expo Go cannot load native purchase modules.
- **Monthly counter reset**: schedule a Supabase cron (`pg_cron`) to zero `proposals_this_month` on the 1st:
  `UPDATE profiles SET proposals_this_month = 0;`
- **Apple/Google sign-in**: required by Apple if you add any social login. Email-only is fine for TestFlight.
- PostHog analytics, Resend emails, open tracking, and the landing page follow the implementation guide Phases 4–6.
- **Domain**: bidreel.io (Namecheap, includes hosting — the Phase 6 landing page can live there instead of Vercel). Privacy policy → bidreel.io/privacy, support → bidreel.io/support.

## Costs to run during build

Supabase free tier + ~$5 Anthropic credit. Nothing else until TestFlight (Apple $99/yr).
