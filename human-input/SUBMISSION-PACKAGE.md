# Marketplace Submission Package — copy/paste values

Everything you need for steps 4, 9, 10, and 11. Values are final unless marked _(confirm)_.

Publisher: **Vijay Balasubramaniam** · Domain: **vbalasu.com** · Support: **support@vbalasu.com** · Google acct: **vbalasu@gmail.com**
GCP project: **databricks-sync-sheets** (622786402076) · Apps Script version: **@1**

---

## Step 4 — OAuth consent screen (User type: External)

| Field | Value |
| --- | --- |
| App name | `Databricks Sync for Sheets` |
| User support email | `support@vbalasu.com` |
| App logo | 120×120 PNG (same artwork as the 128×128 store icon) |
| Application home page | `https://vbalasu.com/databricks-sync` |
| Privacy policy link | `https://vbalasu.com/databricks-sync/privacy-policy` |
| Terms of service link | `https://vbalasu.com/databricks-sync/terms-of-service` |
| Authorized domain | `vbalasu.com` |
| Developer contact email | `vbalasu@gmail.com` (or support@vbalasu.com) |

**Scopes to add (exactly these three — do not add more):**
```
https://www.googleapis.com/auth/spreadsheets.currentonly
https://www.googleapis.com/auth/script.container.ui
https://www.googleapis.com/auth/script.external_request
```
Keep the app in **Testing** (add yourself + any testers as test users) until you have
validated read + writeback + Lakebase end to end. Then **Publish app** → move to
**In production** → submit for verification (Step 11).

---

## Step 9 — Marketplace store listing (Marketplace SDK → App Configuration + Store Listing)

**App integration:** Editor add-on → **Google Sheets**. Provide **Script ID**
`1uTp_IpTLrc-xkuvvK6jrF9lpwueUYlg03JURM3DM8lMwJt7dXPkh6c4a` and **Version** `1`.

| Field | Value |
| --- | --- |
| Application name | `Databricks Sync for Sheets` |
| Short description (≤ small limit) | `Two-way sync between Google Sheets and your own Databricks SQL Warehouse or Lakebase.` |
| Category | `Productivity` _(confirm; alt: Business Tools)_ |
| Detailed description | see block below |
| Developer name | `Vijay Balasubramaniam` |
| Developer website | `https://vbalasu.com` |
| Developer email | `support@vbalasu.com` |
| Privacy policy URL | `https://vbalasu.com/databricks-sync/privacy-policy` |
| Terms of service URL | `https://vbalasu.com/databricks-sync/terms-of-service` |
| Pricing | `Free` |
| Regions / language | English; all regions _(confirm)_ |
| Visibility | Public |

**Detailed description (paste):**
```
Connect a Google Sheet to your own Databricks SQL Warehouse or Lakebase (Postgres)
and sync data both directions.

• Read: pull query results into a sheet.
• Write back: push sheet rows to a Databricks table with Append or Replace.
• Two backends: SQL Warehouse (Delta) and Lakebase (Data API).
• Enterprise auth: Personal Access Token, Service Principal (M2M), or User OAuth (U2M).

Your credentials are stored privately per user in Google Apps Script; data flows
directly between your sheet and your Databricks over HTTPS. Nothing is sent to the
developer — no analytics, no telemetry, no third-party servers. Uses only the
narrow current-spreadsheet Sheets scope.
```

**Positioning / target / benefits (for listing + marketing):**
- Target user: Databricks users and data/analytics teams who work in Google Sheets.
- Benefit 1: True two-way sync (read results in + Append/Replace writeback).
- Benefit 2: Works with both SQL Warehouse and Lakebase.
- Benefit 3: Enterprise auth (PAT / SP / User OAuth), per-user, minimal-scope, direct-to-Databricks.

---

## Step 8 — Graphics checklist (user-supplied artwork)

| Asset | Size | Notes |
| --- | --- | --- |
| Application icon | 128×128 PNG | primary store icon |
| Icon variants | 96×96, 48×48 PNG | if prompted |
| OAuth logo | 120×120 PNG | consent screen |
| Store banner / card | as SDK prompts (e.g. 220×140, 920×680) | |
| Screenshots | 1–5, e.g. 1280×800 PNG | (a) setup sidebar, (b) completed read into a sheet, (c) Write to Databricks card |

---

## Scope justifications (Step 4 + Step 11)

- **spreadsheets.currentonly** — Read the active sheet's cells to write back to
  Databricks, and write query results into the active sheet. Deliberately the narrow
  current-document scope (not full Sheets/Drive), so the add-on can only touch the
  spreadsheet it is opened in.
- **script.container.ui** — Show the "Databricks Sync" menu and the HTML sidebar used
  to configure the connection (backend, host, auth) and trigger read/writeback.
- **script.external_request** — Make HTTPS calls (UrlFetchApp) to the user's own
  Databricks: SQL Statement Execution API, OIDC token/authorize endpoints, and the
  Lakebase Data API. Requests go only to the host the user configures.

No restricted scopes are requested, so no third-party security assessment is required.

---

## Step 10 — OAuth demo video storyboard (~2–3 min)

Record at 1280×720+, narrate each step. Must clearly show each sensitive scope in use.

1. **(0:00) Intro** — "This is Databricks Sync for Sheets. I'll install it and show each
   permission in use." Show the sheet.
2. **(0:15) Consent** — Trigger the add-on; show the Google OAuth consent screen listing
   the exact three scopes. Click Allow. *(shows the scopes being granted)*
3. **(0:35) Sidebar → script.container.ui** — Extensions ▸ Databricks Sync ▸ Setup
   Connection. The sidebar opens. *(narrate: "this sidebar uses script.container.ui")*
4. **(1:00) Configure** — Enter workspace hostname + warehouse HTTP path, choose auth
   (e.g. Service Principal), Save.
5. **(1:20) Read → external_request + currentonly** — Run Manual Sync. Rows appear in
   the sheet. *(narrate: "the HTTPS call to Databricks uses script.external_request; the
   results are written with spreadsheets.currentonly")*
6. **(1:50) Writeback → external_request + currentonly** — Use Write to Databricks
   (Append). Show the confirmation, then show the new rows in Databricks. *(narrate the
   two scopes again)*
7. **(2:20) Privacy close** — "Credentials are stored per-user; data goes only between
   the sheet and the user's own Databricks — nothing to the developer." End.

Upload as unlisted YouTube (or per Google's current instructions) and paste the link in
the verification request.

---

## Step 11 — OAuth verification submission notes

- App must be **In production**, consent screen complete, domain verified.
- Attach the demo video link + the scope justifications above.
- Reviewer instructions: provide a test Databricks workspace/warehouse (or note that the
  reviewer can use their own), and the steps in the video. Expect days–weeks; respond to
  any reviewer follow-ups promptly.
