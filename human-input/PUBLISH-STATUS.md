# Marketplace Publication — Status & Runbook

Live tracker for publishing **Databricks Sync for Sheets** to the Google Workspace
Marketplace. Spec: https://docs.google.com/document/d/1pGYaFncKuHRdawt8OPozqLr2G3PIxaPrClx509EJ7QU/edit

## Locked configuration

| Item | Value |
| --- | --- |
| Publisher identity | Vijay Balasubramaniam / vbalasu.com / support@vbalasu.com |
| Google account | vbalasu@gmail.com |
| GCP project | `databricks-sync-sheets` (number **622786402076**) |
| APIs enabled | Google Workspace Marketplace SDK, Apps Script API |
| Billing | Not required (free add-on) |
| Apps Script | container-bound; scriptId `1uTp_IpTLrc-xkuvvK6jrF9lpwueUYlg03JURM3DM8lMwJt7dXPkh6c4a` |
| Container sheet | `1JR1AFPB9LnqjAm0yvGCdE2AymtdMnVPTPrEoPNFqvh4` |
| Listing deployment | version **@1** (`AKfycbz0FZsjfT5QtS-V5xYhSz3Mn1hSeWpy5eVfo5Xa6euwsYaqOi0b4qIldrGzNw7-Xcs`) |
| OAuth scopes (3) | `spreadsheets.currentonly`, `script.container.ui`, `script.external_request` |
| Distribution | Dual channel: (1) existing Template-Copy `/copy` link, (2) new public Marketplace listing |

## Steps

- [x] 1. Create dedicated GCP project — DONE
- [x] 2. Enable Marketplace SDK + Apps Script API — DONE
- [x] 7. Push code (incl. formula-injection fix) + create versioned deployment @1 — DONE
- [x] 3. Link Apps Script → GCP project number `622786402076` — DONE
- [x] 4. Configure OAuth consent screen (External) — DONE. App info, Audience=External, Contact, Branding (home/privacy/ToS URLs + authorized domain vbalasu.com), Data Access (3 scopes) all saved. Logo deferred (needs artwork; adding it can trigger verification). Still to do before testing: add test user vbalasu@gmail.com under Audience.
- [x] 5. Verify `vbalasu.com` in Google Search Console — DONE (already a verified Domain property under vbalasu@gmail.com)
- [x] 6. Host privacy policy + ToS at stable `vbalasu.com` URLs — DONE (all 3 URLs return HTTP 200; generated HTML in site/databricks-sync/)
- [x] 8. Prepare listing assets — DONE: icon (all sizes) in assets/; screenshots cropped to 1280px in assets/screenshots/cropped/ (01 setup sidebar, 02 completed read, 03 write card) + oauth-consent.png for verification. Banner still optional/TBD.
- [x] 9. Configure Marketplace store listing — DONE. App Config (Public, Individual+Admin, Sheets add-on, Script ID + version 1, scopes incl. forced email/profile). Store Listing (name, descriptions, Productivity, English, All Regions, icons 32/48/96/128, banner 220x140, 3 screenshots, URLs, post-install tip, draft tester vbalasu@gmail.com). SUBMITTED FOR REVIEW 2026-08-10 ("Review Submitted").
- [x] 10. Record OAuth demo video — DONE. Uploaded: https://youtu.be/v72qY77XpU8
- [x] 11. Submit OAuth verification — DONE. Published app to Production, added logo/branding, completed Verification Questionnaire (all No + both acknowledgments), submitted branding + data access with demo video + scope justification. SUBMITTED 2026-08-10. Google Trust & Safety review: first email in 3–5 days, full review up to 4–6 weeks. Existing (last approved) consent screen stays in use meanwhile.
- [~] 12. **→ Google (waiting)**: Both tracks submitted 2026-08-10 — (a) Marketplace store listing review, (b) OAuth brand/verification review. App publishes/goes fully live once BOTH pass. Nothing more to do on our side except respond to any reviewer follow-up emails to vbalasu@gmail.com.

## STATUS: everything on our side is DONE. Awaiting Google review (both tracks). Submitted 2026-08-10.

## Live test connection values (Free Edition workspace — non-secret)

Workspace host: `dbc-b29b2f7a-5112.cloud.databricks.com` · SP Client ID `b7df7dd1-1ec5-44de-9bc6-adaf26f34ec1` (profile `free-sp`; secret held by user)

**SQL Warehouse backend:**
- HTTP Path: `/sql/1.0/warehouses/d575f01a7ef7efc0` (warehouse RUNNING)
- Read/write table: `workspace.gsheet_sp_test.wb` (cols: id bigint, name string, pi double, flag boolean, ts timestamp)

**Lakebase backend:**
- REST Endpoint: `https://ep-summer-rain-d86oc5rb.database.us-east-2.cloud.databricks.com/api/2.0/workspace/1066745611279538/rest/databricks_postgres`
- Schema: `public` · Table: `writeback` (id bigint PK, name text, pi double precision, flag boolean)
- Lakebase project `vbalasu-free`, branch `production`; SP authenticator setup already done (prior Replace ran)

## Live test results (2026-08-10)

- **SQL Warehouse — READ**: ✓ Synced 3 rows × 5 cols from `workspace.gsheet_sp_test.wb` into the sheet. Numeric `pi` values preserved (formula-escaper leaves plain numbers alone).
- **SQL Warehouse — WRITEBACK (Replace)**: ✓ "Replaced 4 row(s)". Independently verified via direct SQL query — table contains exactly the 4 sheet rows (alice/bob/vijay/carol).
- **Consent screen**: ✓ Branded "Databricks Sync For Sheets", correct 3 scopes, privacy/ToS links present.
- Screenshots captured: setup sidebar, completed read, Write-to-Databricks (Replace) card.
- **Lakebase — READ**: ✓ Synced 3 rows × 4 cols from `public.writeback`.
- **Lakebase — WRITEBACK (Replace)**: ✓ "Replaced 3 row(s)". Verified via re-read — edited value `lakebase-test` persisted and read back.
- **RESULT**: both backends validated in both directions (read + Replace writeback). App works end-to-end.

## Notes
- Steps 3–12 are Google-console UI / DNS / Google-review gated — no CLI/API automation available.
- Keep the OAuth app in "Testing" with test users until verification passes; validate read + writeback + Lakebase end to end first.
