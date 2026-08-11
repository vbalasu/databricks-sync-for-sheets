# OAuth Demo Video Script — Databricks Sync for Sheets

Required for Google OAuth **sensitive-scope verification** (Step 11). The video must
clearly show **each** requested sensitive scope actually being used. Target length
**~2–3 minutes**. Record at **1280×720 or higher**, narrate each step.

Connection values for recording live in `PUBLISH-STATUS.md` (Free Edition workspace).
Scope justifications (to paste into the verification form) are in `SUBMISSION-PACKAGE.md`.

## Scopes to demonstrate

| Scope | Sensitivity | Shown by |
| --- | --- | --- |
| `spreadsheets.currentonly` | narrow | writing read-results into the sheet; reading the sheet for writeback |
| `script.container.ui` | sensitive | opening the Setup Connection sidebar |
| `script.external_request` | sensitive | the HTTPS call to Databricks on read + writeback |

## Storyboard (~2–3 min)

| Time | Scene | Show / say |
| --- | --- | --- |
| 0:00 | **Intro** | Show a Google Sheet. *"This is Databricks Sync for Sheets. I'll install it and demonstrate each permission it requests."* |
| 0:15 | **Consent — shows all scopes** | Trigger the add-on (fresh authorize). Show the Google consent screen listing the 3 permissions; read each aloud. Click **Allow**. |
| 0:35 | **Sidebar → `script.container.ui`** | Extensions ▸ Databricks Sync ▸ Setup Connection. Sidebar opens. *"The sidebar UI uses the container.ui scope."* |
| 0:55 | **Configure** | Enter hostname + HTTP path, choose Service Principal, Save. Show "Configuration saved." |
| 1:15 | **Read → `external_request` + `currentonly`** | Click Sync Now. Rows appear. *"The HTTPS call to Databricks uses external_request; results are written into this sheet using the current-spreadsheet scope."* |
| 1:45 | **Writeback → `external_request` + `currentonly`** | Add/edit a row, Write to Databricks (Replace), re-type to confirm, Write. Show the success toast; optionally show the row in Databricks. *"Writeback reads this sheet and sends rows to Databricks — same two scopes."* |
| 2:20 | **Privacy close** | *"Credentials are stored per user; data flows only between the sheet and the user's own Databricks — nothing goes to the developer."* End. |

## Where to run it — use the Master Template

Record in the **Master Template** sheet, NOT a blank spreadsheet and NOT a fresh copy:

- The add-on is **not yet installed from the Marketplace** (in review), so a **blank/new
  spreadsheet has no "Databricks Sync" menu** — there is nothing to click there.
- The code is container-bound to the **Master Template**, whose script is linked to the
  `databricks-sync-sheets` GCP project → it shows the **branded** consent screen (the one
  needed for verification).
- A fresh **copy** would work as an add-on but is a *different* script on its own default
  GCP project → it shows the generic "unverified app" screen, not the branded one. Avoid.

## Re-triggering the Google consent screen (for the 0:15 intro shot)

`vbalasu@gmail.com` already authorized the script during testing, so the Google consent
screen won't reappear on its own. NOTE: the **"Reset OAuth Authorization"** menu item does
NOT do this — it only clears the *Databricks* OAuth token, not Google's authorization.

To make the Google consent screen reappear:

1. Go to **https://myaccount.google.com/permissions**
2. Find **"Databricks Sync for Sheets"** → **Remove access / Delete all connections**.
3. In the Master Template, click any **Databricks Sync** menu item (e.g. Setup Connection).
4. The branded Google consent screen reappears (showing the 3 scopes) — record it, then Allow.

## Recording tips

- Use `▸` or `>` for the menu path — plain text is fine.
- Upload as **unlisted YouTube** (most common) or per Google's current verification
  instructions, then paste the link into the verification request.
- Much of this footage was already captured as stills during the live test (see
  `assets/screenshots/` — consent screen, setup sidebar, completed read, write card).

## After recording → submit OAuth verification (Step 11)

1. Cloud Console → **APIs & Services → OAuth consent screen** (or the **Verification
   Center** tab) → **Prepare for verification / Submit for verification**.
2. Attach the **demo video link**.
3. Paste the **scope justifications** from `SUBMISSION-PACKAGE.md` (one per scope).
4. Submit → Google review (days–weeks). Respond to reviewer follow-ups promptly.

Note: the Marketplace **store listing** was already submitted (2026-08-10) and reviews in
parallel; it will not final-publish until this OAuth verification passes.
