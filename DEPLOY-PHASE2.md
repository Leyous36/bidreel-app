# Deploy — Phase 2: Trackable Proposal Links

Everything below lives in the **bidreel-pkg** project. Three deploys: database, edge functions, web page. ~5 minutes.

## 1. Database (run once)
In Supabase → SQL Editor, paste and run `supabase/migrations/0002_proposal_links.sql`
(or from the project root: `supabase db push`).

Adds: share/track columns on `bids`, the `bid_events` timeline table (+ RLS), and
branding columns on `profiles`. It's `IF NOT EXISTS` throughout, so it's safe to re-run.

## 2. Edge functions
```
supabase functions deploy share-proposal
supabase functions deploy proposal-public --no-verify-jwt
supabase functions deploy proposal-accept --no-verify-jwt
```
- `share-proposal` stays JWT-protected (only a signed-in producer can mint a link).
- `proposal-public` and `proposal-accept` must be `--no-verify-jwt` so clients can open
  and accept the link without an account.
- Optional secret for view-hash salting: `supabase secrets set VIEW_SALT=<any-random-string>`

## 3. Web page (the client-facing link)
Copy `web/proposal.html` and `web/vercel.json` into your **bidreel.io** site repo, then:
```
npx vercel --prod
```
- `vercel.json` rewrites `bidreel.io/p/<token>` → `proposal.html`.
- If your site already has a `vercel.json`, just merge in the one rewrite rule
  (`{ "source": "/p/(.*)", "destination": "/proposal.html" }`) instead of overwriting.

## 4. App
The app changes (Share button, link banner, `accepted` status) are already in the
codebase. They ship with your next build — no separate step. If you want them in a
test build now: `eas build --platform android --profile preview`.

---

## How it works end to end
1. Producer opens a proposal → **Share Proposal** → `share-proposal` mints a secret
   `share_token`, snapshots the deposit amount, moves the bid to **Sent**, copies/opens
   the link `bidreel.io/p/<token>`.
2. Client opens the link → `proposal.html` calls `proposal-public?token=…` → renders the
   branded proposal and logs a **deduped** `viewed` event (sets `first_viewed_at`).
3. Back in the app, the bid shows **"Opened by client"** on the link banner.
4. Client taps **Accept proposal** → types their name (signature) → `proposal-accept`
   sets `accepted_at`/`accepted_by_name`, flips the bid to **Accepted**, logs the event.
   The app banner then reads **"Accepted by {name}"**.

## Test it
Open `web/proposal-preview.html` in any browser to see the exact client page with sample
data (no backend needed). `web/proposal-preview-accepted.html` shows the **Pay deposit**
state.

---

# Phase 4 — Deposits (Stripe)

Lets a client pay a booking deposit right after they accept. Money routes to the
**producer's own** Stripe account (Stripe Connect), no platform fee at launch.

## A. Stripe account (one-time)
1. Create/log into Stripe → enable **Connect** (Settings → Connect → Get started,
   platform type "Express").
2. Copy your **Secret key** (`sk_live_…` or `sk_test_…` to test first).

## B. Database
Run `supabase/migrations/0003_payments.sql` (or `supabase db push`) — adds the
`payments` table (+ RLS). The deposit columns on `bids` already exist from 0002.

## C. Edge functions + secrets
```
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase functions deploy stripe-connect
supabase functions deploy deposit-checkout --no-verify-jwt
supabase functions deploy stripe-webhook  --no-verify-jwt
```

## D. Webhook (one-time)
1. Stripe Dashboard → Developers → **Webhooks** → Add endpoint.
2. URL: `https://ikrjbkrhawfpekocksjw.supabase.co/functions/v1/stripe-webhook`
3. Event: **`checkout.session.completed`**.
4. Copy the endpoint's **Signing secret** and set it:
   `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx`

## E. Web
Copy `web/connected.html` (the Stripe onboarding return page) into the site and
re-deploy (`npx vercel --prod`). `web/proposal.html` is already updated with the Pay flow.

## How the deposit flow works
1. Producer → **Settings → Connect payouts** → `stripe-connect` creates an Express
   account, stores `stripe_account_id`, and opens Stripe's hosted onboarding.
