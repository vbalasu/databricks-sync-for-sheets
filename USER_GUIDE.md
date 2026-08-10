# Databricks Sync — User Guide

This guide explains how to use the **Databricks Sync** add-on to pull data from
your Databricks workspace into a Google Sheet. It's written for the person using
the sheet — no coding required.

> **Looking to install or deploy the add-on?** See the
> [README](README.md) for setup, the OAuth2 library, and Marketplace details.

---

## What this add-on does

Databricks Sync connects your sheet to Databricks **both ways**:

- **Read:** run a query against a Databricks SQL warehouse (or a Lakebase table)
  and drop the results into your sheet — column headers in row 1, data below,
  starting at cell A1.
- **Write back:** send a sheet's contents to a Databricks table — **Append** rows
  or **Replace** the whole table.

Run it whenever you want fresh data or want to push changes back. Each person who
uses the sheet connects with their **own** credentials, which are stored privately
for them.

You can connect to two kinds of Databricks backend:

- **SQL Warehouse** — Delta tables (uses an HTTP Path to a SQL warehouse).
- **Lakebase** — Databricks' managed Postgres (uses the Lakebase **Data API**
  REST endpoint). For Lakebase, prefer **Service Principal** or **User OAuth**
  sign-in.

---

## Getting started: make your own copy

This add-on is distributed as a **template Google Sheet** with the code already
built in. You don't install anything — you just make your own copy.

**➡️ [Click here to copy the Databricks Sync template](https://docs.google.com/spreadsheets/d/1JR1AFPB9LnqjAm0yvGCdE2AymtdMnVPTPrEoPNFqvh4/copy)**

1. Click the link above.
2. Google shows a **"Copy document"** prompt. Click **Make a copy**.
3. A new sheet — *"Copy of Databricks Sync — Master Template"* — appears in
   **your** Google Drive. It's yours: rename it, share it, and use it like any
   other sheet. Renaming it is a good idea (for example, "Q3 Sales Sync").
4. Reload the copy once. Within a few seconds a **Databricks Sync** menu appears
   in the menu bar, next to *Help*.

> **First-time authorization prompt.** The first time you click a
> **Databricks Sync** menu item, Google asks you to authorize the script and
> shows a warning that reads **"Google hasn't verified this app."** This is
> expected for template-copy add-ons — the script now runs privately in *your*
> account. Click **Advanced → Go to Databricks Sync (unsafe)**, then **Allow**.
> You only do this once per copy.

Everyone who needs their own synced sheet should make their **own** copy from
the link above, rather than sharing a single copy — that way each person uses
their own Databricks credentials.

Once you've got your copy and the menu is showing, continue below.

---

## Before you start

You'll need three things from your Databricks workspace (your Databricks admin
can provide these):

1. **Server Hostname** — your workspace address, e.g.
   `adb-1234567890.11.azuredatabricks.net`.
2. Depending on the **Backend** you pick:
   - **SQL Warehouse** — an **HTTP Path** to a SQL warehouse, e.g.
     `/sql/1.0/warehouses/abc123def456`. Find it in Databricks under
     **SQL Warehouses → (your warehouse) → Connection details**.
   - **Lakebase** — the **Data API URL** shown in the Lakebase app's *Data API*
     page (it ends in `/rest/<database>`), plus the schema (usually `public`) and,
     for Replace, the table's primary-key column. Lakebase needs a one-time admin
     setup and a **Service Principal** (not a PAT) — see the *Lakebase Data API
     setup* section of the [README](README.md).
3. **Credentials** for one of the sign-in methods below.

### Which sign-in method should I use?

| Method | Best for | You'll need |
| --- | --- | --- |
| **Personal Access Token (PAT)** | The quickest way to connect as yourself. | A token string that starts with `dapi…` |
| **Service Principal (M2M)** | A shared/automated identity not tied to a person. | A Client ID and Client Secret |
| **User OAuth (U2M)** | Signing in as yourself through your browser, no long-lived token to manage. | A Client ID and Client Secret, plus a one-time browser authorization |

If you're not sure, start with **PAT** — it's the simplest.

> **How to create a PAT:** In Databricks, click your profile (top right) →
> **Settings → Developer → Access tokens → Generate new token**. Copy it
> immediately; you won't be able to see it again.

---

## Step 1 — Open the setup panel

