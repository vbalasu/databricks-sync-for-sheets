# Publishing to the Google Workspace Marketplace

This is the submission runbook and listing copy for publishing **Databricks Sync
for Google Sheets** as a **public** Google Workspace Marketplace editor add-on,
under the individual developer identity **Vijay Balasubramaniam**.

## Decisions locked for this publication

| Decision | Choice |
| --- | --- |
| Distribution | **Public** listing (anyone can install) |
| Developer identity | **Vijay Balasubramaniam** (individual), matches `LICENSE` |
| Privacy policy / ToS host | **A custom domain you own** (see "Domain" below) |
| Lakebase access | **Data API** (HTTPS/PostgREST) — the only Apps-Script-reachable path |
| Sequencing | **Ship + verify the code first, then submit for OAuth verification** |

## Why this needs OAuth verification (and why the scopes are what they are)

A **public** ("External") listing that requests **sensitive** scopes must pass
Google's OAuth verification (brand review + a **demo video** showing each scope in
use). Two of our scopes are sensitive:

| Scope | Sensitivity | Why the add-on needs it |
| --- | --- | --- |
| `https://www.googleapis.com/auth/spreadsheets.currentonly` | Narrow (current-doc) | Read/write cells only in the open spreadsheet |
| `https://www.googleapis.com/auth/script.container.ui` | **Sensitive** | Show the setup sidebar + menu |
| `https://www.googleapis.com/auth/script.external_request` | **Sensitive** | HTTPS calls to the user's Databricks / Lakebase |

`spreadsheets.currentonly` is deliberately the **narrow** current-document scope.
Keeping it (instead of the full `spreadsheets`/Drive scopes) avoids the much
heavier **restricted**-scope security assessment. **Do not broaden it.** The scope
list in `appsscript.json`, the OAuth consent screen, and the store listing must
all match exactly.

## Domain (prerequisite for verification)

The OAuth consent screen requires an **authorized domain** that is verified in
Google Search Console by a Google account that is an owner/editor of the GCP
project. Host the privacy policy + ToS on a domain you control and verify it via
DNS. (A GitHub Pages _project_ page such as `you.github.io/repo` generally cannot
be verified; a custom domain or a user/org root page can.)

- Privacy policy: `https://<your-domain>/databricks-sync/privacy-policy` (source:
  `docs/privacy-policy.md`)
- Terms of service: `https://<your-domain>/databricks-sync/terms-of-service`
  (source: `docs/terms-of-service.md`)
- Homepage/support: a page on the same domain.

Fill in the real support email in `docs/privacy-policy.md` and
`docs/terms-of-service.md` before hosting.

## Listing copy (draft)

- **App name:** Databricks Sync for Google Sheets
- **Short description:** Sync data between Google Sheets and your Databricks
  workspace or Lakebase — read query results in, write sheet rows back.
- **Detailed description:**
  > Connect a Google Sheet to your own Databricks SQL Warehouse or Lakebase
  > (Postgres) database. Pull query results into a sheet, and write sheet data
  > back to a table with Append or Replace. Supports Personal Access Token,
  > Service Principal (M2M), and User OAuth (U2M) authentication. Your
  > credentials are stored privately per user; data flows directly between your
  > sheet and your Databricks over HTTPS — nothing is sent to the developer.
- **Category:** Productivity (or Business Tools)
- **Pricing:** Free
- **Developer:** Vijay Balasubramaniam
- **Support email / URL:** _<fill in>_
- **Privacy policy URL / ToS URL:** as above
- **Graphics needed (user-supplied artwork):** application logo/icons and
  screenshots — see "Icon & screenshot spec".

## Icon & screenshot spec

Provide brand artwork at the sizes Google's SDK requests (confirm exact
requirements in the Marketplace SDK when you fill the listing):

- Application icon: **128×128** PNG (and commonly **96×96** / **48×48** variants).
- Store listing card/banner graphic as prompted by the SDK.
- **1–5 screenshots** (e.g. **1280×800**) showing: the sidebar connection setup,
  a completed read into a sheet, and the "Write to Databricks" card.

_(These are user assets — the repo intentionally contains no binary artwork.)_

## Demo video script (for OAuth verification)

Keep it short (~2–3 min) and show each sensitive scope actually being used:

1. Install the add-on from the (test) listing; show the OAuth consent screen with
   the exact scopes.
2. Open **Extensions → Databricks Sync → Setup Connection** — this exercises
   `script.container.ui` (the sidebar).
3. Enter a workspace hostname + warehouse path, save, and click **Sync Now** —
   this exercises `script.external_request` (HTTPS to Databricks) and
   `spreadsheets.currentonly` (writing results into the open sheet).
4. Use the **Write to Databricks** card to Append the sheet to a table, then show
   the row appearing in Databricks — again `script.external_request` +
   `spreadsheets.currentonly` (reading the open sheet).
5. Narrate that credentials are stored per-user and no data leaves for the
   developer.

## Publication runbook (steps you execute)

These steps require your Google account, your domain, and a real support email;
they cannot be automated on your behalf.

1. **Finish + verify the code** (writeback + Lakebase) in your own copy using the
   verification plan in `README.md` / the project plan.
2. **Standard GCP project:** create one (or reuse) and link the Apps Script
   project to it (Apps Script → Project Settings → Google Cloud Platform (GCP)
   Project → set the project number).
3. **OAuth consent screen** (User type: External): set app name, developer/support
   email, app logo; add your **authorized domain** and **verify it in Search
   Console**; add the privacy policy and homepage URLs; add the three scopes
   above.
4. **Enable the Google Workspace Marketplace SDK** in the GCP project and create
   the **store listing** (same scopes, icons, screenshots, description,
   privacy/ToS URLs, support contact).
5. **Create a versioned Apps Script deployment** for the add-on and reference it
   from the Marketplace SDK app configuration.
6. **Testing phase:** keep the OAuth app in "Testing", add yourself/testers as
   test users, and validate the full read + writeback + Lakebase flows end to end.
7. **Submit for OAuth verification** (sensitive scopes → upload the demo video +
   scope justifications). Allow days-to-weeks; respond to reviewer feedback.
8. **Submit the store listing** for Marketplace review once OAuth verification
   passes; address feedback; **publish**.

## Notes

- Any later change that adds/broadens scopes or materially changes functionality
  can re-trigger review — which is why writeback + Lakebase are being finished
  **before** submission rather than after.
- The current template-copy distribution
  (`human-input/02-deployment-spec.md`) can remain available in parallel until the
  public listing is live.
