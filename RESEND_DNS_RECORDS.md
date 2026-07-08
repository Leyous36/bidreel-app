# Resend sending domain — DNS records for `send.bidreel.io`

Add these at Namecheap → Domain List → bidreel.io → **Advanced DNS**.
Namecheap's **Host** is relative to `bidreel.io` (don't type the root domain).
These live on isolated subdomains, so they do **not** touch your existing
bidreel.io email forwarding or the Vercel web/landing records.

## 1. DKIM (TXT) — required
- **Type:** TXT Record
- **Host:** `resend._domainkey.send`
- **Value:**
  `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDHJjkcmaid7m6UjdLhk49nTWhdBBxR+O7BKBH2+iy2Rjb/syKWHRxvTfo+HOEvt5myp1yX4/BRCrCXTrcjMdkaaQDhT4LPG9q42RotbWkD55rFUy7REEUuYfYjITsnp0XqO4OVk0WKHM1IQfNKxj54oJfO/PE7uIbsPcvrVTdUGQIDAQAB`
- **TTL:** Automatic

## 2. SPF (MX) — required
- **Type:** MX Record
- **Host:** `send.send`
- **Value:** `feedback-smtp.us-east-1.amazonses.com`
- **Priority:** 10
- **TTL:** Automatic

## 3. SPF (TXT) — required
- **Type:** TXT Record
- **Host:** `send.send`
- **Value:** `v=spf1 include:amazonses.com ~all`
- **TTL:** Automatic

## 4. DMARC (TXT) — optional, skipped
Resend lists this as optional. Skipping it for now so we don't add a
domain-wide DMARC policy that could affect existing bidreel.io mail.
(If wanted later: Host `_dmarc`, Value `v=DMARC1; p=none;`.)

---
Resend domain ID: 28b8470c-b82e-4d1d-839f-e507994404e6
Region: us-east-1 (N. Virginia)
