# BidReel — Ship Checklist (in order)

Run top to bottom. Each step is tagged with **where** you do it.
Do the whole thing in **Stripe test mode** first, verify, then flip to live (last section).

> Heads-up: a build (version 5) is already **in review** on Play with just the tablet
> screenshots. The build below is a higher version with all the new features — once it's
> approved you can ship this as the update. You don't need to cancel the current review.

---

## 1 · Backend — database  `[Supabase]`
- [ ] **[Supabase]** SQL Editor → run migrations in order: `0002`, `0003`, `0004`, `0005`
      (or **[Terminal]** `supabase db push` from the project root)
      → creates tracking columns, `bid_events`, `payments`, `push_token`, branding columns, `studio-logos` bucket.

## 2 · Backend — edge functions  `[Terminal]`
- [ ] **[Terminal]** deploy all six:
```
supabase functions deploy share-proposal
supabase functions deploy proposal-public --no-verify-jwt
supabase functions deploy proposal-accept --no-verify-jwt
supabase functions deploy deposit-checkout --no-verify-jwt
supabase functions deploy stripe-webhook  --no-verify-jwt
supabase functions deploy stripe-connect
```

## 3 · Stripe — setup  `[Stripe]`
- [ ] **[Stripe]** confirm you're in **Test mode** (toggle, top right)
- [ ] **[Stripe]** Connect → enable **Express** (one-time)
- [ ] **[Stripe]** Developers → Webhooks → **Add endpoint**
      URL: `https://ikrjbkrhawfpekocksjw.supabase.co/functions/v1/stripe-webhook`
      event: **`checkout.session.completed`** → copy the **Signing secret**

## 4 · Backend — secrets  `[Supabase]`
- [ ] **[Supabase]** (or **[Terminal]** `supabase secrets set …`):
```
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx        # from step 3
```
  Optional (have sensible defaults): `VIEW_SALT`, `PUBLIC_PROPOSAL_BASE`, `STRIPE_CONNECT_RETURN_URL`

## 5 · Web — public proposal page  `[Vercel]`
- [ ] **[Vercel]** copy `web/proposal.html`, `web/vercel.json`, `web/connected.html` into the bidreel.io site
- [ ] **[Terminal]** `npx vercel --prod`
      (merge the one rewrite rule if the site already has a `vercel.json`)

## 6 · App — build & submit  `[Terminal]` → `[Play Console]`
- [ ] **[Terminal]** `eas credentials` → Android → **Push Notifications (FCM)** (one-time; required for Android push)
- [ ] **[Terminal]** `eas build --platform android --profile production`  (~15 min, version auto-increments)
- [ ] **[Terminal]** `eas submit --platform android --latest`  (or **[Play Console]** upload the `.aab`)
- [ ] **[Play Console]** add the build to your production release → **send for review**

---

## 7 · Verify (Stripe test mode)
You can test the link → accept → pay flow as soon as steps 1–5 are done — it runs in a
browser, no app build needed. Push + share need the new build (step 6).
- [ ] Follow **`TEST-PLAN-proposal-flow.md`** end to end (test card `4242 4242 4242 4242`)
- [ ] All three pushes fire; bid moves draft → sent → accepted → won; money lands in the test connected account

---

## 8 · Go live (only after step 7 is all green)
- [ ] **[Stripe]** switch to **Live mode** → create a **live** webhook endpoint (same URL, same event) → copy live signing secret
- [ ] **[Supabase]** set `STRIPE_SECRET_KEY=sk_live_…` and `STRIPE_WEBHOOK_SECRET=whsec_…` (live)
- [ ] **[Terminal]** redeploy the two payment functions so they pick up live keys:
      `supabase functions deploy deposit-checkout --no-verify-jwt && supabase functions deploy stripe-webhook --no-verify-jwt`
- [ ] Do **one** small real transaction as a final live sanity check

---

### Quick reference — what lives where
| Where | What |
|---|---|
| **[Supabase]** | migrations, function secrets, the `studio-logos` bucket |
| **[Terminal]** | `supabase ... deploy`, `vercel`, `eas build/submit/credentials` |
| **[Stripe]** | Connect setup, webhook endpoint, test→live toggle |
| **[Vercel]** | `proposal.html`, `vercel.json`, `connected.html` |
| **[Play Console]** | upload/submit the build, send for review |
| **[In the app]** | Settings → branding & Connect payouts (you, as a producer) |
