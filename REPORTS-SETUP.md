# Tactical Aminos quarterly website sales reports

Reports summarize website orders marked paid. They require no entry of product
purchase costs, expenses, or outside bookkeeping information. They do not calculate
profit, taxes owed, or prepare a tax return. Mark can combine them with his other
business records and payment-app statements for his tax preparer.

The customer calculator is unchanged while Mark reviews it. Firebase can stay on
Spark during practice testing; there is no live deployment in this update.

## Install in your existing project through VS Code

Download Tactical-Aminos-Reports-Update.zip into Downloads. In VS Code, open the
existing Projects/tactical-aminos folder and use Terminal -> New Terminal:

```bash
cd ~/Projects/tactical-aminos
unzip -o ~/Downloads/Tactical-Aminos-Reports-Update.zip -d .
npm test
```

This copies only this update's source files into the project. You can inspect them
under Source Control before committing. It does not include Git history or change
Firebase billing. Do not unzip inside the functions folder. Expect 34 passing tests.

If you prefer copying in the editor, open the downloaded source files in VS Code,
then paste their complete contents into the corresponding project files and save:

| Destination | Action |
| --- | --- |
| `admin.html`, `admin.js`, `admin-api.js`, `admin-demo.js` | Replace existing files in the main project folder |
| `reports-core.js`, `reports-pdf.js`, `reports.js`, `reports.css` | New files in the main folder |
| `REPORTS-SETUP.md` | New instructions in the main folder |
| `ADMIN-SETUP.md` | Replace existing instructions |
| `firestore.indexes.json` | Replace existing main-folder file; preserves the customer order index and adds the report index |
| `functions/index.js` | Replace the backend entry file inside functions |
| `functions/reports-service.js` | New file inside functions |
| `functions/lib/reports-core.js` | New generated copy inside functions/lib; same content as main-folder reports-core.js |
| `scripts/build-functions.mjs` | Replace existing script; now copies the report calculation module into the backend bundle |
| `tests/reports.test.js` | New test file inside tests |

Based on GitHub commit f92adae (Add member calculator with U-100 syringe visualization).
No package dependencies or Firestore rules need changing. No npm install is needed
for these local tests, the practice report, or PDF/CSV downloads.

## Try the report on Spark

1. Keep the preview server running. Visit http://localhost:8000/admin.html?demo=1
   or open admin.html with Live Server and add ?demo=1 to its address.
2. Refresh with Command+Shift+R and select Quarterly reports.
3. Leave the default current year and quarter, Washington, DC (Eastern) time, then Generate report.
4. A fresh practice session includes three sample paid orders, plus the original
   two unpaid practice orders. The unpaid orders are excluded from the report.
5. Expect:

| Website activity | Sample result |
| --- | ---: |
| Paid orders | 3 |
| Vials sold | 7 |
| Product sales before discounts | $399.00 |
| Discounts given | $22.60 |
| Product sales after discounts | $376.40 |
| Shipping collected | $24.00 |
| Customer payments recorded | $400.40 |
| Venmo, two orders | $257.40 |
| PayPal, one order | $143.00 |

6. Download PDF, Orders CSV, and Products CSV. Every practice export identifies
   SAMPLE data; it must not be used as real sales documentation.
7. The PDF contains the summary, method totals, basis/limitations, and product
   table. CSV files contain all matching order/product rows.
8. Choose last year and generate: expect a zero-activity report. Changing a period
   disables old export buttons until a new report is generated.
9. Return to Orders, mark TA-DEMO-001 paid, then generate the current-quarter report
   again. There should be four paid orders and $560.40 in recorded payments.
10. Reload the practice page to reset. Demo changes never reach Firebase.

## Save to GitHub from the VS Code terminal

Save all files and run:

```bash
npm test
```

If all 34 tests pass:

```bash
git add admin.html admin.js admin-api.js admin-demo.js reports-core.js reports-pdf.js reports.js reports.css REPORTS-SETUP.md ADMIN-SETUP.md firestore.indexes.json functions/index.js functions/reports-service.js functions/lib/reports-core.js scripts/build-functions.mjs tests/reports.test.js
git commit -m "Add quarterly website sales reports with PDF and CSV exports"
git push origin main
```

