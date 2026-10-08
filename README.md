# Tactical Aminos — foundation

The first working stage of Mark’s site. A static HTML/CSS/JavaScript project
with Firebase Authentication and Cloud Firestore customer profiles. No npm
build is required. Firebase modules load from Google’s CDN.

## Included

- Blue/black/white home page using the supplied branding and reference layout.
- Public About and Contact pages with pending content clearly identified.
- Email/password signup, login, password reset, account page, and sign-out.
- Required 21+ and research-only confirmation, saved by Firebase UID.
- Responsive product-card preview with search, filters, and product dialogs.
- Owner-only profile rules; all other collections denied for this phase.

## Not connected yet

Checkout, orders, discounts, admin, inventory, affiliates, quarterly reports,
calculator, QR code, and Resend email delivery are the next stages. No orders
can be submitted. The product preview uses the 15 rows visible in the supplied
Numbers preview, with provisional categories and SVG vial illustrations. It
is not the final catalog or final product photography.

Preview products are public sample data bundled in `catalog.js`; the UI
requires login to view them. In the production phase, private catalog and
inventory records must come from authenticated Firestore reads. The UI gate
does not provide server-side protection for bundled samples.

Only the supplied artwork includes the actual logo. Header text and tab icon
are temporary code-rendered branding pending a separate logo asset. The original
artwork is unchanged; no new purity or COA claims appear on product cards.

## 1. Copy files onto your Mac

Copy this folder’s contents into your existing `tactical-aminos` repository
folder. Keep your local `.git` folder. Do not nest the starter inside a second
project folder.

## 2. Confirm Firebase email/password is enabled

In project `tactical-aminos`, go to Authentication → Sign-in method and verify
Email/Password is enabled. Your web configuration is already included.

## 3. Publish database rules

In Firestore Database → Rules, replace the rules for this EMPTY project with
the complete contents of `firestore.rules`, then select Publish.

These rules cover only the foundation. They do not yet grant admin access or
allow orders. Later stages will extend them. Customer passwords are never
written to Firestore. Profiles use `users/{Firebase Authentication UID}`.

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

Signup creates the Auth account before saving its profile. If profile access
fails, fix the rules and sign in with the existing account; do not recreate it.
The site can retry the acceptance/profile step if the profile was not saved.

## 7. Save to GitHub

From your existing repository folder:

```bash
git status
git add .
git commit -m "Add Tactical Aminos website foundation"
git push origin main
```

This assumes your branch is `main`; check with `git branch --show-current`.
A GitHub commit does not publish the website unless hosting is configured.

## Secrets

`firebase-config.js` contains public Firebase web configuration, not a Resend
key. Keep the Resend key in a server-side secret/environment variable when the
email backend is added. Never put it in these static files or GitHub. No access
to Mark’s Gmail is required.

## Confirmed behavior for later stages

- Affiliate usage counts on each paid order; Mark assigns codes and rewards.
- First-order discount and promotional code are mutually exclusive.
- Corey’s bulk discounts stay, with edge-case behavior to be finalized.
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

JavaScript syntax and account/search handlers were checked with mocked
Firebase and DOM objects, including failed-profile recovery. Browser visual
checks could not run in the build environment, so desktop/mobile rendering
still needs to be reviewed in your preview. No real customer account or live
database rules were changed. Validate Firebase with the steps above after
publishing the rules.
