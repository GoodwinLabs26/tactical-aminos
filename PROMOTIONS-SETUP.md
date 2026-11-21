# Tactical Aminos Promotions

## Install and deploy

Download Tactical-Promotions-Auto-Contacts-Update.zip into Downloads, then in the VS Code terminal:

```bash
cd ~/Projects/tactical-aminos &&
unzip -o ~/Downloads/Tactical-Promotions-Auto-Contacts-Update.zip -d . &&
export PATH="$(brew --prefix node@22)/bin:$PATH" &&
npm run build:functions &&
node --experimental-vm-modules --test tests/*.test.* &&
firebase deploy --only functions:promotionsAdmin,functions:promotionUnsubscribe,functions:sendPromotionQueue,functions:addSignupEmailContact --project tactical-aminos
```

This adds four Firebase functions. The scheduled queue may cause Firebase to enable Cloud Scheduler and its required services. It uses the existing RESEND_API_KEY and SHIPPING_EMAIL_FROM settings. No new credential is placed in the website.

After deployment, check the Promotions tab in your local admin dashboard. Then publish the UI:

```bash
git add index.html admin.html admin.css admin.js admin-api.js promotions-admin.js functions/index.js functions/promotions.js functions/promotions-core.js tests/promotions.test.js tests/ui.test.js PROMOTIONS-SETUP.md &&
git commit -m "Add promotions, private contact imports and unsubscribe handling" &&
git push origin main
```

Wait for Vercel Ready, then reload the live admin page. This update preserves the existing My Account link and live checkout settings. The preview-checkout test now supplies its own preview setting; it does not alter production checkout.

## Import Mark's contacts

Keep Mark-Contacts-Import.csv in Downloads, outside the website repository. Do not commit it to GitHub or upload it as a public website asset.

1. Open Admin > Promotions > Contacts · import and manage.
2. Choose Mark-Contacts-Import.csv.
3. Check the permission confirmation (Jasmine confirmed both source lists have permission).
4. Select Import contacts. Importing does not send email.

The two supplied lists contained 1,361 rows. The CSV combines them into 1,334 unique lowercase addresses (27 duplicates removed). This checks syntax, not whether a mailbox exists. Two possible domain typos stay pending, even when permission is confirmed. Review the listed addresses with Mark; no guesses or corrections were made. To correct one, unsubscribe the original and import its confirmed replacement. Re-imports never reactivate unsubscribed contacts.

Contacts are private Firestore marketingContacts documents, served only by admin callables under the existing catch-all-deny rules. No Firebase Authentication account or password is created. Customers use the normal Create account form, choose their own password, and complete existing membership confirmations. Customers who already have an account can sign in or use Forgot password.

New customers are automatically added to promotional contacts when they complete website membership signup. The signup page explains that they can unsubscribe. Existing imported contacts and unsubscribes are preserved. No welcome or promotional email is sent merely by signing up. The registered Customers tab remains separate from marketing contacts. Existing website accounts created before deployment are not backfilled automatically; they can be imported separately.

## Compose and test

1. Fill in the subject, headline and message. An offer summary and active existing discount code are optional.
2. Preview. All content is plain text; HTML is escaped.
3. Send test to myself. This always uses the signed-in admin email, regardless of the selected audience. No campaign is sent. Without a saved mailing address, a test-only placeholder is shown.
4. Add the valid business mailing address under Email footer settings before a customer campaign. A registered PO box or private mailbox can be used. Website links and unsubscribes are included as well.
5. Choose All subscribed contacts, One person, or Custom list. One-person/custom recipients must already be imported and subscribed.
6. Review recipients, then select Send and confirm the subject and exact count. Editing the content or recipients invalidates that review.

Discount codes must be saved and active in Discounts & referrals. The email does not create a discount, change prices or schedule a sale. State any offer terms and end date in your message.

Before the first full campaign, check the Resend account's available sending allowance for the 1,334-contact list and ongoing order emails. This update does not change or upgrade the Resend plan.

## Sending and history

The scheduled worker processes at most 20 emails per minute, one recipient per message. Sending continues after closing the dashboard. Update contacts & history to see progress. A full list takes roughly 67 minutes under normal provider conditions, and longer if requests are delayed or throttled. No emails are sent just because the worker is deployed.

Accepted means Resend accepted the message. It does not mean inbox delivery. Inspect delivery, bounce or complaint information in Resend. Contacts can also be unsubscribed manually in this admin tool. Provider delivery webhooks are not added in this update, so bounce/complaint events do not automatically change the local contact status.

Retries use a stable idempotency key and frozen payload. Ambiguous messages stop for review after 23 hours rather than risk duplicates outside the provider's 24-hour idempotency window. Do not send a new campaign as a way to retry uncertain messages; check Resend first.

Interrupted queue creation resumes automatically. Cancelling stops remaining queued emails; an email already being sent or accepted cannot be recalled. Suppression is checked before each attempt. An unsubscribe does not affect transactional order or shipping messages.

Unsubscribe links do not require sign-in. GET shows a confirmation page so email link scanners do not unsubscribe people. POST applies the unsubscribe, including one-click email-client requests. Tokens are random and stored privately with contacts. Re-import cannot undo an unsubscribe.

## Verification

89 automated tests pass, including existing checkout/admin/account/COA tests and 15 new promotions tests. Provider requests were mocked; no real email was sent and no contact was imported into production from the development workspace. Browser appearance and actual delivery still need your local/live check after deployment.
