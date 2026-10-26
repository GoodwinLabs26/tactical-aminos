# Epithalon product update

One Epithalon card offers 40mg for $70 and 50mg for $95, as supplied by Jasmine on
October 26, 2026. Each strength has its own SKU (`epithalon-40`, `epithalon-50`),
stock count, cart line and order record. Category: Compounds. The shared compound
key is `epithalon`; same-vial discounts still require the identical strength/SKU.

The description remains “Product description coming soon.” until copy is supplied.
No scientific, health or administration claims were added to the description.

## Update in VS Code

Replace the entire contents of the matching existing files with the downloads:

- `catalog.js`
- `styles.css`
- `tests/catalog.test.js`
- `functions/lib/catalog-draft.json`

Copy the actual `epithalon-product.png` image file into the project's `assets`
folder. Add this guide, `EPITHALON-PRODUCT-SETUP.md`, to the main project folder.
Keep the existing app.js, catalog-view.js and other images from previous updates.
Save all files before refreshing.

## Verify and push

```bash
cd ~/Projects/tactical-aminos &&
npm run build:functions &&
node --experimental-vm-modules --test tests/*.test.* &&
git add catalog.js styles.css tests/catalog.test.js functions/lib/catalog-draft.json assets/epithalon-product.png EPITHALON-PRODUCT-SETUP.md &&
git commit -m "Add Epithalon strengths and product artwork" &&
git push origin main
```

After Vercel deploys, refresh, sign into the catalog and search Epithalon. Selecting
40mg should show $70; selecting 50mg should show $95. View product lets you switch
strengths and set quantity. Add one of each and confirm separate cart lines. The
admin demo includes two independent Epithalon inventory entries.

The functions build refreshes local seed data only; it does not deploy Firebase.
When the trusted backend is initialized later, new SKUs start at zero real stock
for Mark to set. Checkout remains a preview. Tests, pushing and admin demo actions
do not send emails or change real customer records.

## Artwork

Project asset: `assets/epithalon-product.png`.
Mode: built-in image editing tool, using the MOTS-C artwork as the edit target.
Prompt: Replace only MOTS-C on the central vial label with EPITHALON, uppercase
and bold black on one centered line, scaled to fit with side margins. Do not add
mg/mcg, strength numbers or badges. Preserve logos, cap, glass vial/powder,
background, molecules, lighting/reflection, other existing wording/icons, footer
and square composition. Do not redesign logos or add new claims.
Existing wording in the supplied artwork is retained, not independently verified.

## Checks

54 tests passed across main/catalog/admin/checkout/calculator/reports/email suites.
Browser checks passed for member access, one Epithalon card, artwork loading,
per-strength prices and cart SKUs, description placeholder, detail-window quantity
and strength switching, search/categories, independent out-of-stock handling, two
admin inventory entries, matching backend seed data, D2's selector, and desktop/
390/320px layouts. Firebase was mocked; no real orders or emails were created.
