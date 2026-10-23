# NAD+ product update

One NAD+ card offers three independently stocked strengths:

- 250mg: $40
- 500mg: $75
- 1000mg: $110

Strengths/prices were supplied by Jasmine on October 23, 2026. All three are new
catalog SKUs: nad-250, nad-500, nad-1000. They share the compound key nad+ for
mixed-discount calculations but remain separate for same-vial discounts, stock,
cart lines, orders, and reports. Category: Compounds.

## Add the update in VS Code

Replace the full contents of these existing files with the matching downloads:

- `app.js`
- `catalog.js`
- `catalog-view.js`
- `styles.css`
- `tests/catalog.test.js`
- `functions/lib/catalog-draft.json`

Add this guide, `NAD-PRODUCT-SETUP.md`, in the main project folder. Copy the actual
`nad-product.png` image file into the project's `assets` folder. Keep D2 and R3
images and files. Save all files before refreshing.

## Description

The card uses a short overview; View product shows the full overview and the
Mechanism of action section with two bullets (energy metabolism and NAD+-dependent
enzymes). Text corrects “two nucleotide rings” to two nucleotides linked through
phosphate groups. Cellular functions are described without claiming that these
vials improve fatigue, stamina or memory. No administration instructions added.

Reference for cellular mechanisms:
https://pmc.ncbi.nlm.nih.gov/articles/PMC7963035/
Reference for dinucleotide structure:
https://www.acs.org/molecule-of-the-week/archive/n/nicotinamide-adenine-dinucleotide.html

## Verify and push

```bash
cd ~/Projects/tactical-aminos &&
npm run build:functions &&
node --experimental-vm-modules --test tests/*.test.* &&
git add app.js catalog.js catalog-view.js styles.css tests/catalog.test.js functions/lib/catalog-draft.json assets/nad-product.png NAD-PRODUCT-SETUP.md &&
git commit -m "Add NAD+ strengths, artwork, and product details" &&
git push origin main
```

The wildcard runs both .test.js and .test.mjs files. No email is sent by tests or
pushing. The functions build refreshes local seed files; it does not deploy to
Firebase. Checkout remains a preview.

After Vercel deploys, refresh the member catalog and search NAD+. Try each strength:
250mg should show $40, 500mg $75, and 1000mg $110. Add one of each to confirm three
separate cart lines. View product shows the complete description and mechanisms.
The admin demo automatically includes three NAD+ inventory entries from catalog.js.
New products will be seeded into real inventory at zero stock when the trusted
backend is deployed and the authorized catalog initializer is run later; the
current update does not write to Firebase or enable live ordering.

## Artwork

Project asset: `assets/nad-product.png`.
Edited using the built-in image editing tool and the R3 artwork as the target.
Prompt: Replace only R3 on the central vial label with NAD+ in the same bold black
style, scaling to fit and centering on the white label. Do not add mg/mcg or a
strength badge. Preserve the square composition, logos, background, molecules,
reflections, vial/cap, other existing wording/icons and footer. Add no new claims.
Existing artwork wording is retained from the supplied reference, not verified.

## Checks

51 tests passed across main/catalog/checkout/admin/calculator/reports/email suites.
Browser checks passed for member access, one NAD+ card, three prices and cart lines,
correct totals, overview/mechanism sections, search/categories, D2/R3 details,
independent out-of-stock handling, three admin inventory entries, matching backend
seed data, and desktop/390/320px layouts. Firebase was mocked; no real orders or
emails were created during verification.
