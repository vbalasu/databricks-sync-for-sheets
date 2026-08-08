# Databricks Sync for Google Sheets

A Google Apps Script (GAS) editor add-on that securely connects a Google Sheet
to a Databricks workspace and syncs data using the
[Databricks SQL Statement Execution API](https://docs.databricks.com/api/workspace/statementexecution).
It supports three enterprise authentication methods — Personal Access Token
(PAT), Service Principal (M2M client credentials), and User OAuth (U2M).

> **📖 New to the add-on?** See the **[User Guide](USER_GUIDE.md)** for
> step-by-step instructions on connecting a sheet and syncing data. The rest of
> this README covers installation and deployment.

## Files

| File | Purpose |
| --- | --- |
| `Code.gs` | Backend: custom menu, per-user config storage, auth engine, sync logic. |
| `Sidebar.html` | Configuration UI (HtmlService sidebar). |
| `appsscript.json` | Manifest: OAuth2 library dependency + OAuth scopes. |

## Features

- **Custom menu "Databricks Sync"** with *Setup Connection*, *Run Manual Sync*,
  and *Reset OAuth Authorization*.
- **Per-user secure storage** via `PropertiesService.getUserProperties()` —
  nothing is stored at the script or document scope, so credentials are never
  shared between users of the same sheet.
- **Three auth types** resolved by a single `getAccessToken()` token manager:
  - **PAT** — returns the stored token.
  - **Service Principal (M2M)** — client-credentials flow against
    `https://<host>/oidc/v1/token`, tokens cached until just before expiry.
  - **User OAuth (U2M)** — authorization-code flow via the
    [apps-script-oauth2](https://github.com/googleworkspace/apps-script-oauth2)
    library, with an `authCallback` redirect handler.
- **Query resolution**: a `Databricks_Settings` sheet maps sheet names
  (column A) to custom SQL (column B); otherwise falls back to
  `SELECT * FROM <active sheet name>`.
- **Robust result handling**: polls the statement to completion, follows result
  chunk links for large result sets, pads ragged rows, and writes headers + data
  starting at A1 after clearing the sheet.
- **Error handling** for network failures, expired/invalid tokens (401/403),
  non-2xx API responses, query failures, timeouts, and empty result sets — with
  user-facing toasts and sidebar status messages.

## Setup

1. **Create the Apps Script project.** Either:
   - Container-bound: from a Google Sheet, *Extensions → Apps Script*, or
   - Standalone via [clasp](https://github.com/google/clasp): `clasp create`.
2. **Add the files.** Copy `Code.gs`, `Sidebar.html`, and `appsscript.json` into
   the project. In the Apps Script editor, enable *Show "appsscript.json"
   manifest file* under Project Settings so the manifest (library + scopes) is
   applied.
3. **Confirm the OAuth2 library.** `appsscript.json` already references library
   ID `1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF` with the symbol
   `OAuth2`. Bump `version` if you need a newer release.
4. **Reload the sheet** and use the **Databricks Sync** menu → **Setup
   Connection**.

## Configuring a connection

In the sidebar, provide:

- **Server Hostname** — e.g. `adb-1234567890.11.azuredatabricks.net`
  (scheme/paths are stripped automatically).
- **HTTP Path** — e.g. `/sql/1.0/warehouses/abc123def456`. The warehouse id is
  parsed from this value.
- **Authentication Type** and its fields:
  - *PAT*: the token (`dapi…`).
  - *Service Principal*: Client ID + Client Secret.
  - *User OAuth*: Client ID + Client Secret, then click **Authorize with
    Databricks**.

Saved secrets are never sent back to the browser; the fields show a
"saved — leave blank to keep" placeholder so you can re-save other settings
without re-entering them.

### OAuth (U2M) redirect URI

For the User OAuth flow, register the add-on's redirect URI in your Databricks
OAuth app. The sidebar displays the exact value after you save a Client ID; it
has the form:

```
https://script.google.com/macros/d/<SCRIPT_ID>/usercallback
```

## Custom queries

Create a sheet named **`Databricks_Settings`**:

| A (sheet name) | B (SQL query) |
| --- | --- |
| `Sales` | `SELECT * FROM prod.sales.orders WHERE region = 'EMEA'` |
| `Inventory` | `SELECT sku, qty FROM prod.ops.inventory` |

When you run a sync on the *Sales* sheet, the query in column B is used. Sheets
without an entry use `SELECT * FROM <sheet name>`.

## Notes & limits

- Results use `INLINE` disposition with `JSON_ARRAY` format. Extremely large
  result sets are subject to Apps Script's runtime (6 min) and memory limits;
  narrow the query for very large tables.
- The M2M token is cached per user via `CacheService` for up to its lifetime
  (max 6 hours) to avoid a token request on every sync.
- `spreadsheets.currentonly` scope limits access to the sheet the add-on runs
  in — appropriate for Marketplace distribution.