1. Open your Google Sheet.
2. In the menu bar, click **Databricks Sync → Setup Connection**.
   - Don't see the menu? Reload the sheet and wait a few seconds for the
     add-on to load.
3. A panel opens on the right side of the sheet.

---

## Step 2 — Enter your connection details

In the panel:

1. **Backend** — choose where your data lives:
   - **SQL Warehouse (Delta tables)** — the usual choice for lakehouse tables.
   - **Lakebase (Postgres · Data API)** — Databricks' managed Postgres.

   The fields below change to match your choice (see the two examples that
   follow).
2. **Server Hostname** — paste your workspace address. You can paste the full
   `https://…` URL; the add-on cleans it up for you.
3. **Backend-specific fields:**
   - *SQL Warehouse* → **HTTP Path** (e.g. `/sql/1.0/warehouses/abc123def456`).
   - *Lakebase* → **Lakebase REST Endpoint** (the Data API URL, ending in
     `/rest/<database>`), **Schema** (usually `public`), and optionally a
     **Primary Key column** (required only for Replace).
4. **Authentication Type** — pick your sign-in method. The fields below change
   to match your choice:
   - **PAT** → enter your **PAT Token**.
   - **Service Principal** → enter your **Client ID** and **Client Secret**.
   - **User OAuth** → enter your **Client ID** and **Client Secret** (you'll
     authorize in the next step).
5. Click **Save Configuration**. You'll see a green confirmation message.

> **Your secrets stay private.** Tokens and secrets are stored only for your
> Google account and are never shown back on screen. Once saved, the field
> shows "saved — leave blank to keep" — so you can update other settings later
> without re-typing your secret.

### Example A — SQL Warehouse with a Personal Access Token

| Field | Value |
| --- | --- |
| Backend | `SQL Warehouse (Delta tables)` |
| Server Hostname | `adb-1234567890.11.azuredatabricks.net` |
| HTTP Path | `/sql/1.0/warehouses/abc123def456` |
| Authentication Type | `Personal Access Token (PAT)` |
| PAT Token | `dapi0123456789abcdef…` |

