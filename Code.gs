/**
 * Databricks Sync for Google Sheets
 * -----------------------------------------------------------------------------
 * Backend logic: custom menu, secure per-user configuration storage, a token
 * manager supporting PAT / Service Principal (M2M) / User OAuth (U2M), and the
 * data-sync engine that runs a SQL statement against a Databricks SQL Warehouse
 * and writes the result into the active sheet.
 *
 * Companion UI: Sidebar.html
 * Required library (see appsscript.json): apps-script-oauth2 (symbol: OAuth2)
 */

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/** UserProperties keys. All configuration is scoped to the active user only. */
var PROP = {
  HOSTNAME: 'DB_HOSTNAME',
  HTTP_PATH: 'DB_HTTP_PATH',
  AUTH_TYPE: 'DB_AUTH_TYPE',
  PAT: 'DB_PAT',
  CLIENT_ID: 'DB_CLIENT_ID',
  CLIENT_SECRET: 'DB_CLIENT_SECRET'
};

/** Supported authentication types (stored in DB_AUTH_TYPE). */
var AUTH = {
  PAT: 'pat',    // Personal Access Token
  SP: 'sp',      // Service Principal / machine-to-machine (client credentials)
  OAUTH: 'oauth' // User-to-machine OAuth (authorization code)
};

/** Name of the sheet that maps sheet names -> custom SQL queries. */
var SETTINGS_SHEET_NAME = 'Databricks_Settings';

/** OAuth scope requested for all Databricks auth flows. */
var DB_SCOPE = 'all-apis';

/** How long to keep polling a running statement before giving up (ms). */
var STATEMENT_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes
/** Delay between statement status polls (ms). */
var STATEMENT_POLL_MS = 2000;

// ----------------------------------------------------------------------------
// Add-on lifecycle: menu + sidebar
// ----------------------------------------------------------------------------

/**
 * Builds the "Databricks Sync" menu when the spreadsheet opens.
 * @param {Object} e The onOpen event (unused).
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Databricks Sync')
    .addItem('Setup Connection', 'showSidebar')
    .addItem('Run Manual Sync', 'syncDatabricksData')
    .addSeparator()
    .addItem('Reset OAuth Authorization', 'resetOAuth')
    .addToUi();
}

/**
 * Runs when the add-on is installed from the Marketplace. Ensures the menu
 * shows up immediately without requiring a reload.
 * @param {Object} e The onInstall event.
 */
function onInstall(e) {
  onOpen(e);
}

/** Opens Sidebar.html as a sidebar. */
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Databricks Sync');
  SpreadsheetApp.getUi().showSidebar(html);
}

// ----------------------------------------------------------------------------
// Configuration storage (per-user)
// ----------------------------------------------------------------------------

/**
 * Returns the saved configuration for the current user so the sidebar can
 * populate its inputs. Secrets (PAT, client secret) are never returned to the
 * client; instead a boolean flag indicates whether a value is on file. The
 * sidebar shows a "saved — leave blank to keep" placeholder for those fields.
 *
 * @return {Object} Configuration + OAuth status for the sidebar.
 */
function getConfig() {
  var props = PropertiesService.getUserProperties();
  var authType = props.getProperty(PROP.AUTH_TYPE) || AUTH.PAT;

  var config = {
    hostname: props.getProperty(PROP.HOSTNAME) || '',
    httpPath: props.getProperty(PROP.HTTP_PATH) || '',
    authType: authType,
    clientId: props.getProperty(PROP.CLIENT_ID) || '',
    hasPat: !!props.getProperty(PROP.PAT),
    hasClientSecret: !!props.getProperty(PROP.CLIENT_SECRET),
    // Static per-script; returned regardless of the saved auth type so the UI
    // can show it the moment the user switches to OAuth on a fresh copy.
    redirectUri: getRedirectUri_(),
    oauth: getOAuthStatus_(authType)
  };
  return config;
}

/**
 * Persists configuration for the current user.
 *
 * Secret fields (patToken, clientSecret) are only written when a non-empty
 * value is supplied; sending an empty string keeps the previously saved secret.
 * This lets the sidebar avoid ever rendering the stored secret while still
 * allowing the rest of the form to be edited and re-saved.
 *
 * @param {Object} config Values from the sidebar form.
 * @return {Object} { success: true, message: string }
 */
