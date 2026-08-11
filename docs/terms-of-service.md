# Terms of Service — Databricks Sync for Google Sheets

_Last updated: 2026-08-10_

These terms govern your use of the **Databricks Sync for Google Sheets™** add-on
("the add-on"), provided by **Vijay Balasubramaniam** (individual developer,
"the developer"). By installing or using the add-on, you agree to these terms.

> **Publish note:** Host these terms at a stable, publicly reachable URL on a
> domain you control (the same domain as the privacy policy), and reference that
> URL in the Marketplace listing.

## 1. License

The add-on's source code is licensed under the **Apache License, Version 2.0**
(see the `LICENSE` file in the project). These Terms of Service govern your use of
the distributed add-on and are in addition to that source license.

## 2. What the add-on does

The add-on connects the current Google Sheet to a Databricks workspace or
Lakebase database that **you** configure, to (a) read query results into the
sheet and (b) write sheet contents back to a Databricks/Lakebase table. You are
responsible for the Databricks resources, credentials, and permissions you use.

## 3. Your responsibilities

- You must have the right to access the Databricks workspace, warehouse, catalog,
  schema, tables, and/or Lakebase instance you connect to.
- You are responsible for the SQL you run and the data you write back, including
  **destructive operations**. "Replace" **overwrites the entire target table**;
  confirm the target before using it.
- You must comply with your organization's policies and with Databricks' and
  Google's terms.
- Keep your credentials secure. The add-on stores them per-user within Google's
  infrastructure and never transmits them to the developer.

## 4. No warranty

THE ADD-ON IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE, AND NONINFRINGEMENT. You use the add-on at your own risk,
including for any data read into or written back from your sheets.

## 5. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE DEVELOPER SHALL NOT BE LIABLE FOR ANY
INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, OR FOR ANY
LOSS OF DATA, PROFITS, OR REVENUE, ARISING FROM OR RELATED TO YOUR USE OF THE
ADD-ON — including data overwritten by a "Replace" writeback.

## 6. Data handling

The add-on's data practices are described in the
[Privacy Policy](privacy-policy.md). In short: your credentials and settings are
stored per-user within Google's infrastructure; spreadsheet data and query
results flow directly between your sheet and your Databricks/Lakebase over HTTPS;
nothing is sent to the developer.

## 7. Changes

These terms may be updated from time to time; material changes will be reflected
here with an updated "Last updated" date. Continued use after a change
constitutes acceptance.

## 8. Contact

Questions about these terms: support@vbalasu.com.

## 9. Trademarks

Google Sheets™ and Google Workspace™ are trademarks of Google LLC. This add-on is
an independent project and is not created, endorsed, or sponsored by Google LLC.
Databricks and Lakebase are trademarks of Databricks, Inc.