Click **Save Configuration** → green "Configuration saved." You're ready to
[read](#step-4--sync-your-data) and [write back](#writing-data-back-to-databricks).

### Example B — Lakebase with a Service Principal

Lakebase's Data API needs a **Service Principal** (a PAT is rejected) and a
one-time admin setup — see *Lakebase Data API setup* in the [README](README.md).

| Field | Value |
| --- | --- |
| Backend | `Lakebase (Postgres · Data API)` |
| Server Hostname | `dbc-b29b2f7a-5112.cloud.databricks.com` |
| Lakebase REST Endpoint | `https://ep-….database.us-east-2.cloud.databricks.com/api/2.0/workspace/1066745611279538/rest/databricks_postgres` |
| Schema | `public` |
| Primary Key column | `id` *(needed for Replace)* |
| Authentication Type | `Service Principal (M2M)` |
| Client ID | `b7df7dd1-1ec5-44de-9bc6-adaf26f34ec1` |
| Client Secret | *your service principal's OAuth secret* |

Paste the **Lakebase REST Endpoint** exactly as shown on the Lakebase app's
*Data API* page (it ends in `/rest/<database>`). The add-on adds the schema and
table for you, e.g. `…/rest/databricks_postgres` + `/public/orders`.

---

## Step 3 (User OAuth only) — Authorize in your browser

Skip this step if you chose PAT or Service Principal.

1. After saving, an **OAuth Authorization** box appears showing
   **"Not authorized."**
2. Click **Authorize with Databricks →**. A new browser tab opens.
3. Sign in and approve access. When you see the "Connected" confirmation, close
   that tab and return to your sheet.
4. The box now shows a green **"Authorized"** badge.

> **First-time admin note:** if authorization fails, your Databricks OAuth app
> may need the add-on's redirect URL registered. The panel displays the exact
> URL to hand to your admin (it ends in `/usercallback`).

If you ever need to sign in again (for example, your access changed), click
**Re-authorize**, or use the menu item **Databricks Sync → Reset OAuth
Authorization**.

---

## Step 4 — Sync your data

You can run a sync two ways:

- **From the panel:** click **Sync Now**.
- **From the menu:** click **Databricks Sync → Run Manual Sync**.

While it runs, a small notice appears at the bottom-right of the sheet. When it
finishes, the **active sheet** (the tab you're currently on) is cleared and
filled with your query results — headers in row 1, data below.

> **Important:** Sync writes to whichever tab is currently selected, and it
> **replaces everything on that tab**. Make sure you're on the right tab before
> syncing, and don't keep other notes on a tab you sync into.

---

## Choosing what data gets pulled

By default, syncing a tab pulls the table whose name matches the tab:

- **SQL Warehouse** runs `SELECT * FROM <the tab's name>`. So a tab named
  `orders` pulls everything from a table named `orders`. (If your table lives in a
  specific catalog/schema, use a custom query — see below — e.g.
  `SELECT * FROM main.sales.orders`.)
- **Lakebase** reads all rows of the table named like the tab, from your
  configured schema (e.g. tab `orders` → `public.orders`).

**Worked example (default read):** rename a tab to **`orders`**, make sure a
table of that name exists, and click **Sync Now**. The tab fills with the
table's columns in row 1 and its rows below.

### Using your own custom queries (SQL Warehouse only)

To control exactly what each tab pulls, add a tab named **`Databricks_Settings`**
that maps a tab name (column A) to the SQL that should run for it (column B).

> **Lakebase note:** custom SQL applies to the **SQL Warehouse** backend only.
> The Lakebase Data API reads whole tables, so on Lakebase a tab always pulls the
> table named like the tab. (If a Lakebase tab has a `Databricks_Settings` query,
> the add-on tells you to remove it or switch to the warehouse backend.)

**Set it up once:**

1. At the bottom of the sheet, click **+** to add a new tab and rename it exactly
   **`Databricks_Settings`** (the name and capitalization must match).
2. In **A1** type `Sheet Name` and in **B1** type `SQL Query` (these header labels
   are for your reference — the add-on reads every row).
3. Add one row per tab you want to customize. For example, to pull your
   workspace's billing usage into a tab named **`Billing_Usage`**:

| A — Sheet Name | B — SQL Query |
| --- | --- |
| `Sheet Name` | `SQL Query` |
| `Billing_Usage` | `SELECT usage_date, sku_name, usage_quantity FROM system.billing.usage ORDER BY usage_date DESC LIMIT 100` |
| `Sales` | `SELECT * FROM prod.sales.orders WHERE region = 'EMEA'` |

4. Create a tab whose name matches column A (e.g. **`Billing_Usage`**), select it,
   and run **Sync Now**. It runs the query from column B instead of the default.

> **`system.billing.usage`** is a built-in Databricks system table available in
> every Unity Catalog workspace, so the example above works out of the box (as
> long as your credentials have access to the `system` catalog). It's a good way
> to confirm your connection is working before pointing at your own tables.

Tabs not listed in `Databricks_Settings` still use the default `SELECT * FROM …`.

Tips:
- The tab name in column A must match the tab name exactly (including
  capitalization).
- Leave column B blank for a tab if you want it to use the default behavior.
- You can add a row for every tab you want to sync.

---

## Writing data back to Databricks

You can also push a tab's contents **into** a Databricks table.

**How the tab must be laid out:** row 1 holds the **column names** (matching the
target table's columns), and the rows below are the data.

**Two modes:**

- **Append** — adds the tab's rows as **new** rows in the table.
- **Replace** — **overwrites the entire table** with the tab's rows. This is
  destructive.

**Example tab layout** (row 1 = column names, matching the target table):

| A (id) | B (name) | C (pi) | D (flag) |
| --- | --- | --- | --- |
| `id` | `name` | `pi` | `flag` |
| `1` | `alice` | `3.14` | `TRUE` |
| `2` | `bob` | `2.72` | `FALSE` |

**To write from the panel:**

1. Select the tab you want to write.
2. Open **Databricks Sync → Setup Connection** and scroll to **Write to
   Databricks**.
3. Enter the **target table**:
   - SQL Warehouse: `catalog.schema.table` (e.g. `main.sales.orders`).
   - Lakebase: just the table name in your configured schema (e.g. `orders`).
4. Pick **Append** or **Replace**.
   - For **Replace**, re-type the table name in the confirmation box to enable
     the button.
5. Click **Write to Databricks**. A message confirms how many rows were written,
   e.g. *"Appended 2 row(s) × 4 column(s) in orders (1 batch)."*

**Or from the menu:** **Databricks Sync → Write Active Sheet → Databricks
(Append)** or **(Replace)**, then enter (and, for Replace, re-type) the table
name when prompted.

### Worked example — Append

1. On a tab laid out like the table above, add a new row: `3 | carol | 1.41 | TRUE`.
2. **Write to Databricks** → target `main.sales.orders` (warehouse) or `orders`
   (Lakebase) → **Append** → **Write**.
3. The three rows are added to the table. To confirm, run **Sync Now** on a read
   tab and see them appear.

### Worked example — Replace

1. On the same tab, keep only the rows you want the table to end up with.
2. **Write to Databricks** → same target → **Replace**.
3. The **Write** button stays disabled until you **re-type the table name** in the
   confirmation box. Type it, then **Write**.
4. The table now contains *only* the tab's rows. Message: *"Replaced N row(s) …"*.

> **Replace overwrites everything in the target table.** Double-check the table
> name and that you're on the right tab. On **Lakebase**, Replace needs a
> **Primary Key column** set in Setup Connection (it deletes all existing rows by
> that key before inserting) — without it the add-on refuses Replace and tells you
> to set one or use Append.

> **Tokens are short-lived.** Service Principal / OAuth tokens last ~1 hour and
> refresh automatically; you don't need to do anything.

> **Large tabs** are written in batches and may take a while; if a tab is very
> large you might need to run the write more than once (the message tells you how
> many rows were written).

---

## Everyday workflow

Once you're set up, the routine is simple:

1. Click the tab you want to refresh.
2. **Databricks Sync → Run Manual Sync** (or **Sync Now** in the panel).
3. Your data refreshes in place.

You only need to do the setup steps once (or again if your credentials change).

---

## Troubleshooting

| Message / symptom | What it means | What to do |
| --- | --- | --- |
| **"Databricks connection is not configured."** | You haven't saved settings yet. | Open **Setup Connection** and save your details. |
| **"No PAT token saved."** | PAT is selected but no token is stored. | Re-open setup and paste a valid token. |
| **"authentication failed (HTTP 401/403)"** | Your token/credentials are expired, wrong, or lack access. | Generate a new token or check your permissions, then save again. For OAuth, click **Re-authorize**. |
| **"Not authorized with Databricks OAuth."** | OAuth sign-in wasn't completed. | Do **Step 3** above and complete the browser authorization. |
| **"Query did not succeed"** | Databricks rejected the SQL (e.g. table not found, syntax error). | Check the table/column names and your custom query in `Databricks_Settings`. |
| **"Query timed out"** | The query ran too long. | Narrow it down (add filters, fewer columns), or use a faster warehouse. |
| **"Query returned no rows."** | The query ran fine but matched nothing. | Confirm the table has data and your filters aren't too strict. |
| **"Replace on Lakebase requires a Primary Key column"** | You chose Replace on Lakebase without setting a PK. | Set the **Primary Key column** in Setup Connection, or use **Append**. |
| **"not a valid JWT" / auth error on Lakebase** | You're using a PAT with Lakebase, which the Data API rejects. | Switch to **Service Principal** or **User OAuth** for the Lakebase backend. |
| **"The data api is not enabled for this endpoint."** | Lakebase Data API isn't turned on, or the URL points at the wrong database. | Enable the Data API in the Lakebase app and copy the exact **API URL** (ending in `/rest/<database>`). |
| **"Sheet … is empty — nothing to write."** | You ran a write on a tab with no header row or no data. | Put column names in row 1 and data below, then write. |
| **Menu doesn't appear** | The add-on hasn't loaded. | Reload the sheet and wait a few seconds. |

> **Large tables:** Google Sheets and the add-on have limits on how long a sync
> can run and how much data it can load. If you're pulling a very large table,
> add filters or select only the columns you need.

---

## Privacy & safety notes

- Your credentials are stored **only for your Google account** and are never
  visible to other people using the same sheet.
- Reading **overwrites** the active tab. Keep a separate tab for any manual notes.
- Writing back can change Databricks data — **Append** adds rows and **Replace**
  overwrites the whole table. Double-check the target table and mode.
- The add-on only accesses the sheet you're working in; data flows directly
  between your sheet and your Databricks/Lakebase over HTTPS.
