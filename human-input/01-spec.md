# Project Specification: Databricks Sync Google Sheets Extension

## 1. Project Overview

A Google Apps Script (GAS) extension intended for the Google Workspace Marketplace. The extension allows users to securely connect a Google Sheet to a Databricks workspace and sync data using the Databricks SQL Statement API. It supports standard SQL queries and dynamic fallback queries, and handles multiple enterprise-grade authentication methods (PAT, M2M, U2M).

## 2. Tech Stack & Dependencies

* **Environment:** Google Apps Script (GAS)
* **Frontend:** HTML/CSS/JS (Google Apps Script `HtmlService`)
* **Backend Storage:** `PropertiesService.getUserProperties()`
* **External API:** Databricks SQL Statement Execution API (`/api/2.0/sql/statements/`)
* **Required Library:** Google Apps Script OAuth2 Library (Script ID: `1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF`)

## 3. File Structure

* `Code.gs` - Contains all backend logic, API calls, auth flows, and spreadsheet manipulation.
* `Sidebar.html` - Contains the UI, CSS, and client-side JS for the configuration sidebar.

## 4. Feature Requirements

### A. Custom Menu (`onOpen`)

* Create a custom menu titled **"Databricks Sync"**.
* Menu items:
* **"Setup Connection"** -> Opens `Sidebar.html` as a sidebar.
* **"Run Manual Sync"** -> Triggers the `syncDatabricksData()` backend function.



### B. Configuration UI (`Sidebar.html`)

* **Inputs required:**
* Server Hostname (e.g., `adb-123.net`)
* HTTP Path (e.g., `sql/1.0/warehouses/abc`)
* Authentication Type (Dropdown: PAT, Service Principal, OAuth)
* PAT Token (Password input, conditionally rendered)
* Client ID (Text input, conditionally rendered)
* Client Secret (Password input, conditionally rendered)


* **Client-side Logic:**
* On load (`window.onload`), call a backend function to fetch previously saved configurations and populate the inputs.
* Dynamically show/hide the PAT, Client ID, and Client Secret fields based on the selected Authentication Type.
* "Save Configuration" button that passes the JSON payload to the backend via `google.script.run` and provides temporary success/error UI feedback.
* *Note to agent:* Needs logic to display an OAuth authorization URL if the user selects U2M OAuth and isn't authorized yet.



### C. Secure Storage (Backend)

* Use `PropertiesService.getUserProperties()` to store and retrieve: `DB_HOSTNAME`, `DB_HTTP_PATH`, `DB_AUTH_TYPE`, `DB_PAT`, `DB_CLIENT_ID`, `DB_CLIENT_SECRET`.
* Keep logic completely scoped to the active user (no `ScriptProperties` or `DocumentProperties`).

### D. Authentication Engine (Backend)

Implement a token manager (`getAccessToken()`) that handles three auth types:

1. **PAT (`pat`):** Return the saved PAT token directly.
2. **Service Principal / M2M (`sp`):**
* Execute a Client Credentials flow.
* Endpoint: `https://[hostname]/oidc/v1/token`
* Headers: `Authorization: Basic [Base64(clientId:clientSecret)]`
* Payload: `grant_type=client_credentials`, `scope=all-apis`
* Return the resulting `access_token`.


3. **User OAuth / U2M (`oauth`):**
* Use the standard GAS OAuth2 library.
* Authorization Base URL: `https://[hostname]/oidc/v1/authorize`
* Token URL: `https://[hostname]/oidc/v1/token`
* Scope: `all-apis`
* Must implement the standard callback function (`authCallback`) to handle the Databricks redirect.



### E. Data Sync Logic (`syncDatabricksData`)

* **Determine the SQL Query:**
1. Look for a sheet named `Databricks_Settings`.
2. If it exists, scan Column A for the name of the *Active Sheet*, and look in Column B for a custom SQL Query.
3. If no custom query is found, fall back to: `SELECT * FROM [Active_Sheet_Name]`.


* **Execute the Query (To be implemented by agent):**
* Fetch an access token using the Authentication Engine.
* Make an HTTP POST request via `UrlFetchApp` to the Databricks SQL Statement API (`https://[hostname]/api/2.0/sql/statements/`).
* Headers: `Authorization: Bearer [token]`.
* Payload: `{"statement": "[sql_query]", "warehouse_id": "[parsed_from_http_path]"}`.


* **Write Data to Sheet (To be implemented by agent):**
* Parse the JSON response from Databricks.
* Clear the existing active sheet.
* Write the returned column headers and row data into the active sheet starting at A1.



---

**Instructions for the Coding Agent:**
Please generate the complete `Code.gs` and `Sidebar.html` files fulfilling these requirements. Ensure all error handling (network failures, expired tokens, empty datasets) is robust, as this is intended for public Marketplace deployment.