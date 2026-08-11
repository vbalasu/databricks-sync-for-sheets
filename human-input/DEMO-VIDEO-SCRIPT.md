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

## Recording tips

- Use the **Master template** (branded "Databricks Sync for Sheets" consent screen), the
  same setup validated in the live test on 2026-08-10.
- To re-trigger the consent screen for the intro shot: **Databricks Sync → Reset OAuth
  Authorization** first, then click a menu item to re-authorize.
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
