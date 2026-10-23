# R3 product update

R3 now uses the same one-card layout as D2, with 20mg ($145) and 30mg ($200)
strength buttons. Prices are from the existing catalog. Each strength retains its
SKU, stock, order history, and discount behavior. D2 remains grouped as before.

Description supplied by Jasmine:
An investigational, once-weekly injectable peptide (a chain of amino acids).

## Files

Replace the complete contents of these existing files in VS Code, then save:

- `catalog.js`
- `styles.css`
- `tests/catalog.test.js`

Copy the actual `r3-product.png` image file into the project's `assets` folder.
Add this `R3-PRODUCT-SETUP.md` guide to the main project folder.
This update builds on the D2 update; keep `catalog-view.js` and the D2 image.

## Test and push

```bash
cd ~/Projects/tactical-aminos &&
npm test &&
git add catalog.js styles.css tests/catalog.test.js assets/r3-product.png R3-PRODUCT-SETUP.md &&
git commit -m "Combine R3 strengths and add artwork and description" &&
git push origin main
```

After Vercel deploys, refresh, sign into the catalog, and search R3. There should
be one card. Selecting 20mg shows $145; selecting 30mg shows $200. View product
shows the description and strength-free R3 artwork. Add one of each strength
and check that the cart shows two separate lines.

## Artwork

Project asset: `assets/r3-product.png`.
Created with the built-in image editing tool, using the D2 artwork as the target.
Prompt: Replace only D2 on the central vial label with R3 in the same bold black
font, size and centered position. Preserve the strength-free label, square
composition, logos, blue cap, vial, background, molecules, reflections, all other
existing wording and footer. Do not add strength text, new labels or claims.
Existing wording in the supplied artwork is retained, not independently verified.

## Verification

50 tests passed across the main and existing email suites. The normal npm test
command runs the .test.js files; existing email.test.mjs was included using:

```bash
node --experimental-vm-modules --test tests/*.test.*
```

Browser checks passed for member access, one R3 card, loaded artwork, independent
20mg/30mg prices and cart lines, detail-window quantity/strength switching, search,
categories, an out-of-stock 20mg with available 30mg, D2's selector, and 390/320px
layouts. Firebase was mocked. No real orders or emails were created.
