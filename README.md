# Tactical Aminos — cart & checkout update

Static HTML/CSS/JavaScript storefront with Firebase Authentication and profiles.
The frontend needs no npm build. Firebase modules load from Google’s CDN.
This update adds a complete cart and test checkout plus a server-side order
backend. Existing customer accounts and profiles are preserved.

**Leave `previewCheckout: true` in `site-settings.js` for this stage.** Test
checkout calculates totals but sends no order, takes no payment, and saves no
shipping details. The backend is included for the next setup stage.

## Included

- Blue/black/white home page using the supplied branding and reference layout.
- Public About and Contact pages with pending content clearly identified.
- Email/password signup, login, password reset, account page, and sign-out.
- Required 21+ and research-only confirmation, saved by Firebase UID.
- Responsive product-card preview with search, filters, and product dialogs.
- Cart quantities, remove buttons, account-scoped cart restoration, and totals.
- Automatic same-vial/mixed savings; first-order OR one promotional code.
- US shipping form, Venmo/PayPal choice, and the preserved payment note.
- Flat $8 shipping with no credit-card fee; TEST10 for previewing code discounts.
- Backend quote/submission functions, authenticated member catalog, and order history.
- Owner-only profiles, orders, and stats; customer writes to orders are denied.

## Not connected yet

Live ordering is not enabled. Backend deployment, actual inventory, admin tools,
affiliates, quarterly reports, calculator, QR code, and Resend are the next
stages. The product preview uses the 15 rows visible in the supplied
Numbers preview, with provisional categories and SVG vial illustrations. It
is not the final catalog or final product photography.

Preview products are public sample data bundled in `catalog.js`; the UI requires
login. Live mode loads products from the authenticated `memberCatalog` backend
and excludes the preview data from the UI. The UI gate does not provide
server-side protection for bundled sample assets.

Only the supplied artwork includes the actual logo. Header text and tab icon
are temporary code-rendered branding pending a separate logo asset. The original
artwork is unchanged; no new purity or COA claims appear on product cards.

## 1. Copy files onto your Mac

Copy this folder’s contents into your existing `tactical-aminos` repository
folder. Keep your local `.git` folder. Do not nest the starter inside a second
project folder. Replace files when Finder asks. Keep your existing `.git`
folder; no Git history is included in the update ZIP.

## 2. Confirm Firebase email/password is enabled

In project `tactical-aminos`, go to Authentication → Sign-in method and verify
Email/Password is enabled. Your web configuration is already included.

## 3. Publish database rules

In Firestore Database → Rules, replace the rules for Tactical Aminos with
the complete contents of `firestore.rules`, then select Publish.

Existing profiles remain compatible. These rules add owner-only order/history
reads and stats reads while denying all direct order writes. Actual order
creation is performed by the server using Firebase Admin. Later admin stages
will extend this model. Passwords are never stored in Firestore.

## 4. Authorize the local preview

In Authentication → Settings → Authorized domains, add `localhost` if absent.
Add the final website hostname when hosting is configured.

## 5. Preview

