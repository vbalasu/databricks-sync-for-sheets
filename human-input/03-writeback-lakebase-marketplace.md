# Writeback capability, Lakebase support and Google Workspace Marketplace

### Writeback capability

Implement the capability to write back to Databricks.
There should be support for the following two modes.
1. Append - take data from the spreadsheet and add new rows in Databricks.
2. Replace - use data from the spreadsheet to completely overwrite the table in Databricks.

Create callable functions in Google Apps Script that support this behavior.
The function should take in the source spreadsheet, target table, and mode as parameters.

Also, refactor the read from Databricks functionality to encapsulate that into a function.
That function should take in the source table, target spreadsheet, and mode as parameters.

### Lakebase support

Add support for lakebase as the databricks backend database.

It should support the same functionality as that implemented with delta tables.

Leverage the existing authentication methods to the Databricks workspace, and use that to mint lakebase credentials.
Read the latest Databricks documentation to determine how that works.

### Google Workspace Marketplace

Prepare this application to be published on the Google Workspace Marketplace. Grill me about the publishing characteristics. Then plan and execute the publication.