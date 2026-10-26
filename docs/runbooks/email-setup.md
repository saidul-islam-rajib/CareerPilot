# Email setup: Gmail + Cloudflare Email Routing

CareerPilot sends account email (registration links, password-reset links, verification codes) as **`CareerPilot <info@team-sober.com>`**, the same way the Mess project sends as `admin@team-sober.com`: Gmail's SMTP server with an App Password and a verified "Send mail as" alias. It is free (about 500 recipients a day).

| Direction | Who does it |
|---|---|
| Receiving `info@team-sober.com` | Cloudflare Email Routing forwards it to `saidul.rajib.online@gmail.com` |
| Sending as `info@team-sober.com` | Gmail SMTP (`smtp.gmail.com:587`, STARTTLS) signed in as `saidul.rajib.online@gmail.com` |

## How CareerPilot decides

- `CAREERPILOT_MAIL_USER` and `CAREERPILOT_MAIL_PASSWORD` set → account email goes to real inboxes, in any environment.
- Either one empty → account email goes to Mailpit (http://localhost:8025), as before.
- Mail to `@sober.com` (seeded demo accounts) and reserved example domains (`example.com`, `.org`, `.net`) always stays in Mailpit.
- Job-application email and daily digests never leave Mailpit outside production.
- Settings that are not secret (sender address, SMTP host, port, security) live in `config/defaults/mail.yaml`.

## Already done on team-sober.com (checked 2026-10-26)

- MX records point to Cloudflare Email Routing.
- SPF already authorises Google: `v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all`. Do not add a second SPF record.
- No DMARC record yet (optional, see the end).

## Steps for the owner (needs your Google and Cloudflare accounts)

1. **Cloudflare: make sure `info@team-sober.com` forwards to Gmail.** Dashboard → `team-sober.com` → Email → Email Routing → Routing rules. There must be a rule `info@team-sober.com → saidul.rajib.online@gmail.com`, and that Gmail address must be a verified destination. Check by sending any email to `info@team-sober.com`; it should arrive in `saidul.rajib.online@gmail.com`.
2. **Google: turn on 2-Step Verification** for `saidul.rajib.online@gmail.com` (https://myaccount.google.com/security).
3. **Google: create an App Password** at https://myaccount.google.com/apppasswords, name it `CareerPilot`, and copy the 16 characters. Your normal Gmail password does not work for SMTP.
4. **Gmail: add the send-as alias.** In `saidul.rajib.online@gmail.com`: Settings (gear) → See all settings → Accounts and Import → Send mail as → Add another email address. Name `CareerPilot`, email `info@team-sober.com`, keep "Treat as an alias" ticked, choose "Send through Gmail". Gmail emails a confirmation code to `info@team-sober.com`; Cloudflare forwards it to the same inbox. Click the link or paste the code. Without this, Gmail refuses to send as `info@team-sober.com`.
5. **Put the App Password in `.env`** in the project folder (the file is ignored by git; never commit it):

   ```
   CAREERPILOT_MAIL_USER=saidul.rajib.online@gmail.com
   CAREERPILOT_MAIL_PASSWORD=your-16-character-app-password
   ```

6. **Restart the API** so it reads the new values: `docker compose up -d user-api`.
7. **Test.** Register at http://localhost:3000/register with `saidul.rajib.online+test1@gmail.com` (Gmail delivers `+anything` addresses to the same inbox, so you can test new registrations repeatedly). The email **Finish creating your CareerPilot account** arrives from `CareerPilot <info@team-sober.com>`; the first one may land in Spam, so mark it "Not spam". `saidul.rajib.online@gmail.com` itself is already registered, so registering it again sends **You already have a CareerPilot account** instead.

## Production

Set the same two values in the production secret store and restart the API; nothing else changes. `notifications.web_base_url` must be the public web address so links in the email point to it.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Page says "We couldn't send the email" | Gmail rejected the login: create a new App Password (step 3) and update `.env`, then `docker compose up -d user-api`. |
| Mail arrives "from" the Gmail address instead of `info@team-sober.com` | The send-as alias is missing or unverified (step 4). |
| Mail lands in Spam | Mark it "Not spam" once. For production volume, add DMARC (below) or move to a provider with DKIM for `team-sober.com` (Brevo or Resend free tiers); only the SMTP host, user, and password change. |
| Nothing arrives at all | The address may be at a protected domain (`@sober.com`, `example.com`): look in Mailpit. |

## Optional: DMARC

Add a TXT record `_dmarc.team-sober.com` with `v=DMARC1; p=none; rua=mailto:info@team-sober.com` to receive reports without affecting delivery. Do not use `p=reject` with free Gmail sending: DKIM is signed as `gmail.com`, so only SPF aligns.