Open Terminal in the project folder:

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000`. Keep Terminal running; Control+C stops it.
Do not open `index.html` directly as a file page: JavaScript modules need an
HTTP server. If Python is unavailable, VS Code’s Live Server extension works.

## 6. Check your own Firebase project

1. Choose Member sign in → Create account.
2. Use a testing email you control, accept the confirmation, and create an account.
3. Confirm the catalog opens; search and open a product card.
4. Sign out and sign back in.
5. Test Forgot your password and check your inbox/spam folder.
6. Confirm the account under Firebase Authentication → Users.
7. Confirm Firestore `users/{UID}` has name, email, acceptance fields, and
   timestamps, with no password field.

For this update:

1. Sign in with your existing test account.
2. Add one BPC-157 10mg vial. With first-order discount selected, total is $42.20.
3. Increase to five BPC-157 vials: total is $160.00, including $8 shipping.
4. Choose Promotional code, enter TEST10, and select Apply. First-order savings
   must disappear; the total stays $160.00 because both promotions give 10%.
5. Choose No promotional discount: the five-vial total becomes $179.00.
6. Fill sample shipping details, choose Venmo or PayPal, accept research-only
   purchase, and complete test checkout. It must say no order was sent and no
   payment is due. Do not send any payment while testing.
7. Sign out. Shipping fields clear; signing in restores the product cart only.

Signup creates the Auth account before saving its profile. If profile access
fails, fix the rules and sign in with the existing account; do not recreate it.
The site can retry the acceptance/profile step if the profile was not saved.

## 7. Save to GitHub

From your existing repository folder:

```bash
git status
git add .
git commit -m "Add cart and validated checkout backend"
git push origin main
```

This assumes your branch is `main`; check with `git branch --show-current`.
A GitHub commit does not publish the website unless hosting is configured.

## Secrets

`firebase-config.js` contains public Firebase web configuration, not a Resend
key. Keep the Resend key in a server-side secret/environment variable when the
email backend is added. Never put it in these static files or GitHub. No access
to Mark’s Gmail is required.

## Backend activation — next setup stage

Firebase Functions runs the order service inside the existing Firebase project;
no separate email-worker account is needed for it. Deployment requires Firebase
Blaze billing. Mark can supply billing information without sharing Gmail access.
No backend deployment or billing changes have been made by this update.

After billing is ready and Node.js 22/Firebase CLI are available on your Mac:

```bash
npm install --prefix functions
npm test
firebase login
firebase deploy --only functions,firestore --project tactical-aminos
```

This deploys the backend/rules/indexes, not a public website. Keep preview mode
on until the admin/catalog setup below is complete.

Catalog initialization is prepared for the upcoming admin interface:

- A Firebase console document `config/admin` identifies the one admin by `uid`.
  Clients cannot create or edit this document.
- The admin-only `initializeDraftCatalog` function creates missing starter
  products with **zero stock**, preserves existing records, and creates
  `config/store` with `checkoutEnabled: false` if missing.
- Actual stock must be entered before enabling ordering. No stock is invented.
- `config/store` holds `checkoutEnabled`, `venmoHandle`, and `paypalHandle`.
  Missing PayPal details block live PayPal orders. Shipping stays $8.
- Discount documents use uppercase code IDs, e.g. `discountCodes/MARK10`, with
  `code`, `percentOff`, `active`, optional `affiliateUid`, `maxUses`, `usedCount`,
  `reservedUses`, and optional `expiresAt`/`startsAt` timestamps.
- When ready, set `previewCheckout: false`; live mode loads the backend catalog.
  Never enable orders using placeholder inventory or unfinished payment details.

`scripts/build-functions.mjs` copies the shared pricing engine and draft catalog
into the Functions bundle before deployment. Do not edit generated `functions/lib`
files; edit `shared/checkout-core.js` or `catalog.js` and rebuild.

## Pricing and order behavior

Corey's existing discount behavior is preserved: identical-vial savings are
capped to the first 5 or 10 units in a line. Five distinct compound groups earn
5% off the eligible subtotal; different strengths of one compound do not count
as two compounds. Bulk discounts can combine with the selected promotion and
with mixed savings, matching the source code. Discounts never reduce shipping.

The first submitted order qualifies for first-order savings. A submitted order
reserves that eligibility; retries do not consume it again. The admin cancellation
workflow will manage releases/restoration later. Promo usage reservations prevent
limited codes from being overused; they are **not** paid affiliate referral credit.

Orders are created as unpaid/unfulfilled, with immutable price/product snapshots.
Customer identity comes from verified Firebase tokens. Shipping/contact data is
validated server-side. The server checks inventory but does not deduct it until
the paid transition (admin phase). Concurrent unpaid orders can request the same
stock; the paid transition must recheck stock atomically.

Quote fingerprints require customers to review changed totals. Idempotency IDs
prevent a double-click or network retry from creating duplicate orders. The client
stores only a payload hash and ID for pending retries, not an address or phone.

Email sending is not connected; the receipt page does not promise an email.
Tax calculation is not configured in this stage. Live launch remains disabled
until pricing, inventory, payment, admin, and tax settings are finalized.

## Confirmed behavior for later stages

- Affiliate usage counts on each paid order; Mark assigns codes and rewards.
- First-order discount and promotional code are mutually exclusive.
- Corey’s bulk discount behavior is preserved as described above.
- Inventory decreases exactly once when an order is marked paid.
- Per-product low-stock thresholds; zero stock blocks new cart additions.
- Venmo and PayPal only; $8 shipping on every order; no local pickup.
- USPS Ground Advantage labeling; no guaranteed three-day arrival promise.
- Quarterly reports use paid orders: sales, order counts, shipping, discounts,
  and sales by product. Timing and refunds will be defined later.
- U-100 calculator: 30-, 50-, and 100-unit capacity; mg/mcg and water in mL.
  Syringe capacity does not change the measurement scale.
- About-page QR code follows selection of the permanent domain.

## Validation

Run `npm test` for pricing, validation, duplicate-submit behavior, stale prices,
code expiry/limits, stock checks, member gating, cart totals, preview checkout,
and session cleanup tests. Backend database operations are tested against an
in-memory transaction adapter; client handlers use mocked Firebase/DOM objects.
Desktop and mobile browser checks also passed with Firebase mocked: signup,
cart quantities, discount selection, test checkout, sign-out cleanup, and cart
restoration, with no horizontal overflow or JavaScript exceptions.
No real customer accounts or live database rules are changed by those tests.
Live Firebase Functions and rule enforcement must be checked after deployment.
