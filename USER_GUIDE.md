# Databricks Sync — User Guide

This guide explains how to use the **Databricks Sync** add-on to pull data from
your Databricks workspace into a Google Sheet. It's written for the person using
the sheet — no coding required.

> **Looking to install or deploy the add-on?** See the
> [README](README.md) for setup, the OAuth2 library, and Marketplace details.

---

## What this add-on does

Databricks Sync runs a SQL query against a Databricks SQL warehouse and drops
the results into your sheet — column headers in row 1, data below, starting at
cell A1. Run it whenever you want fresh data. Each person who uses the sheet
connects with their **own** credentials, which are stored privately for them.

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
2. **HTTP Path** — the path to a SQL warehouse, e.g.
   `/sql/1.0/warehouses/abc123def456`. Find it in Databricks under
   **SQL Warehouses → (your warehouse) → Connection details**.
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

1. **Server Hostname** — paste your workspace address. You can paste the full
   `https://…` URL; the add-on cleans it up for you.
2. **HTTP Path** — paste the warehouse path (e.g.
   `/sql/1.0/warehouses/abc123def456`).
3. **Authentication Type** — pick your sign-in method. The fields below change
   to match your choice:
   - **PAT** → enter your **PAT Token**.
   - **Service Principal** → enter your **Client ID** and **Client Secret**.
   - **User OAuth** → enter your **Client ID** and **Client Secret** (you'll
     authorize in the next step).
4. Click **Save Configuration**. You'll see a green confirmation message.

> **Your secrets stay private.** Tokens and secrets are stored only for your
> Google account and are never shown back on screen. Once saved, the field
> shows "saved — leave blank to keep" — so you can update other settings later
> without re-typing your secret.

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

By default, syncing a tab runs:

```sql
SELECT * FROM <the tab's name>
```

So a tab named `orders` pulls everything from a table named `orders`.

### Using your own custom queries

To control exactly what each tab pulls, create a tab named **`Databricks_Settings`**
and fill in two columns:

| Column A — tab name | Column B — SQL query |
| --- | --- |
| `Sales` | `SELECT * FROM prod.sales.orders WHERE region = 'EMEA'` |
| `Inventory` | `SELECT sku, qty FROM prod.ops.inventory` |

Now, when you sync the **Sales** tab, it runs the query in column B instead of
the default. Tabs not listed here still use the default `SELECT * FROM …`.

Tips:
- The tab name in column A must match the tab name exactly (including
  capitalization).
- Leave column B blank for a tab if you want it to use the default behavior.
- You can add a row for every tab you want to sync.

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
| **Menu doesn't appear** | The add-on hasn't loaded. | Reload the sheet and wait a few seconds. |

> **Large tables:** Google Sheets and the add-on have limits on how long a sync
> can run and how much data it can load. If you're pulling a very large table,
> add filters or select only the columns you need.

---

## Privacy & safety notes

- Your credentials are stored **only for your Google account** and are never
  visible to other people using the same sheet.
- Sync **overwrites** the active tab. Keep a separate tab for any manual notes.
- The add-on only accesses the sheet you're working in.
