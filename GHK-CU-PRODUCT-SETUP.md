# GHK-Cu product update

One card offers 50mg for $45 and 100mg for $75, as supplied by Jasmine on October
23, 2026. The variants remain separate SKUs (`ghk-cu-50`, `ghk-cu-100`) with
independent stock, cart lines, order records and same-vial discounts. Both use
compound key `ghk-cu`. Category: Compounds.

## Install in VS Code

Replace the full contents of the matching existing files, then save:

- `catalog.js`
- `styles.css`
- `tests/catalog.test.js`
- `functions/lib/catalog-draft.json`

Copy the actual `ghk-cu-product.png` image into the project's `assets` folder.
Add this guide, `GHK-CU-PRODUCT-SETUP.md`, to the main project folder.
This update reuses the grouping and structured-description support added for D2,
R3 and NAD+. Keep the existing app.js and catalog-view.js from those updates.

## Description

View product shows an overview plus Research areas and Research context sections.
The text distinguishes fibroblast/cell-culture, preclinical and specific topical
formulation findings from outcomes for this research preparation. It does not
promise wrinkle changes within 4–12 weeks, recommend post-procedure use or claim
hair growth/thickness from these vials. It does not add administration directions.

References used for the research-focused wording:

- Collagen synthesis in fibroblast cultures: https://pubmed.ncbi.nlm.nih.gov/3169264/
- Matrix remodeling enzyme expression in fibroblast cultures: https://pubmed.ncbi.nlm.nih.gov/11045606/
- Preclinical connective tissue research: https://www.jci.org/articles/view/116842
- Topical formulation and cell-culture study: https://www.walshmedicalmedia.com/open-access/effects-of-ghkcu-on-mmp-and-timp-expression-collagen-and-elastin-production-and-facial-wrinkle-parameters-2329-8847-1000166.pdf

## Verify and push

```bash
cd ~/Projects/tactical-aminos &&
npm run build:functions &&
node --experimental-vm-modules --test tests/*.test.* &&
git add catalog.js styles.css tests/catalog.test.js functions/lib/catalog-draft.json assets/ghk-cu-product.png GHK-CU-PRODUCT-SETUP.md &&
git commit -m "Add GHK-Cu strengths, artwork, and product details" &&
git push origin main
```

The build refreshes local seed data; it does not deploy Firebase or change real
stock. The wildcard includes both .test.js and .test.mjs files. Testing and pushing
do not send email. Checkout remains a preview. When the trusted backend is
prepared later, these two SKUs will be initialized at zero stock for Mark to set.

After Vercel deploys, refresh, sign into the member catalog, and search GHK-Cu.
Check that 50mg shows $45 and 100mg shows $75. Add one of each and confirm separate
cart lines. View product shows the complete description. The admin demo includes
two independent GHK-Cu inventory entries from catalog.js.

## Artwork

Saved project path: `assets/ghk-cu-product.png`.
Made using the built-in image editing tool with the NAD+ image as its edit target.
Prompt: Replace only NAD+ on the central vial label with GHK-Cu in bold black,
on one line and scaled to fit with side margins. Keep the label strength-free.
Preserve logos, cap, glass vial and powder, background, molecular graphics,
lighting, reflections, other existing wording/icons and footer. Add no new claims.
Existing artwork wording is retained from the supplied reference, not verified.

## Checks

52 tests passed across main/catalog/admin/checkout/calculator/reports/email suites.
Browser checks passed for member access, one GHK-Cu card, loaded image, the two
prices/cart SKUs, detail-window quantity and strength switching, search/categories,
independent out-of-stock handling, two admin inventory entries, backend seed
consistency, D2's selector, and 390/320px layouts. Firebase was mocked; no real
orders or emails were created during verification.
