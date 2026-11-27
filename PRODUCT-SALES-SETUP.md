# Product sales update

No sales are enabled by installing this update. Existing regular prices and inventory are preserved.

## Install and deploy backend

Run from the project folder after downloading this ZIP:

```sh
cd ~/Projects/tactical-aminos &&
unzip -o ~/Downloads/Tactical-Product-Sales-Update.zip -d . &&
export PATH="$(brew --prefix node@22)/bin:$PATH" &&
npm run build:functions &&
node --experimental-vm-modules --test tests/*.test.* &&
firebase deploy --only functions:manageSales,functions:currentSales,functions:memberCatalog,functions:quoteOrder,functions:submitOrder --project tactical-aminos
```

Check the local storefront and admin page using your usual local server. Once satisfied, commit and push the update to publish the website through your existing GitHub deployment:

```sh
git add admin.css product-availability.js sales-admin.js checkout-ui.js admin-api.js app.js styles.css admin.js index.html sales-storefront.js admin.html firebase-service.js shared/sales-core.js shared/checkout-core.js functions/sales-service.js functions/sales-functions.js functions/order-service.js functions/index.js tests/ui.test.js tests/admin.test.js tests/sales.test.js scripts/build-functions.mjs PRODUCT-SALES-SETUP.md &&
git commit -m "Add product sales, sale announcements and first-order banner" &&
git push origin main
```

## Mark's controls

1. Open Admin > Product sales. Search for the product and select its exact strength.
2. Enter a sale price, title and optional announcement. The regular price is the product's actual saved price.
3. Optional start and end dates use the time zone shown on your device. An empty start means immediately; an empty end means until stopped.
4. Additional discounts are off by default. Turn them on only if first-order, code and bulk savings should also apply to that sale price.
5. Leave Enable sale unchecked to save a draft. Check it and save when ready; review the confirmation before enabling.
6. Stop sale restores regular pricing. Edit and save to replace a sale or schedule another.

For the example, choose TA-3RT 30mg and enter 165. Its saved regular price must be greater than $165. Other strengths keep their own pricing.

## Storefront behavior

- A 10% first-order banner explains eligible items and shipping exclusions.
- Active sales show the regular price crossed out next to the sale price.
- Show in sale popup controls whether an active, in-stock product is announced. The popup appears once per tab session; shoppers can reopen it using Current sales.
- Storefront prices refresh about every minute and when returning to the page. Checkout always verifies the current price and sale dates on the server.
- A sale ending after a total was reviewed requires a new quote; an already-submitted order keeps its original price.
- No promotional email is sent by saving or enabling a sale. Use the existing Promotions tab separately.

Validation: 101 automated tests passed, plus storefront and admin browser checks using sample data.