function saveConfig(config) {
  if (!config) throw new Error('No configuration provided.');

  var props = PropertiesService.getUserProperties();

  var hostname = normalizeHost_(config.hostname);
  var httpPath = (config.httpPath || '').trim();
  var authType = (config.authType || AUTH.PAT).trim();

  if (!hostname) throw new Error('Server Hostname is required.');
  if (!httpPath) throw new Error('HTTP Path is required.');
  if ([AUTH.PAT, AUTH.SP, AUTH.OAUTH].indexOf(authType) === -1) {
    throw new Error('Unknown authentication type: ' + authType);
  }

  props.setProperty(PROP.HOSTNAME, hostname);
  props.setProperty(PROP.HTTP_PATH, httpPath);
  props.setProperty(PROP.AUTH_TYPE, authType);

  // Per-auth-type fields. Only overwrite secrets when a new value is supplied.
  if (authType === AUTH.PAT) {
    if (nonEmpty_(config.patToken)) props.setProperty(PROP.PAT, config.patToken.trim());
  } else if (authType === AUTH.SP) {
    if (config.clientId != null) props.setProperty(PROP.CLIENT_ID, String(config.clientId).trim());
    if (nonEmpty_(config.clientSecret)) props.setProperty(PROP.CLIENT_SECRET, config.clientSecret.trim());
  } else if (authType === AUTH.OAUTH) {
    if (config.clientId != null) props.setProperty(PROP.CLIENT_ID, String(config.clientId).trim());
    if (nonEmpty_(config.clientSecret)) props.setProperty(PROP.CLIENT_SECRET, config.clientSecret.trim());
    // Credentials may have changed; drop any cached OAuth token so the user
    // re-authorizes against the current client.
    if (nonEmpty_(config.clientSecret) || config.clientId != null) {
      try { getOAuthService_().reset(); } catch (err) { /* nothing cached yet */ }
    }
  }

  return { success: true, message: 'Configuration saved.' };
}

// ----------------------------------------------------------------------------
// Authentication engine
// ----------------------------------------------------------------------------

/**
 * Returns a bearer token for the Databricks REST API based on the configured
 * authentication type. Throws a descriptive Error if credentials are missing
 * or a flow fails.
 *
 * @return {string} A bearer access token.
 */
function getAccessToken() {
  var props = PropertiesService.getUserProperties();
  var authType = props.getProperty(PROP.AUTH_TYPE) || AUTH.PAT;

  switch (authType) {
    case AUTH.PAT:
      var pat = props.getProperty(PROP.PAT);
      if (!pat) throw new Error('No PAT token saved. Open "Setup Connection" and save one.');
      return pat;

    case AUTH.SP:
      return getClientCredentialsToken_();

    case AUTH.OAUTH:
      var service = getOAuthService_();
      if (!service.hasAccess()) {
        throw new Error('Not authorized with Databricks OAuth. Open "Setup Connection" and click "Authorize with Databricks".');
      }
      return service.getAccessToken();

    default:
      throw new Error('Unknown authentication type: ' + authType);
  }
}

/**
 * Service Principal (M2M) client-credentials flow. Tokens are cached per user
 * until shortly before they expire to avoid a token request on every sync.
 *
 * @return {string} An access token.
 */
function getClientCredentialsToken_() {
  var props = PropertiesService.getUserProperties();
  var hostname = props.getProperty(PROP.HOSTNAME);
  var clientId = props.getProperty(PROP.CLIENT_ID);
  var clientSecret = props.getProperty(PROP.CLIENT_SECRET);

  if (!hostname) throw new Error('Server Hostname is not configured.');
  if (!clientId || !clientSecret) {
    throw new Error('Service Principal requires both Client ID and Client Secret.');
  }

  var cache = CacheService.getUserCache();
  var cacheKey = 'db_m2m_' + Utilities.base64EncodeWebSafe(hostname + '|' + clientId);
  var cached = cache.get(cacheKey);
  if (cached) return cached;

  var url = 'https://' + hostname + '/oidc/v1/token';
  var options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: {
      Authorization: 'Basic ' + Utilities.base64Encode(clientId + ':' + clientSecret)
    },
    payload: { grant_type: 'client_credentials', scope: DB_SCOPE },
    muteHttpExceptions: true
  };

  var body = fetchJson_(url, options, 'Service Principal token request');
  if (!body.access_token) {
    throw new Error('Token endpoint did not return an access_token: ' +
      (body.error_description || body.error || 'unknown error'));
  }

  // Cache slightly ahead of real expiry; CacheService max TTL is 6 hours.
  var ttl = Math.max(60, Math.min((parseInt(body.expires_in, 10) || 3600) - 60, 21600));
  cache.put(cacheKey, body.access_token, ttl);
  return body.access_token;
}

