# Tactical Aminos admin update

This update adds Orders, Inventory, Codes & affiliates, Customers, and Low-stock
notices in a separate `admin.html` dashboard. The storefront stays in test checkout
mode. No live deployment, account creation, or Firebase changes were performed.

## Add the files in VS Code

Download and unzip `Tactical-Aminos-Admin-Update.zip` into Downloads. Its contents
are only the files for this update, organized by their destination folder.
Open your existing `Projects/tactical-aminos` folder in VS Code.

For each file below, create a file with the same name in the indicated folder.
Open the downloaded source file in VS Code, copy its complete contents, and paste
into the matching project file. Save with Command+S.

| Destination folder | Files |
| --- | --- |
| Main project folder | `admin.html`, `admin.css`, `admin.js`, `admin-api.js`, `admin-demo.js`, `ADMIN-SETUP.md` |
| `functions` folder | `admin-service.js` (new), `index.js` (replace its complete contents) |
| `tests` folder | `admin.test.js` (new) |

Only `functions/index.js` replaces an existing file. Keep it inside `functions`.
No `package.json`, Firestore rules, storefront settings, or product file needs
changing for this update. The existing rules continue to deny direct admin-data
access; the backend uses authenticated admin-only callable actions.

Alternatively, copy the extracted package's files into the matching project
folders using Finder. Keep the `functions` and `tests` directory structure and
replace `functions/index.js` when asked.

## Test the practice dashboard first

Right-click `admin.html` in the VS Code Explorer and select Open with Live Server.
Add `?demo=1` to its browser address, so it ends in `admin.html?demo=1`.
For example, `http://127.0.0.1:5500/admin.html?demo=1`.
If your existing Python preview is still running, you can instead use
`http://localhost:8000/admin.html?demo=1`.

The blue Practice dashboard banner must be visible. No sign-in is needed for
sample data. This mode does not import the Firebase client, modify the live
project, send email, or collect payment. Reload resets all practice changes.

1. In Orders, find TA-DEMO-001 ($160) and select Mark paid. Confirm payment.
2. In Inventory, BPC-157 10mg should fall from 8 vials to 3.
3. In Codes & affiliates, Sample Affiliate should have 1 paid referral;
   DEMO10 should have 1 paid use and 0 pending uses.
4. In Low-stock notices, BPC-157 should show stock reached 3, threshold 3.
5. In Inventory, set BPC-157 to 0 and Save stock. It should show Out of stock.
6. Create FRIEND15 at 15%, linked to Sample Affiliate, then Save code.
7. Return to Orders. Enter `9400111899223856920000` on TA-DEMO-001,
   select Mark shipped, and confirm. Tracking should appear. No email is sent.
8. Cancel the other unpaid order, TA-DEMO-002. It should become cancelled.
9. Reload the page. The sample orders and inventory should reset.

A new notice is created when stock crosses into low stock, including after a
restock. Further decreases while already low do not create duplicate notices.
Notices record the stock level at that time; current stock is in Inventory.

## Save the update through VS Code's terminal

Save all files, then use Terminal -> New Terminal in VS Code:

```bash
git add admin.html admin.css admin.js admin-api.js admin-demo.js ADMIN-SETUP.md functions/index.js functions/admin-service.js tests/admin.test.js
git commit -m "Add admin dashboard for orders inventory and affiliates"
git push origin main
```

If Git rejects the push, keep your changes and resolve the synchronization issue
before pushing again. Do not force push.

## Real admin connection — next setup stage

The practice dashboard works before Firebase Functions is deployed. The real
page, `admin.html` without `?demo=1`, requires Firebase sign-in and a server check
against `config/admin.uid`. A link, a client role field, or knowledge of the admin
URL never grants access. Only one UID is configured at a time.

Firebase Functions deployment requires the Blaze billing plan. Mark can enter
billing information himself. No access to his Gmail inbox is needed. References:
https://firebase.google.com/docs/functions/get-started

Once billing and Node.js 22/Firebase CLI are ready, these commands run in the
VS Code terminal from the project's main folder:

```bash
npm install --prefix functions
npm test
firebase login
firebase deploy --only functions,firestore --project tactical-aminos
```

These deploy backend functions, database rules, and indexes; they do not publish
the public website or enable customer checkout. Keep `previewCheckout: true`.

Configure the admin after deployment:

1. Use an existing Firebase email/password account for testing. Copy its UID
   from Firebase Authentication -> Users. Creating a Firebase email/password
   account does not grant access to that person's email inbox.
2. In Firestore Database -> Data, create collection `config`, document `admin`.
   Add one string field `uid` containing the exact chosen account UID.
   Do this in the Firebase console; the website cannot edit its own admin role.
3. Open `admin.html` without the demo parameter and sign in with that account.
   Select Initialize draft catalog once. Missing products are created with zero
   stock; existing product records are preserved. Existing store settings are
   preserved. A new store configuration has ordering disabled.
4. Enter actual stock and each low-stock threshold in Inventory. Do not use the
   practice quantities as real inventory.
5. For handoff, replace `config/admin.uid` with Mark's Firebase account UID.
   Only the newly configured account can perform future admin actions.

Do not enable real customer orders yet. Email delivery, final payment details,
product catalog/content, and launch settings are still pending.

## What this stage does

- Inventory counts and individual alert thresholds, with revision checks so a
  stale browser cannot overwrite stock changed by a paid order.
- Record verified manual payment; stock, paid-code uses, customer paid totals,
  and affiliate paid-referral totals are updated atomically exactly once.
- Insufficient stock blocks the entire paid transition, without partial changes.
- Pending orders do not reserve inventory. Payment must recheck actual stock.
- Cancel unpaid orders, releasing code and first-order reservations exactly once.
- Record and update USPS tracking after payment. Tracking email is explicitly
  marked not connected, and the dashboard does not claim it was sent.
- Create/edit percentage codes, active status, use limit (0 unlimited), and the
  assigned affiliate customer. Customers must already have a member profile.
- An affiliate link cannot change after that code has pending or paid uses;
  create a separate code for a different affiliate. Existing expiry/start dates,
  if present, are preserved; editing dates is not in this UI yet.
- Every paid order using the affiliate code counts, including repeat customers.
  Mark grants rewards manually. Referral sales shown include shipping.
- Customers are member profiles in Firestore, not passwords or auth credentials.
- Page through lists in batches of 50. Summary cards use loaded records, not
  all-time report totals. Load more Customers before choosing a customer beyond
  the initial page in the code form.

## Still to add

Resend delivery (low stock, tracking, confirmations, and promotions), paid-order
refund handling, QR code, final product assets,
and remaining promotional-code tools. The dashboard currently records notices;
it does not send them. The store's first-order and code selection remains exclusive.

## Verification

`npm test` passes 19 automated tests, including unauthorized access, duplicate
paid transitions, competing stock demands, cancellation, stale inventory,
affiliate linking, tracking, and existing cart/checkout behavior.
Transaction tests use an in-memory adapter that rejects reads after writes.
Desktop/mobile browser checks passed for paid orders, stock, notices, codes,
tracking, cancellation, and ordinary-customer denial with Firebase mocked.
No browser JavaScript exceptions or horizontal overflow were found.
Real callable authorization, database rules, and index readiness still need a
check against the configured project after deployment. No live credentials,
customer data, or email keys are in this update.

## Quarterly reports update

Quarterly website sales reports are now available. See REPORTS-SETUP.md for the
practice data, period basis, PDF/CSV exports, and backend retrieval details.
Calculator work is separate and does not change this admin setup.
