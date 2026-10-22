# Calculator: full doses per vial

This update adds a full-dose count below the syringe illustration. It divides
vial strength by the entered desired dose after converting the units. A partial
remaining amount is shown separately; it is never rounded up to another full dose.
The count does not change with water volume or syringe capacity. Existing volume
and capacity checks still apply. Counts are theoretical and do not allow for
handling losses; no recommended dose or usage schedule is supplied.

## Update the main project

Unzip Tactical-Aminos-Dose-Count-Update.zip and use VS Code to replace these files
with the downloaded versions, preserving the folder structure:

- `index.html` (the main storefront file, not functions/index.js)
- `calculator-core.js`
- `calculator.js`
- `calculator.css`
- `tests/calculator.test.js`

You may also copy this instructions file into the main project folder.
The stylesheet restores clean responsive CSS; the GitHub version contained
malformed punctuation and media-query text that broke the narrow-screen layout.
There are no new dependencies, billing changes, or Firebase deployment steps.

Save all files. Refresh the local website, sign in, and open Calculator.

Arithmetic checks, not dose recommendations:

- 30 mg vial, 1.5 mg desired amount, 3 mL water: 15 units, 0.15 mL, **20 full doses**.
- 30 mg vial, 7 mg desired amount, 3 mL water: **4 full doses**, **2 mg left over**.
- Changing vial units to mcg converts 30 to 30000; the latter example still gives
  4 full doses and now shows 2000 mcg left over.
- Changing any amount hides the old count until Calculate is pressed again.
- Clear and invalid inputs hide the dose count. Over-capacity volume warnings
  remain visible even when a theoretical vial count can still be calculated.

## Test and push in VS Code's terminal

```bash
cd ~/Projects/tactical-aminos
npm test && git add index.html calculator-core.js calculator.js calculator.css tests/calculator.test.js DOSE-COUNT-SETUP.md && git commit -m "Show full doses per vial in the calculator" && git push origin main
```

Expect 36 passing tests. If you did not copy this instructions file into the
project, omit DOSE-COUNT-SETUP.md from the git add command.

## Update the link already shared with Mark

The main GitHub project and the Netlify calculator-only preview are separate.
Pushing the main project does not update the manually uploaded preview.

1. Download and unzip Mark-Calculator-Dose-Preview.zip.
2. Open the existing sparkly-baklava-195fc2 project in your Netlify dashboard.
3. Open its Deploys page and drag the extracted Mark-Calculator-Dose-Preview
   folder into the manual deployment area. Its index.html is self-contained.
4. Once deployment finishes, refresh the existing public calculator link.
   It should show the new dose count. Keeping this existing project retains
   the address Mark already has; do not create a new Netlify project.

The preview needs no sign-in, Firebase, secrets, or external scripts.

## Verification

36 automated tests pass. New cases cover decimal division, full versus partial
counts, mixed mg/mcg inputs, leftover mass, and capacity/water independence.
Decimal mass fractions are used for the count to avoid floating-point floor
errors such as counting 0.3 / 0.1 as only two. Counts beyond the exact integer
range display a range message rather than an inaccurate count.
The member-site and standalone preview were checked in a browser with Firebase
mocked where needed. Full counts, remainder labels, input/reset clearing, and
single-column mobile layout passed with no JavaScript errors or live writes.
