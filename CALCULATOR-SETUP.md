# Tactical Aminos calculator update

Billing can stay on Spark. This update adds a calculator to the existing member
website. It uses the existing sign-in and age confirmation, calculates in the
browser, and needs no Firebase Functions, Resend account, secret, or deployment.
The storefront remains in test-checkout mode. The admin practice mode is unchanged.

## Update the files in VS Code

Download and unzip Tactical-Aminos-Calculator-Update.zip. Open its source files in
VS Code. Copy each entire file into the matching destination in the existing
Projects/tactical-aminos project, then save with Command+S.

| Destination | Action |
| --- | --- |
| `index.html` in the main project folder | Replace the entire contents. Adds the Calculator navigation link and page. |
| `app.js` in the main project folder | Replace the entire contents. Adds member routing and initializes the calculator. |
| `calculator-core.js` in the main project folder | Create a new file and paste its contents. |
| `calculator.js` in the main project folder | Create a new file and paste its contents. |
| `calculator.css` in the main project folder | Create a new file and paste its contents. |
| `CALCULATOR-SETUP.md` in the main project folder | Create a new file and paste these instructions. |
| `tests/calculator.test.js` | Create a new file inside the existing tests folder. |

Do not replace functions/index.js in this update. No package file or Firebase
configuration needs changing. These replacements are based on GitHub commit
`dc52ede` (Add admin dashboard for orders inventory and affiliates).

## Try it

Keep your existing preview server running and open:
http://localhost:8000/#calculator

Or right-click index.html -> Open with Live Server, then click Calculator in the
website navigation. Use Command+Shift+R to reload the updated files.
Sign in with your existing test account if prompted.

The following are arithmetic test inputs, not dose recommendations:

1. Select a 100-unit syringe.
2. Enter total vial strength **30 mg**.
3. Enter desired amount **1.5 mg**.
4. Enter water volume **3 mL**.
5. Select Calculate volume. Expect **15 units**, **0.15 mL**, concentration
   **10 mg/mL**, and a blue fill at 15 on the 100-unit scale.
6. Switch capacity to 30 units. It should still calculate 15 units, with the
   graphic now halfway full. Switch to 50; the result still stays 15 units.
7. Switch the desired unit from mg to mcg. The entered value converts from
   1.5 to 1500 and the old result clears. Calculate again: still 15 units.
8. Switch vial strength from mg to mcg. 30 becomes 30000. Calculate again:
   still 15 units. Both selectors convert their entered values.
9. Return both units to mg. Set desired amount to 6 mg and select a 30-unit
   capacity. Calculate: 60 units / 0.6 mL, marked ABOVE SELECTED CAPACITY.
   No fill marker is shown; the diagram never silently clips to a full syringe.
10. Enter an amount greater than the vial total (31 mg in a 30 mg vial).
    The calculation must be rejected and the old result hidden.
11. Try empty or zero inputs. They must be rejected. Clear resets the form.
12. Check the layout on a narrow browser/phone. The numerical result remains large.

## Save through the VS Code terminal

```bash
npm test
```

Expect 25 passing tests and zero failures. The VM Modules experimental warning
comes from the existing test runner and does not mean a test failed.
After tests pass, push this change:

```bash
git add index.html app.js calculator-core.js calculator.js calculator.css CALCULATOR-SETUP.md tests/calculator.test.js
git commit -m "Add member calculator with U-100 syringe visualization"
git push origin main
```

A push saves code to GitHub; it does not enable real ordering or upgrade billing.

## Calculation behavior

- U-100 is fixed at 100 syringe units per mL. Capacity is 30/50/100 units,
  corresponding to 0.3/0.5/1 mL. A smaller capacity does not change the conversion.
- The engine converts both masses to mg, then computes:
  concentration = vial mass / water volume;
  calculated volume = desired mass / vial mass * water volume;
  U-100 units = calculated volume * 100.
- It assumes final solution volume equals entered water volume; it cannot account
  for unknown volume displacement or actual container capacity.
- No product is chosen, no dose/water amount is suggested, and no clinical
  instructions are generated. The tool uses only values entered by the member.
- Input changes hide stale results; changing syringe capacity recalculates a
  currently displayed result. Unit changes preserve the physical mass and hide
  the old result until Calculate is pressed again.
- Decimal units are retained. Display formatting uses up to six significant
  digits; it does not round a result to a physical syringe graduation.
- The SVG is illustrative, not a measurement instrument. Actual graduations vary.
- Calculator inputs/results are not sent to Firebase or saved in browser storage.

U-100 capacity reference: BD Retail Pharmacy Portfolio Brochure:
https://static.bd.com/assets/product/Documents/Diabetes%20Care%20%28DC%29/DC_Diabetes%20Care_pharmacy-catalog_CT_EN.pdf

## Verification

All 25 automated tests pass, including six new calculator cases covering unit
combinations, capacities, fractional values, invalid inputs, and oversized
amounts, alongside the existing cart/admin tests.
Desktop and mobile browser checks passed with Firebase mocked: sign-in gate,
empty inputs, calculated amounts, converted units, cleared stale results,
over-capacity marker suppression, above-vial rejection, Clear, and sign-out gate.
No JavaScript exceptions or horizontal overflow were found in those checks.
No live customer accounts or Firebase records were changed during verification.
