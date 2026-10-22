# Local email tests

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

## Send order confirmation samples

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

## Send shipping and low-stock samples

After adding the updated files, run:

```bash
cd ~/Projects/tactical-aminos &&
npm test &&
node scripts/test-email.mjs --send-alerts
```

Enter your saved Resend key only at the hidden prompt. This sends TWO more sample
emails, both only to goodwinlabs.co@gmail.com:

- Shipping confirmation with a USPS tracking link. Its tracking number is all
  zeros and explicitly labeled as a sample; no shipment was created.
- Low-stock alert for KPV 10mg: **Only 10 vials left**. No inventory was changed.

This command does not resend the first two order emails. The shipping template
rejects unpaid orders, orders not marked shipped, cancelled orders, and invalid
tracking numbers. The low-stock template handles singular vials and out-of-stock
counts, and says that the count was recorded at the time of the alert. Check
Inventory for current stock when using this template in the future.

## Preview without sending

```bash
node scripts/test-email.mjs --preview
```

This prints a temporary folder path containing HTML and plain-text previews of
all FOUR templates (the two order emails, shipping confirmation, and stock alert).
Open the HTML files in a browser. Preview mode never asks for a key or calls Resend.
Generated previews are outside the project, so they are not published with it.

## Save the new code to GitHub

```bash
cd ~/Projects/tactical-aminos &&
npm test &&
git add functions/email-templates.js scripts/test-email.mjs tests/email.test.js EMAIL-TEST-SETUP.md &&
git commit -m "Add shipping and low-stock email tests" &&
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
Shipping and low-stock templates are included. Their automatic delivery still
needs to be integrated with the trusted backend, alongside order confirmations.
