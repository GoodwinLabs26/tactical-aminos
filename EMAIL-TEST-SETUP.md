# Local email test

This update adds a manual local test. It sends TWO sample messages, both only to
**goodwinlabs.co@gmail.com**:

- A customer order confirmation, including the payment-note instructions.
- An admin new-order alert, explaining that payment must be verified first.

Messages use the Resend test sender `Tactical Aminos <onboarding@resend.dev>`.
Every subject begins `[TEST]`, and the messages say not to pay or ship anything.
The order, address and customer are sample data. The sample has no real payment
handle. Neither the website nor the admin demo imports or runs this sender.

## Add these files in VS Code

Keep the same folders as the download:

- `functions/email-templates.js`
- `scripts/test-email.mjs`
- `tests/email.test.js`
- `EMAIL-TEST-SETUP.md` (this guide, in the project root)

No package installation or Firebase/Cloudflare changes are required for this
local test. Use your existing Node installation (Node 22 or newer).

## Send the test

In the VS Code terminal:

```bash
cd ~/Projects/tactical-aminos &&
npm test &&
node scripts/test-email.mjs --send
```

When prompted, paste the Resend API key you saved, then press Enter.
**The key does not appear on screen. That is normal.** Enter it only at this
prompt, not in a source file, a shell command, or ChatGPT. The prompt does not
write the key to disk, an environment file, or shell history. Ctrl+C cancels.

The script sends a single batch request containing the two sample emails. It
prints two message IDs only after Resend accepts both. That confirms acceptance,
not inbox delivery. Check Inbox and Spam in Gmail, plus the Emails page in Resend.
Running the command again sends another pair of samples. If a timeout or network
error makes the result uncertain, check Resend before running it again.

If Resend returns 401, check the API key. For 403, check that the key has sending
permission and belongs to the account registered as goodwinlabs.co@gmail.com.
For 429, check sending limits in Resend. Do not share a screenshot containing a key.

## Preview without sending

```bash
node scripts/test-email.mjs --preview
```

This prints a temporary folder path containing HTML and plain-text previews.
Open the HTML files in a browser. Preview mode never asks for a key or calls Resend.
Generated previews are outside the project, so they are not published with it.

## Save the new code to GitHub

```bash
cd ~/Projects/tactical-aminos &&
npm test &&
git add functions/email-templates.js scripts/test-email.mjs tests/email.test.js EMAIL-TEST-SETUP.md &&
git commit -m "Add local order email tests for Goodwin Labs inbox" &&
git push origin main
```

Pushing does not send emails. No API key is in these files.

## What comes later

This is not automatic order email delivery. Checkout remains in preview mode;
admin demo actions still send no email. This script never connects to Firebase
and never changes orders, inventory, referrals, or report data.

Before launch, integrate the templates with the trusted order backend, deploy
that backend after Blaze billing is ready, and verify Mark's sending domain in
Resend using its DNS records (Cloudflare can manage those). Keep test-recipient
routing until deliberate live testing is complete. Then route admin alerts to
Mark and customer messages to their actual customers. Do not simply replace the
hardcoded test recipient in this sample script to turn it into production code.
Shipping and low-stock email templates/integration are separate next steps.