/**
 * Builds the apps-script-oauth2 service for the U2M authorization-code flow.
 * @return {OAuth2.Service}
 */
function getOAuthService_() {
  var props = PropertiesService.getUserProperties();
  var hostname = props.getProperty(PROP.HOSTNAME);
  var clientId = props.getProperty(PROP.CLIENT_ID);
  var clientSecret = props.getProperty(PROP.CLIENT_SECRET);

  if (!hostname) throw new Error('Server Hostname is not configured.');

  return OAuth2.createService('databricks')
    .setAuthorizationBaseUrl('https://' + hostname + '/oidc/v1/authorize')
    .setTokenUrl('https://' + hostname + '/oidc/v1/token')
    .setClientId(clientId)
    .setClientSecret(clientSecret)
    .setScope(DB_SCOPE)
    .setCallbackFunction('authCallback')
    .setPropertyStore(PropertiesService.getUserProperties())
    .setCache(CacheService.getUserCache())
    // Databricks expects the confidential-client secret in the Authorization
    // header on the token exchange.
    .setTokenHeaders({
      Authorization: 'Basic ' + Utilities.base64Encode((clientId || '') + ':' + (clientSecret || ''))
    });
}

/**
 * OAuth redirect handler. Databricks redirects here after the user consents.
 * @param {Object} request The callback request from the OAuth2 library.
 * @return {HtmlOutput} A small page telling the user to return to the sheet.
 */
function authCallback(request) {
  var service = getOAuthService_();
  var authorized = service.handleCallback(request);
  var message = authorized
    ? 'Success! You are connected to Databricks. Close this tab and return to your sheet.'
    : 'Authorization was denied. Close this tab and try again from "Setup Connection".';
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;padding:24px;">' +
    '<h3>' + (authorized ? 'Connected' : 'Not connected') + '</h3><p>' + message + '</p>' +
    '</body></html>');
}

/**
 * Reports OAuth authorization status for the sidebar.
 * @param {string} authType The current auth type.
 * @return {Object} { authorized, authorizationUrl, redirectUri }
 */
function getOAuthStatus_(authType) {
  if (authType !== AUTH.OAUTH) {
    return { authorized: false, authorizationUrl: null, redirectUri: null };
  }

  // The redirect URL depends only on this script's id, not on the hostname or
  // client id. Surface it unconditionally so the user can register it in their
  // Databricks OAuth app *before* they have a Client ID to enter.
  var redirectUri = getRedirectUri_();

  var props = PropertiesService.getUserProperties();
  if (!props.getProperty(PROP.HOSTNAME) || !props.getProperty(PROP.CLIENT_ID)) {
    // Not enough info to build the authorization URL yet, but the redirect URL
    // is still known.
    return { authorized: false, authorizationUrl: null, redirectUri: redirectUri };
  }
  try {
    var service = getOAuthService_();
    return {
      authorized: service.hasAccess(),
      authorizationUrl: service.hasAccess() ? null : service.getAuthorizationUrl(),
      redirectUri: service.getRedirectUri() || redirectUri
    };
  } catch (err) {
    return { authorized: false, authorizationUrl: null, redirectUri: redirectUri };
  }
}

/**
 * Builds the OAuth redirect URL for this script. This is the same value the
 * apps-script-oauth2 library uses, but derived directly from the script id so
 * it is available without a fully-configured service.
 * @return {string} e.g. https://script.google.com/macros/d/<SCRIPT_ID>/usercallback
 */
function getRedirectUri_() {
  return 'https://script.google.com/macros/d/' + ScriptApp.getScriptId() + '/usercallback';
}

/** Clears any stored OAuth token so the user can re-authorize. Callable from UI. */
function resetOAuth() {
  try {
    getOAuthService_().reset();
    safeToast_('Databricks OAuth authorization cleared.');
  } catch (err) {
    safeToast_('Nothing to reset.');
  }
}

// ----------------------------------------------------------------------------
// Data sync
// ----------------------------------------------------------------------------

/**
 * Main sync entry point (menu item "Run Manual Sync" and the sidebar "Sync Now"
 * button). Resolves the SQL query for the active sheet, runs it against the
 * configured warehouse, and writes the result starting at A1.
 *
 * @return {Object} { success, sheetName, rowCount, columnCount, query }
 */