The PDF implementation is local and dependency-free. No online PDF service,
CDN library, email account, or billing setup is required for practice exports.

## What the report means

- Scope is website orders marked paid, in USD. Shipped paid orders are included.
  Unpaid orders and unpaid cancellations are excluded.
- Date basis is `paidAt`: when Mark clicks Mark paid on the website. It is not
  asserted to be when Venmo/PayPal received funds or deposited them into a bank.
- Quarter starts at local midnight in Washington, DC (Eastern) time and ends immediately
  before the next quarter. The dashboard always uses America/New_York and has no time-zone selector.
  Daylight-saving offsets are honored. The shared engine retains support for other
  time zones for existing records/tests, but the dashboard always requests Eastern.
- For the current quarter, the first retrieval fixes the report's generation cutoff.
  Orders marked paid later are included only on a newly generated report.
- Gross product sales come from historical order-line price snapshots. Discounts
  and shipping come from the same saved orders, not today's catalog prices.
- Product table and Products CSV amounts are BEFORE order discounts. Product
  labels/strengths are preserved as sold; an old/new label can appear separately.
- Products before discounts - discounts + shipping must equal recorded payments.
  Payment-method totals must also reconcile. Money uses integer cents.
- No expenses, purchase costs, fees, refunds, sales tax accounting, outside sales,
  deposits, or calculated tax/profit are supplied or inferred. Untracked items are
  described as not included; missing information is not presented as zero expense.
- If nonzero tax/refund fields appear on a returned paid record, generation stops
  rather than exporting a report that silently ignores those amounts. Adding future
  refund/tax features will require extending report retrieval and calculation together.
- Missing dates, amounts, payment methods, duplicate IDs, or inconsistent line/order
  totals stop report generation. No partial export is offered after a page failure.
- CSV cells are quoted, preserve Unicode, use fixed USD decimals, and neutralize
  spreadsheet formula prefixes. Each data row includes the period, time zone,
  generation timestamp, report version, and sample/live label. Empty CSVs have
  headers only; the PDF provides the zero-activity period summary.
- Orders CSV includes order number/ID, marked-paid UTC/local dates, payment method,
  vial count, amounts, promotional code, and product descriptions. Customer addresses,
  phone numbers, passwords, and payment credentials are not exported.
- The PDF uses standard Helvetica fonts with basic-Latin text. Accents are
  transliterated and unsupported glyphs become '?'; CSV preserves original names.

## Real retrieval after billing/backend setup

The new reportOrders callable checks config/admin.uid on EVERY page. Report data
is fetched using a dedicated paymentStatus/paidAt query, independently of the
50-record dashboard lists. It retrieves 200 records per page and the browser
continues until every matching page is received. Above 50,000 matching orders,
export stops with an explicit limit message rather than silently truncating.
The screen previews only the first 20 orders; both exports use the full result.

After Mark enables Blaze, use the existing deployment instructions, including:

```bash
npm install --prefix functions
npm test
firebase deploy --only functions,firestore --project tactical-aminos
```

The new index is defined in firestore.indexes.json. Wait for it to finish building
before testing live reports. Keep previewCheckout true and customer ordering off.
No backend is deployed by copying files or pushing to GitHub alone.

The backend query depends on paidAt being present on paid orders, as enforced by
the current Mark paid action. Imported or manually edited historical data must be
reviewed before relying on reports; undated paid records cannot be assigned to a
quarter by this query. Reconcile real exports against payment-app records before
handing them to the tax preparer.

## Verification

34 automated tests passed, including report date/time-zone boundaries, DST, leap
year, exclusion of unpaid/out-of-period data, integer-cent reconciliation,
historical labels, CSV quoting/formula handling, admin authorization, and complete
237-order pagination with later-page failure checks.

Desktop/mobile browser tests passed in practice mode: three exports downloaded,
expected totals, zero-activity quarter, stale export clearing, newly paid order
inclusion, no customer addresses, and no JavaScript errors or horizontal overflow.
The exported PDFs were rendered and inspected; two-page, zero-activity, and
49-product multi-page cases passed layout and text checks. Backend modules load.
Live Firebase authorization/index behavior still needs a post-deployment check.
No Firebase accounts, customer records, emails, or billing were changed during tests.
