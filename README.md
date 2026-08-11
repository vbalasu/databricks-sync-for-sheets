# Databricks Sync for Google Sheets

A Google Apps Script (GAS) editor add-on that securely connects a Google Sheet
to Databricks and syncs data **both directions**:

- **Read** query results into a sheet.
- **Write back** a sheet to a Databricks table with **Append** or **Replace**.

It talks to two Databricks backends over HTTPS:

- **SQL Warehouse** (Delta tables) via the
  [SQL Statement Execution API](https://docs.databricks.com/api/workspace/statementexecution).
- **Lakebase** (managed Postgres) via the **Lakebase Data API** (PostgREST). Apps
  Script's `UrlFetchApp` is HTTPS-only and cannot open a Postgres wire-protocol
  connection, so Lakebase is reached through its Data API using the same
  Databricks OAuth token — not `psql`.

It supports three enterprise authentication methods — Personal Access Token
(PAT), Service Principal (M2M client credentials), and User OAuth (U2M).

> **📖 New to the add-on?** See the **[User Guide](USER_GUIDE.md)** for
> step-by-step instructions on connecting a sheet and syncing data. The rest of
> this README covers installation and deployment.

## Distribution channels

The add-on ships through **two parallel channels**, both running the same code:

1. **Google Workspace Marketplace** — a public listing users install as an
   add-on (verified by Google, no "unverified app" warning). See
   [MARKETPLACE.md](MARKETPLACE.md) for the publication runbook and
   `human-input/PUBLISH-STATUS.md` for current submission status.
2. **Template copy** — a master Google Sheet shared via a `/copy` link; each user
   makes a private copy that carries the bound script. Requires no admin approval
   and works even where Marketplace installs are restricted.

End-user install steps for both are in the **[User Guide](USER_GUIDE.md)**.

## Files

| File | Purpose |
| --- | --- |
| `Code.gs` | Backend: custom menu, per-user config storage, auth engine, backend abstraction, read + writeback logic. |
| `Sidebar.html` | Configuration UI (HtmlService sidebar) incl. backend selector + writeback card. |
| `appsscript.json` | Manifest: OAuth2 library dependency + OAuth scopes. |
| `docs/privacy-policy.md`, `docs/terms-of-service.md` | Legal docs to host for Marketplace publication. |
| `MARKETPLACE.md` | Marketplace publication runbook + listing copy. |

## Features

- **Custom menu "Databricks Sync"** with *Setup Connection*, *Run Manual Sync*,
  *Write Active Sheet → Databricks (Append/Replace)*, and *Reset OAuth
  Authorization*.
- **Two backends** behind one interface (`getBackend_()`): **SQL Warehouse**
  (Delta) and **Lakebase** (Data API / PostgREST). Reads and writes work on both.
- **Read + writeback**:
  - `readFromDatabricks(source, targetSheet, mode)` — mode `overwrite` (default)
    or `append`.
  - `writeToDatabricks(sourceSheet, targetTable, mode)` — mode `append` or
    `replace`. Row 1 of the sheet holds column names.
  - `syncDatabricksData()` remains the menu/sidebar read handler (thin wrapper).
- **Per-user secure storage** via `PropertiesService.getUserProperties()` —
  nothing is stored at the script or document scope, so credentials are never
  shared between users of the same sheet.
- **Three auth types** resolved by a single `getAccessToken()` token manager
  (PAT, Service Principal M2M, User OAuth U2M) — shared by both backends.
- **Query resolution**: a `Databricks_Settings` sheet maps sheet names
  (column A) to custom SQL (column B); otherwise falls back to
  `SELECT * FROM <active sheet name>` (warehouse) / `SELECT * ` on the table
  (Lakebase).
- **Safe writeback**: warehouse inserts use **named statement parameters** (no
  hand-escaped SQL); identifiers are backtick-quoted; rows are **batched** under
  the API's statement-size cap and a runtime budget below the 6-minute limit.
  Replace uses `INSERT OVERWRITE` (atomic first batch) / `TRUNCATE`.
- **Robust result handling**: polls the statement to completion, follows result
  chunk links for large result sets, pads ragged rows, and (for reads) writes
  headers + data starting at A1.
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

- **Backend** — *SQL Warehouse* (Delta) or *Lakebase* (Postgres, Data API).
- **Server Hostname** — e.g. `adb-1234567890.11.azuredatabricks.net`
  (scheme/paths are stripped automatically).
- **SQL Warehouse backend:**
  - **HTTP Path** — e.g. `/sql/1.0/warehouses/abc123def456`. The warehouse id is
    parsed from this value.
- **Lakebase backend:**
  - **Lakebase REST Endpoint** — the Data API URL from the Lakebase app's *API*
    tab (without a schema; the add-on appends `/<schema>/<table>`).
  - **Schema** — Postgres schema, defaults to `public`.
  - **Primary Key column** — optional, but **required for Replace** (PostgREST
    blocks unfiltered bulk delete, so the add-on deletes all rows via a
    PK-based filter).
- **Authentication Type** and its fields:
  - *PAT*: the token (`dapi…`). *(For Lakebase, prefer SP or User OAuth — a PAT
    may be rejected by the Data API authenticator role.)*
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

## Writeback (Sheet → Databricks)

Write the **active sheet** to a table via the sidebar **Write to Databricks**
card or the **Databricks Sync → Write Active Sheet → Databricks (Append/Replace)**
menu items.

- **Row 1 holds the column names**, which must match the target table's columns;
  rows 2..N are the data.
- **Append** inserts the data rows. **Replace** overwrites the entire table.
- **Replace is destructive** and is gated by a typed-name confirmation (sidebar)
  or a re-type prompt (menu).
- **Warehouse:** target is `catalog.schema.table`. Inserts use parameterized
  statements (values are never interpolated into SQL); rows are batched under the
  16 MiB statement cap and a ~5-minute runtime budget. Replace runs
  `INSERT OVERWRITE` for the first batch (atomic), then `INSERT INTO`; an empty
  sheet runs `TRUNCATE TABLE`.
- **Lakebase:** target is the table name (in the configured schema). Rows POST as
  JSON to the Data API. Replace requires a configured **Primary Key column**.

Programmatic entry points (callable from other scripts or triggers):

```js
readFromDatabricks(source, targetSheet, mode);   // mode: 'overwrite' | 'append'
writeToDatabricks(sourceSheet, targetTable, mode); // mode: 'append' | 'replace'
```

## Lakebase Data API setup (one-time, per database)

The Lakebase backend uses the **Data API** (PostgREST over HTTPS) because Apps
Script can only make HTTPS requests — it cannot open a Postgres (5432)
connection. Before the add-on can read or write, an admin must enable the Data
API and authorize a **non-owner** identity. This flow was verified end-to-end
against a Free Edition Lakebase project.

1. **Enable the Data API** on the project's endpoint (Lakebase app → *Data API*).
   Copy the **API URL** shown there — it looks like:

   ```
   https://<endpoint-host>/api/2.0/workspace/<workspace_id>/rest/<database>
   ```

   Paste that whole URL into the add-on's **Lakebase REST Endpoint** field. The
   add-on appends `/<schema>/<table>` (e.g. `/public/orders`).

2. **Use a service principal, not the database owner.** The owner identity cannot
   be granted to the `authenticator` role, so the Data API rejects it. Create (or
   reuse) a service principal, then connect once with `psql` as an admin to
   register it (replace `<sp-app-id>` with the SP's application ID):

   ```sql
   CREATE EXTENSION IF NOT EXISTS databricks_auth;
   SELECT databricks_create_role('<sp-app-id>', 'SERVICE_PRINCIPAL');
   GRANT "<sp-app-id>" TO authenticator;
   GRANT USAGE ON SCHEMA public TO "<sp-app-id>";
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "<sp-app-id>";
   ```

3. **Configure the add-on** with **Service Principal (M2M)** auth (the SP's Client
   ID + secret). A PAT is rejected by the Data API (`400 "not a valid JWT"`);
   Service Principal or User OAuth is required.

Target tables should have a **primary key**; the add-on's Replace deletes all rows
with a PK-based filter (`?<pk>=not.is.null` then `?<pk>=is.null`) before
inserting, because PostgREST blocks unfiltered bulk deletes.

## Notes & limits

- Reads use `INLINE` disposition with `JSON_ARRAY` format. Extremely large
  result sets are subject to Apps Script's runtime (6 min) and memory limits;
  narrow the query for very large tables.
- Writeback is **batched** and guarded by a runtime budget; very large sheets may
  need more than one run. Multi-batch **Replace** is not fully atomic across
  batches — a mid-run failure can leave the table partially written (the error
  reports how many batches committed).
- Append is **not idempotent** — re-running after a network blip can double-insert.
- Lakebase requires the **Data API enabled** on the instance and an
  authenticator/Postgres role for your identity; a PAT may be rejected (use SP or
  User OAuth).
- The M2M token is cached per user via `CacheService` for up to its lifetime
  (max 6 hours) to avoid a token request on every call.
- `spreadsheets.currentonly` scope limits access to the sheet the add-on runs
  in — appropriate for Marketplace distribution.

## Publishing to the Google Workspace Marketplace

See **[MARKETPLACE.md](MARKETPLACE.md)** for the full publication runbook, listing
copy, scope justifications, and demo-video script. Legal docs to host live in
**[docs/privacy-policy.md](docs/privacy-policy.md)** and
**[docs/terms-of-service.md](docs/terms-of-service.md)**.
