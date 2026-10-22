# D2 product update

D2 now appears as one storefront card with 30mg and 60mg strength buttons. The
existing prices stay at $150 and $240. The selected strength controls the price,
availability, detail window and exact SKU added to the cart.

Both strengths remain separate in inventory, orders and reports. Their IDs are
still `d2-30` and `d2-60`. Bulk discounts still require identical strength/SKU
where appropriate. No stock, customer data or real orders were changed.

The card shows a price range plus the selected strength's price. The complete
description appears in View product. Search still finds individual strengths.
Phone product cards now use a single column to keep the artwork and controls
readable. Other products retain their existing content and grouping.

## Add the files in VS Code

Replace the full contents of these three existing files, then save:

- `app.js`
- `catalog.js`
- `styles.css`

Create these new code files in the indicated locations and copy their contents
from the download:

- `catalog-view.js` — project root
- `tests/catalog.test.js` — tests folder
- `D2-PRODUCT-SETUP.md` — project root (this guide)

Copy the actual **d2-product.png** image file into your project's **assets**
folder. Do not replace `tactical-reference.png`, which is used elsewhere.
Save all files before refreshing.

## Verify

```bash
cd ~/Projects/tactical-aminos &&
npm test
```

Open the site through Live Server, sign in, and enter the catalog:

1. Search D2. There should be one card with 30mg and 60mg buttons.
2. Choose 30mg: the selected price is $150. Choose 60mg: it becomes $240.
3. View product shows the complete description and the D2 image without mg text.
4. Add one of each strength. The cart must show two separate lines.
5. Checkout remains a preview. Admin demo activity still sends no emails.

## Push

```bash
cd ~/Projects/tactical-aminos &&
npm test &&
git add app.js catalog.js styles.css catalog-view.js assets/d2-product.png tests/catalog.test.js D2-PRODUCT-SETUP.md &&
git commit -m "Combine D2 strengths and add product artwork and description" &&
git push origin main
```

After Vercel finishes deploying, refresh and sign into the member catalog.

## Artwork

Saved project path: `assets/d2-product.png`.
Mode: built-in image generation/editing tool, using the supplied PNG as the edit
target. The original reference is preserved. Existing wording elsewhere in the
supplied artwork is retained; the edit is not independent verification of it.

Edit prompt: Replace the central vial label's PT-141 with D2 in bold black,
remove 10mg and its blue strength badge, and leave clean white label space there.
Preserve the square composition, Tactical Aminos logos, background, vial, blue
cap, molecular graphics, reflections, other text, icons and footer. Do not add
strength text, new labels or claims.

## Validation

Main suite: 39 checks passed, including the new grouping/selection/search checks.
Existing email tests were also run separately: 10 passed (the repository has
that test file named email.test.mjs, which the current *.test.js command skips).
Browser checks passed for the member gate, correct per-strength cart prices,
modal quantity/strength switching, search and categories, a zero-stock strength
with another available strength, and 390/320px layouts. Firebase was mocked;
no real orders or emails were created during these checks.