function syncDatabricksData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var sheetName = sheet.getName();

  try {
    var props = PropertiesService.getUserProperties();
    var hostname = props.getProperty(PROP.HOSTNAME);
    var httpPath = props.getProperty(PROP.HTTP_PATH);

    if (!hostname || !httpPath) {
      throw new Error('Databricks connection is not configured. Use "Setup Connection" first.');
    }

    var warehouseId = parseWarehouseId_(httpPath);
    var query = resolveQuery_(ss, sheetName);

    safeToast_('Running query against Databricks…', 'Databricks Sync', 10);

    var token = getAccessToken();
    var result = executeStatement_(hostname, token, query, warehouseId);

    writeResultToSheet_(sheet, result);

    var msg = result.rows.length === 0
      ? 'Query returned no rows.'
      : 'Synced ' + result.rows.length + ' row(s) × ' + result.headers.length + ' column(s).';
    safeToast_(msg, 'Databricks Sync', 6);

    return {
      success: true,
      sheetName: sheetName,
      rowCount: result.rows.length,
      columnCount: result.headers.length,
      query: query
    };
  } catch (err) {
    var message = err && err.message ? err.message : String(err);
    safeToast_('Sync failed: ' + message, 'Databricks Sync', 10);
    // Re-throw so the sidebar's failure handler can surface the error too.
    throw new Error(message);
  }
}

/**
 * Determines the SQL query for a sheet:
 *   1. If a "Databricks_Settings" sheet exists, look for the active sheet's
 *      name in column A and use the query in column B.
 *   2. Otherwise fall back to `SELECT * FROM <sheetName>`.
 *
 * @param {Spreadsheet} ss   The active spreadsheet.
 * @param {string} sheetName The active sheet name.
 * @return {string} The SQL query to execute.
 */
function resolveQuery_(ss, sheetName) {
  var settings = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (settings && settings.getLastRow() > 0) {
    var values = settings.getRange(1, 1, settings.getLastRow(), 2).getValues();
    for (var i = 0; i < values.length; i++) {
      var key = String(values[i][0]).trim();
      var customQuery = String(values[i][1]).trim();
      if (key === sheetName && customQuery) {
        return customQuery;
      }
    }
  }
  return 'SELECT * FROM ' + sheetName;
}

/**
 * Executes a SQL statement via the Databricks SQL Statement Execution API,
 * polling until it completes, and returns the columns and rows. Handles result
 * chunking for large result sets.
 *
 * @param {string} hostname    Workspace hostname (no scheme).
 * @param {string} token       Bearer token.
 * @param {string} sql         The SQL statement.
 * @param {string} warehouseId Target warehouse id.
 * @return {Object} { headers: string[], rows: Array<Array> }
 */
function executeStatement_(hostname, token, sql, warehouseId) {
  var base = 'https://' + hostname + '/api/2.0/sql/statements/';
  var authHeader = { Authorization: 'Bearer ' + token };

  var payload = {
    statement: sql,
    warehouse_id: warehouseId,
    wait_timeout: '30s',
    on_wait_timeout: 'CONTINUE',
    disposition: 'INLINE',
    format: 'JSON_ARRAY'
  };

  var body = fetchJson_(base, {
    method: 'post',
    contentType: 'application/json',
    headers: authHeader,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  }, 'SQL statement execution');

  var statementId = body.statement_id;
  var state = body.status && body.status.state;

  // Poll until the statement reaches a terminal state.
  var waited = 0;
  while (state === 'PENDING' || state === 'RUNNING') {
    if (waited >= STATEMENT_TIMEOUT_MS) {
      cancelStatement_(base, statementId, authHeader);
      throw new Error('Query timed out after ' + Math.round(STATEMENT_TIMEOUT_MS / 1000) + 's.');
    }
    Utilities.sleep(STATEMENT_POLL_MS);
    waited += STATEMENT_POLL_MS;
    body = fetchJson_(base + statementId, {
      method: 'get',
      headers: authHeader,
      muteHttpExceptions: true
    }, 'SQL statement status');
    state = body.status && body.status.state;
  }

  if (state !== 'SUCCEEDED') {
    var errMsg = (body.status && body.status.error && body.status.error.message) || 'unknown error';
    throw new Error('Query did not succeed (state: ' + state + '): ' + errMsg);
  }

  var columns = (body.manifest && body.manifest.schema && body.manifest.schema.columns) || [];
  var headers = columns.map(function (c) { return c.name; });

  // Collect rows across all chunks.
  var rows = [];
  var result = body.result || {};
  if (result.data_array) rows = rows.concat(result.data_array);

  var nextLink = result.next_chunk_internal_link;
  while (nextLink) {
    var chunk = fetchJson_('https://' + hostname + nextLink, {
      method: 'get',
      headers: authHeader,
      muteHttpExceptions: true
    }, 'SQL result chunk');
    if (chunk.data_array) rows = rows.concat(chunk.data_array);
    nextLink = chunk.next_chunk_internal_link;
  }

  return { headers: headers, rows: rows };
}