2. After a client **accepts**, the page shows **Pay deposit $X** → `deposit-checkout`
   creates a Stripe Checkout Session (amount decided **server-side** from the snapshot)
   → redirects to Stripe's hosted, PCI-compliant checkout.
3. On payment, Stripe calls `stripe-webhook` → it verifies the signature, marks the
   payment **paid**, sets `deposit_status='paid'`, and flips the bid to **Won**
   (idempotent via the unique session id).
4. The app banner reads **"Deposit paid · booked"**.

## Safety notes
- Deposit amount is **never** trusted from the client — it's read from the bid snapshot.
- The webhook **verifies the Stripe signature**; replays are ignored via the unique
  `provider_session_id`.
- Test end-to-end in **Stripe test mode** (`sk_test_…` + test card `4242 4242 4242 4242`)
  before switching to live keys.

---

# Phase 5 — Push notifications

The producer gets a push the moment a proposal is **opened** (first view),
**accepted**, or the **deposit is paid**.

## A. Database
Run `supabase/migrations/0004_push_tokens.sql` (adds `profiles.push_token`).

## B. Edge functions (redeploy — they now send pushes)
The three functions import the shared helper `supabase/functions/_shared/push.ts`
(bundled automatically on deploy):
```
supabase functions deploy proposal-public --no-verify-jwt
supabase functions deploy proposal-accept --no-verify-jwt
supabase functions deploy stripe-webhook  --no-verify-jwt
```
No new secrets — pushes go through Expo's free push service.

## C. App — needs a new native build
`expo-notifications` is a native module, so this ships in a **new build**, not an
OTA update:
```
eas build --platform android --profile production
```
On launch the app asks for notification permission and saves the device's Expo
push token to the producer's profile.

## D. Android delivery — FCM (one-time)
Expo's push service delivers to Android through **Firebase Cloud Messaging**. Set it
up once so Android devices actually receive pushes:
```
eas credentials        # Android → Push Notifications (FCM) → follow prompts
```
(or Expo docs: "Add Android FCM credentials"). iOS APNs is handled automatically by
EAS using your Apple push key. Without FCM, iOS still works but Android pushes won't
deliver.

## Test it
1. Install the new build, sign in (this registers the push token).
2. Open the proposal link from a **different** device/browser → you get
   *"<client> just opened your proposal."*
3. Accept on the link → *"<name> accepted your proposal."*
4. Pay the test deposit → *"<client> paid a $X deposit — you're booked."*

## How it works
- `lib/notifications.ts` registers the token (after sign-in, via `auth-context`).
- On each event the function calls `pushToProducer(admin, userId, title, body)`,
  which looks up `push_token` and POSTs to `https://exp.host/--/api/v2/push/send`.
- Push failures are swallowed — they never break the view/accept/pay request.

---

# Phase 6 — Studio branding (logo, color, deposit %)

Producers set a logo, brand color, and default deposit % in **Settings → Studio
Profile**; the client-facing proposal page picks them up automatically.

## A. Database / Storage
Run `supabase/migrations/0005_branding_storage.sql` — creates the public
`studio-logos` bucket and RLS so each user can only write to their own folder.

## B. App — new native build
Adds `expo-image-picker` (native module) → ships in a **new build**, not OTA:
```
eas build --platform android --profile production
```

## C. Web
`web/proposal.html` already applies `brand_color` to the page accent and shows the
uploaded logo — no change needed beyond your normal redeploy if you haven't pushed
the latest `proposal.html`.

## How it works
- **Logo:** Settings → Upload logo → image picker → uploaded to
  `studio-logos/<uid>/…` → public URL saved to `profiles.logo_url`.
- **Brand color / deposit %:** chosen in Settings, saved on **Save Profile** to
  `profiles.brand_color` / `default_deposit_pct`.
- The proposal page reads all three via `proposal-public` and themes itself; new
  shares snapshot the deposit using the producer's chosen %.

## Test it
Open `web/proposal-preview.html` (gold) and `web/proposal-preview-accepted.html`
(blue brand color) to see the accent re-theme from the studio's brand color.
