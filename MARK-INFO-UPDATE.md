# Mark product information update

Install after the Shop and Logo update. Replace the 12 code/image files in this package in their matching project locations. Add MARK-PRODUCT-REFERENCE.md and MARK-INFO-UPDATE.md.

D2 is now TA-2TZ and R3 is now TA-3RT. Original SKU IDs, strengths, prices and image filenames remain unchanged. Legacy names remain search aliases, including name-plus-strength searches. Images have the new product names.

Ten supplied descriptions are applied: TA-2TZ, TA-3RT, BPC-157/TB-500, CJC-1295 No DAC/Ipamorelin, Tesamorelin, Melanotan-I (MT-1 copy), Melanotan-II (MT-2 copy), PT-141, KLOW and Glutathione. Both paragraphs, research tagline and disclaimer are shown. These are Mark-supplied descriptions, not independently verified specifications.

The standalone TB-500 description is retained in MARK-PRODUCT-REFERENCE.md but not applied to TB-4. Confirm whether this is a new product or a rename/replacement before changing the TB-4 listing.

PayPal email: tacticalaminos@gmail.com. Supplied reference ID: UFYAF6QJ57VLN. The email is used as the payment handle; no guessed payment link was added. Payment details remain absent from the cart. Preview checkout remains on; automated email delivery is not enabled by this update.

The Functions default settings now include PayPal for a future first initialization. Existing Firestore config/store records are not overwritten by initialization: their PayPal settings must be updated when the live backend is connected. Existing live product records are likewise not renamed by this frontend/build update. Historical orders retain their saved names. No Firebase deployment or data migration is included.

60 tests passed. Browser checked old-name/strength search, renamed products, full paragraph rendering and KLOW ingredient amounts using a mock member account. No email or real order was sent.

Artwork: built-in image editing. Each existing D2/R3 image was the edit target. Prompt: replace only the central bottle product name with TA-2TZ or TA-3RT in bold black lettering, fitting within its white label; add no strength; preserve all other artwork. Saved to assets/d2-product.png and assets/r3-product.png.

VS Code terminal:

```bash
cd ~/Projects/tactical-aminos &&
npm run build:functions &&
node --experimental-vm-modules --test tests/*.test.* &&
git add catalog.js catalog-view.js app.js styles.css site-settings.js index.html functions/index.js functions/lib/catalog-draft.json tests/catalog.test.js tests/catalog-completeness.test.js assets/d2-product.png assets/r3-product.png MARK-PRODUCT-REFERENCE.md MARK-INFO-UPDATE.md &&
git commit -m "Add Mark product descriptions, renamed products, and PayPal details" &&
git push origin main
```
