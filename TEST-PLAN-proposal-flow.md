# BidReel — End-to-End Test Script
### Proposal link → opened → accepted → deposit → push

Run this once after deploying, in **Stripe test mode**, before any real client sees a link.
Tick each box. Each step lists the **action**, what you should **see**, and a **DB check**.

Supabase project ref: `ikrjbkrhawfpekocksjw` · run DB checks in Supabase → SQL Editor.

---

## 0. Pre-flight (do these first)

- [ ] Migrations applied: `0002_proposal_links`, `0003_payments`, `0004_push_tokens`
- [ ] Functions deployed: `share-proposal`, `proposal-public`*, `proposal-accept`*, `deposit-checkout`*, `stripe-webhook`*, `stripe-connect`  (* = `--no-verify-jwt`)
- [ ] Secrets set: `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`
- [ ] Stripe is in **Test mode**; webhook endpoint added for `checkout.session.completed`
- [ ] Web deployed: `proposal.html`, `vercel.json`, `connected.html` live on bidreel.io
- [ ] New EAS build installed on a **physical phone** (push needs a real device); FCM set up for Android
- [ ] You have a **second device or an incognito browser** to act as "the client"

**Smoke test the public function (no app needed):**
```
curl -s "https://ikrjbkrhawfpekocksjw.supabase.co/functions/v1/proposal-public?token=BADTOKEN" \
  -H "apikey: <ANON_KEY>"
# expect: {"error":"Proposal not found"}  (proves it's deployed and public)
```

---

## 1. Connect payouts (Stripe Connect)

- [ ] App → **Settings → Payouts → Connect payouts** → Stripe onboarding opens
- [ ] Complete Stripe **test** onboarding (use test data Stripe pre-fills)
- [ ] Land on **"Payouts connected"** page → return to app → Settings shows **✓ Payouts connected**

**DB check**
```sql
select stripe_account_id from profiles where id = auth.uid();  -- non-null (acct_…)
```

---

## 2. Create a proposal to test with

- [ ] Generate a proposal for a fake client (e.g. "Test Client") with a real total (e.g. $10,000)
- [ ] Open it → it renders in the app

---

## 3. Share the link

- [ ] On the bid → **Share Proposal** → link copies / share sheet opens
- [ ] Bid status chip → **Sent**; banner shows **"Link active · bidreel.io/p/…"**

**DB check**
```sql
select status, share_token, shared_at, deposit_amount_cents
from bids order by created_at desc limit 1;     -- token set, status 'sent', deposit ≈ 50% of total
```

---

## 4. Client opens the link  ← first push

- [ ] Open `bidreel.io/p/<token>` on the **other device / incognito**
- [ ] Page shows your studio name/logo, scope, timeline, investment, total — **no app login**
- [ ] 📲 Producer phone gets push: **"Test Client just opened your proposal"**
- [ ] Back in app (pull to refresh) → banner reads **"Opened by client"**

**DB check**
```sql
select type, created_at from bid_events where bid_id = '<BID_ID>' order by created_at;
-- expect: shared, viewed
select first_viewed_at from bids where id = '<BID_ID>';   -- set
```

- [ ] **Dedupe:** refresh the link again on the same device → **no second push**, no duplicate same-day `viewed` row

---

## 5. Client accepts  ← second push

- [ ] On the link → **Accept proposal** → type a name → **Accept**
- [ ] Page shows **✓ Accepted**; the **Pay deposit $X** bar appears
- [ ] 📲 Producer push: **"{name} accepted your Test Client proposal"**
- [ ] App banner → **"Accepted by {name}"**; status chip → **Accepted**

**DB check**
```sql
select status, accepted_at, accepted_by_name from bids where id = '<BID_ID>';
-- status 'accepted', accepted_at set, name stored
```

- [ ] **Idempotent:** tap accept again (or reopen) → no error, no duplicate `accepted` event

---

## 6. Client pays the deposit  ← third push

- [ ] Tap **Pay deposit $X** → Stripe Checkout opens
- [ ] Pay with test card **4242 4242 4242 4242**, any future expiry, any CVC/zip
- [ ] Redirects back → page shows **"✓ Deposit paid — you're booked"**
- [ ] 📲 Producer push: **"Test Client paid a $X deposit — you're booked"**
- [ ] App banner → **"Deposit paid · booked"**; status chip → **Won**

**DB checks**
```sql
select status, amount_cents, provider_payment_id
from payments where bid_id = '<BID_ID>';                 -- status 'paid', pi_… set
select status, deposit_status from bids where id = '<BID_ID>'; -- 'won' / 'paid'
select type from bid_events where bid_id = '<BID_ID>';   -- …deposit_requested, deposit_paid
```

- [ ] **Webhook idempotency:** in Stripe → the event → **Resend** → DB unchanged, no duplicate `deposit_paid`, no second push
- [ ] In **Stripe → Connect → the test account**, the payment shows on the connected account (money routed to the producer)

---

## 7. Negative / security checks

- [ ] Bad token (`/p/garbage`) → friendly **"Proposal not found"** page, no crash
- [ ] **Pay before accept:** call deposit-checkout on a not-yet-accepted token → returns **409 "Please accept first"** (the UI hides the button, so test via curl)
- [ ] **Amount can't be tampered:** the client never sends a price — confirm checkout amount == `deposit_amount_cents` from the bid
- [ ] **No data leak:** the `proposal-public` JSON contains **no email, no user_id, no other bids**
- [ ] **Push denied:** on a fresh device, deny notification permission → app still works, link/accept/pay all still function (just no pushes)
- [ ] **Revoke:** `update bids set share_token = null where id = '<BID_ID>';` → the old link now 404s

---

## 8. Reset to re-run a clean test
```sql
update bids
set status='draft', share_token=null, shared_at=null, first_viewed_at=null,
    accepted_at=null, accepted_by_name=null, deposit_status='none'
where id = '<BID_ID>';
delete from bid_events where bid_id = '<BID_ID>';
delete from payments  where bid_id = '<BID_ID>';
```

---

## Sign-off
- [ ] All three pushes fired (opened / accepted / paid)
- [ ] Bid moved draft → sent → accepted → won automatically
- [ ] Money landed in the connected test account
- [ ] Webhook is idempotent; bad tokens fail safe; no PII leaks
- [ ] **Only after all green:** switch Stripe to **live keys** (`sk_live_…` + live webhook secret), redeploy `deposit-checkout` + `stripe-webhook`, and do **one** small real transaction as a final live check.

> Tip: keep Stripe Dashboard (test) → Developers → **Events/Logs** and Supabase → Edge Functions → **Logs** open side by side while testing — they show exactly where anything stalls.
