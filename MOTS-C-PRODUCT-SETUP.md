# MOTS-C product update

One MOTS-C card offers 10mg for $48 and 40mg for $95, as confirmed by Jasmine on
October 26, 2026. Each strength retains a separate SKU (`mots-c-10`, `mots-c-40`)
with independent stock, cart lines and order records. Category: Compounds.
The common compound key is `mots-c`; same-vial discounts still use exact SKUs.

No description was supplied. The card and View product therefore show the existing
“Product description coming soon.” placeholder. No scientific or health claims
were added to the description.

## Update in VS Code

Replace the full contents of these existing files with their matching downloads:

- `catalog.js`
- `styles.css`
- `tests/catalog.test.js`
- `functions/lib/catalog-draft.json`

Copy the actual `mots-c-product.png` image file into the project's `assets` folder.
Add this guide, `MOTS-C-PRODUCT-SETUP.md`, to the main project folder. Save all files.
This update reuses the existing app.js and catalog-view.js from the earlier product
updates; keep those files and the existing product images.

## Verify and push

```bash
cd ~/Projects/tactical-aminos &&
npm run build:functions &&
node --experimental-vm-modules --test tests/*.test.* &&
git add catalog.js styles.css tests/catalog.test.js functions/lib/catalog-draft.json assets/mots-c-product.png MOTS-C-PRODUCT-SETUP.md &&
git commit -m "Add MOTS-C strengths and product artwork" &&
git push origin main
```

After Vercel deploys, refresh, sign into the catalog, and search MOTS-C. Verify
that 10mg shows $48 and 40mg shows $95, then add one of each to check the separate
cart lines. The admin demo includes two independent MOTS-C inventory entries.

The functions build refreshes local seed data only; it does not deploy Firebase.
When the trusted backend is initialized later, these new SKUs start at zero real
stock for Mark to set. Checkout remains a preview. Testing, pushing and admin
demo actions do not send emails or change real customer data.

## Artwork

Project asset: `assets/mots-c-product.png`.
Mode: built-in image editing tool, using the GHK-Cu image as its edit target.
Prompt: Replace only GHK-Cu on the vial with MOTS-C in uppercase bold black,
on one centered line, scaled to fit with side margins. Keep the label free of
mg/mcg, strength text and badges. Preserve the square composition, logos, cap,
glass vial/powder, background, molecules, lighting, reflections, all other existing
wording/icons and footer. Do not redesign logos or add new claims or graphics.
Existing wording in the supplied artwork is retained, not independently verified.

## Checks

53 tests passed across the main/catalog/admin/checkout/calculator/reports/email
suites. Browser checks passed for member access, one MOTS-C card, loaded artwork,
per-strength prices and cart SKUs, description placeholder, modal quantity and
strength switching, search/categories, independent out-of-stock handling, two
admin inventory entries, backend seed consistency, D2's selector, and desktop/
390/320px layouts. Firebase was mocked; no real orders or emails were created.
