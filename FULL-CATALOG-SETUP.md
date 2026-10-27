# Complete catalog update

37 product cards, 48 strength/SKU options. Existing SKU IDs and prices were
preserved; Epithalon 10mg ($30) was added. KPV remains $45 because its latest
entry omitted a replacement price. Names IGF-1 LR3 and L-Carnitine were standardized;
the supplied spellings remain searchable.

Descriptions have been edited for readability and to distinguish research
findings from promised outcomes. MOTS-C and Epithalon now have descriptions.
31 new matching images complete artwork for every product card. Images are
illustrations edited from the supplied branding reference, not photographs of
verified inventory. Existing reference-image wording is retained, not verified.

## Install

Copy all files in this update into their matching locations in the project,
replacing existing files and merging folders. Do not replace an entire project
folder with this partial update. New product-availability.js is required.

For a ZIP saved in Downloads, use the VS Code terminal:

```bash
cd ~/Projects/tactical-aminos &&
unzip -o ~/Downloads/Tactical-Aminos-Full-Catalog-Update.zip -d . &&
npm run build:functions &&
node --experimental-vm-modules --test tests/*.test.*
```

If your browser automatically unzips the download, copy the contents of the
expanded folder instead, preserving its folder structure. Run the build and
tests after saving all files. Copy actual PNG files into assets; do not paste
image contents into text files.

## Push after reviewing

```bash
cd ~/Projects/tactical-aminos &&
git add app.js catalog.js catalog-view.js product-availability.js checkout-ui.js admin.js admin-demo.js styles.css scripts/build-functions.mjs functions/lib/catalog-draft.json tests/catalog.test.js tests/catalog-completeness.test.js tests/ui.test.js FULL-CATALOG-SETUP.md FULL-CATALOG-REVIEW.md assets/*-product.png &&
git commit -m "Complete product catalog, descriptions, and artwork" &&
git push origin main
```

## Details still needed

Incomplete entries are visible for review but Add to cart is disabled. They are
seeded unpublished, so recording stock alone cannot enable them. DSIP has a null
price, never a made-up zero price. See FULL-CATALOG-REVIEW.md for every listing.

- DSIP: price.
- Thymosin Alpha 1: vial strength.
- Cerebrolysin: volume and concentration.
- Kisspeptin: form/isoform and strength.
- Lipo-C Fat Blaster: volume/strength and complete formula.
- Super Human Blend: volume/strength and complete formula.
- Lipo-C and KLOW: complete formula and ingredient amounts/concentrations.
- SluPP: exact SLU-PP compound identifier and package format/amount per package.
- 5Amino1Q: confirm whether this is 5-Amino-1MQ and its package format.
- Adamax: exact sequence/formulation.

## Verification

57 code tests passed, including catalog prices, pending-item publication, forged
cart additions and saved-cart restoration. Browser checks covered 37 cards,
48 inventory entries, Epithalon/SS-31/IGF-1 LR3 strength prices and cart lines,
pending-item controls, alias search, descriptions, and 390/320px layouts.
Firebase was mocked. No real orders or emails were created. Preview checkout
and the admin demo remain in use; this update does not deploy paid backend services.

## Research references

https://pubmed.ncbi.nlm.nih.gov/25738459/ (MOTS-C, preclinical metabolism)
https://pubmed.ncbi.nlm.nih.gov/12937682/ (Epithalon, cell cultures)
https://pubmed.ncbi.nlm.nih.gov/24134698/ (SS-31, cardiolipin research)
https://pubmed.ncbi.nlm.nih.gov/9849822/ (ipamorelin)
https://pubmed.ncbi.nlm.nih.gov/16352683/ (CJC-1295)
https://pubmed.ncbi.nlm.nih.gov/18061177/ (KPV)

## Artwork method

Built-in image editing tool; each requested product received a separate edit of
the D2 reference. Prompt: replace only the central product name with the relevant
name, in bold black text scaled to fit, using two lines for long names or blends.
No mg/mcg/mL or strength badge. Preserve logos, vial/cap, background, reflections,
other reference text/icons and footer. No new claims. Saved as assets/<product-id>-product.png.
