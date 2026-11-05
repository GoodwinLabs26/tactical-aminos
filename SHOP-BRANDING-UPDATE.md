# Shop layout and original logo update

Replace: index.html, app.js, styles.css, admin.html, admin.css, tests/ui.test.js, assets/favicon.svg.
Add: assets/tactical-logo.svg and this guide.

Copy these into the matching project locations. Merge folders; do not replace the entire project with this partial update. Copy the SVG files themselves rather than pasting image data.

The logo and browser icon display the exact artwork from the black Tactical Aminos brand board supplied by Jasmine. SVG viewports frame the embedded original PNG; the logo was not redrawn or generated. These are raster-backed SVG files, not new vector master logos. The gray alternate board was not used. Existing product artwork remains in place.

The shop now includes a desktop category sidebar, mobile category filters, price/name sorting, search, three-column desktop cards and responsive product details with Description/Disclaimer tabs. Prices, inventory, checkout and discounts remain as configured. COA sections were not added.

59 tests passed. Browser preview used a mock member and practice admin data: sorting, search, strength/price changes, quantity, cart confirmation, tabs, loaded logo and phone layouts were checked. No live orders, emails, Firebase billing or deployment changed.

Run in VS Code:

```bash
cd ~/Projects/tactical-aminos &&
node --experimental-vm-modules --test tests/*.test.* &&
git add index.html app.js styles.css admin.html admin.css tests/ui.test.js assets/favicon.svg assets/tactical-logo.svg SHOP-BRANDING-UPDATE.md &&
git commit -m "Update shop layout and use original Tactical Aminos logo" &&
git push origin main
```
