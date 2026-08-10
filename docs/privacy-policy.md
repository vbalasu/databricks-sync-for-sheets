# Privacy Policy — Databricks Sync for Google Sheets

_Last updated: 2026-08-09_

Databricks Sync for Google Sheets ("the add-on") is a Google Workspace editor
add-on that connects a Google Sheet to a user's own Databricks workspace or
Lakebase database to read data into the sheet and write sheet data back to
Databricks. This policy explains what the add-on accesses, what it stores, and
what it does **not** do.

> **Publish note:** Host this policy at a stable, publicly reachable URL on a
> domain you control and verify in Google Search Console, then reference that URL
> on the OAuth consent screen and in the Marketplace listing. A GitHub Pages
> _project_ page (e.g. `you.github.io/repo`) generally cannot be verified as an
> OAuth "authorized domain"; use a custom domain or a user/org root page.

## Who provides the add-on

The add-on is published by **Vijay Balasubramaniam** (individual developer).
Contact: support@vbalasu.com.

## What the add-on accesses

The add-on requests only the scopes it needs to function:

- **`https://www.googleapis.com/auth/spreadsheets.currentonly`** — read and write
  cells **only in the spreadsheet the add-on is open in**. The add-on cannot see
  or touch any of your other spreadsheets or Drive files.
- **`https://www.googleapis.com/auth/script.container.ui`** — show the sidebar and
  menu used to configure the connection and run syncs.
- **`https://www.googleapis.com/auth/script.external_request`** — make HTTPS
  requests to **your** Databricks workspace / Lakebase Data API to run queries and
  writeback. Requests go only to the hostname and endpoint you configure.

## What is stored, and where

- **Connection settings and credentials** you enter (workspace hostname, HTTP
  path or Lakebase REST endpoint/schema, authentication type, and secrets such as
  a Personal Access Token, OAuth client ID/secret, or a cached OAuth token) are
  stored using Google Apps Script **`PropertiesService.getUserProperties()`** and
  a short-lived **`CacheService`** cache. This storage is:
  - **Per user** — scoped to your Google account. Other people who use the same
    spreadsheet cannot see your credentials.
  - **Held within Google's infrastructure** for the add-on's script — not on any
    server operated by the developer.
- **Secrets are never displayed back** in the UI once saved; the fields show a
  "saved — leave blank to keep" placeholder.

## What data flows where

- Query results flow **directly** from your Databricks workspace / Lakebase to
  your spreadsheet over HTTPS. Sheet data you write back flows **directly** from
  your spreadsheet to your Databricks table over HTTPS.
- **No spreadsheet data, query results, or credentials are sent to the developer
  or to any third-party server.** There is no analytics, telemetry, advertising,
  or profiling. The only network destinations are Google's own services and the
  Databricks host you configure.

## Data retention and deletion

- Credentials and settings persist in your per-user Apps Script properties until
  you change or clear them. Use **Databricks Sync → Reset OAuth Authorization** to
  clear a cached OAuth token, and re-save the connection with blank fields (or
  delete the spreadsheet copy) to remove stored settings.
- The developer retains no copy of your data and therefore has nothing to delete
  on your behalf.

## Data sharing

The add-on does not sell, share, or transfer any user data to third parties. It
does not use Google user data for training AI/ML models. Use of Google user data
adheres to the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the Limited Use requirements.

## Security

- All external requests use HTTPS (Apps Script `UrlFetchApp`).
- Credentials are stored in per-user Apps Script storage and never rendered back
  to the client after saving.
- The add-on operates only on the active spreadsheet
  (`spreadsheets.currentonly`).

## Changes to this policy

Material changes will be reflected here with an updated "Last updated" date.

## Contact

Questions about this policy: support@vbalasu.com.