/** Best-effort cancel of a long-running statement. */
function cancelStatement_(base, statementId, authHeader) {
  if (!statementId) return;
  try {
    UrlFetchApp.fetch(base + statementId + '/cancel', {
      method: 'post',
      headers: authHeader,
      muteHttpExceptions: true
    });
  } catch (err) { /* ignore */ }
}

/**
 * Clears the sheet and writes headers (row 1) + data rows starting at A1.
 * Null values are written as empty cells; ragged rows are padded to the header
 * width so setValues() receives a rectangular array.
 *
 * @param {Sheet} sheet          The target sheet.
 * @param {Object} result        { headers, rows } from executeStatement_.
 */
function writeResultToSheet_(sheet, result) {
  sheet.clearContents();

  var headers = result.headers || [];
  if (headers.length === 0) {
    // No schema returned (e.g. a DDL/DML statement). Nothing to write.
    return;
  }

  var width = headers.length;
  var output = [headers.slice()];

  var rows = result.rows || [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || [];
    var normalized = new Array(width);
    for (var c = 0; c < width; c++) {
      var cell = row[c];
      normalized[c] = (cell === null || cell === undefined) ? '' : cell;
    }
    output.push(normalized);
  }

  sheet.getRange(1, 1, output.length, width).setValues(output);
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Extracts the warehouse id from an HTTP Path such as
 * "sql/1.0/warehouses/abc123" -> "abc123". Accepts an optional leading slash.
 *
 * @param {string} httpPath The configured HTTP Path.
 * @return {string} The warehouse id.
 */
function parseWarehouseId_(httpPath) {
  var match = String(httpPath).match(/warehouses\/([^\/\s?]+)/);
  if (match && match[1]) return match[1];

  // Fallback: last non-empty path segment.
  var parts = String(httpPath).split('/').filter(function (p) { return p.trim(); });
  if (parts.length) return parts[parts.length - 1];

  throw new Error('Could not parse a warehouse id from HTTP Path: "' + httpPath + '".');
}

/**
 * Fetches a URL and parses the JSON body, throwing a descriptive error for
 * non-2xx responses (with special handling for auth failures).
 *
 * @param {string} url      Request URL.
 * @param {Object} options  UrlFetchApp options (must set muteHttpExceptions).
 * @param {string} context  Human-readable label for error messages.
 * @return {Object} Parsed JSON body.
 */
function fetchJson_(url, options, context) {
  var response;
  try {
    response = UrlFetchApp.fetch(url, options);
  } catch (err) {
    throw new Error(context + ' failed (network error): ' + (err && err.message ? err.message : err));
  }

  var code = response.getResponseCode();
  var text = response.getContentText();
  var body = {};
  if (text) {
    try { body = JSON.parse(text); } catch (err) { body = { raw: text }; }
  }

  if (code === 401 || code === 403) {
    throw new Error(context + ' — authentication failed (HTTP ' + code + '). ' +
      'Your token or credentials may be expired or lack access. ' +
      (body.message || body.error_description || body.error || ''));
  }
  if (code >= 400) {
    throw new Error(context + ' — HTTP ' + code + ': ' +
      (body.message || body.error_description || body.error || text || 'no response body'));
  }

  return body;
}

/**
 * Normalizes a hostname: strips scheme, any path, and trailing slashes.
 * "https://adb-123.net/" -> "adb-123.net"
 *
 * @param {string} host Raw hostname input.
 * @return {string} Normalized hostname.
 */
function normalizeHost_(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\/+$/, '');
}

/** True when a value is a non-empty (trimmed) string. */
function nonEmpty_(v) {
  return v != null && String(v).trim() !== '';
}

/** Shows a spreadsheet toast, ignoring failures (e.g. no UI context). */
function safeToast_(message, title, seconds) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(message, title || 'Databricks Sync', seconds || 5);
  } catch (err) { /* no active spreadsheet / UI */ }
}
