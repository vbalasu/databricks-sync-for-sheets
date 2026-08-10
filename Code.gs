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
  CLIENT_SECRET: 'DB_CLIENT_SECRET',
  // Backend selection + Lakebase (Data API) configuration.
  BACKEND_TYPE: 'DB_BACKEND_TYPE',
  LAKEBASE_ENDPOINT: 'DB_LAKEBASE_ENDPOINT',
  LAKEBASE_SCHEMA: 'DB_LAKEBASE_SCHEMA',
  LAKEBASE_PK: 'DB_LAKEBASE_PK'
};

/** Supported authentication types (stored in DB_AUTH_TYPE). */
var AUTH = {
  PAT: 'pat',    // Personal Access Token
  SP: 'sp',      // Service Principal / machine-to-machine (client credentials)
  OAUTH: 'oauth' // User-to-machine OAuth (authorization code)
};

/**
 * Databricks backend the sheet talks to (stored in DB_BACKEND_TYPE).
 *   WAREHOUSE — Delta tables via the SQL Statement Execution API (HTTPS).
 *   LAKEBASE  — managed Postgres via the Lakebase Data API (PostgREST, HTTPS).
 * Apps Script's UrlFetchApp is HTTPS-only, so Lakebase is reached through its
 * Data API rather than the Postgres wire protocol.
 */
var BACKEND = {
  WAREHOUSE: 'warehouse',
  LAKEBASE: 'lakebase'
};

/** Writeback modes for writeToDatabricks(). */
var WRITE_MODE = {
  APPEND: 'append',   // add sheet rows as new table rows
  REPLACE: 'replace'  // overwrite the whole table from the sheet
};

/** Read modes for readFromDatabricks(). */
var READ_MODE = {
  OVERWRITE: 'overwrite', // clear the sheet, then write (historical behavior)
  APPEND: 'append'        // append rows below the sheet's existing content
};

/** Name of the sheet that maps sheet names -> custom SQL queries. */
var SETTINGS_SHEET_NAME = 'Databricks_Settings';

/** OAuth scope requested for all Databricks auth flows. */
var DB_SCOPE = 'all-apis';

/** How long to keep polling a running statement before giving up (ms). */
var STATEMENT_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes
/** Delay between statement status polls (ms). */
var STATEMENT_POLL_MS = 2000;

/**
 * Writeback batching + runtime guards. The SQL Statement Execution API caps
 * statement text at ~16 MiB; Apps Script hard-limits execution at 6 minutes.
 */
var WRITE_MAX_ROWS_PER_BATCH = 500;         // rows per INSERT / POST batch
var WRITE_MAX_STATEMENT_BYTES = 8 * 1024 * 1024; // stay well under the 16 MiB cap
var WRITE_RUNTIME_BUDGET_MS = 5 * 60 * 1000;     // stop before the 6-min hard limit

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
    .addItem('Write Active Sheet → Databricks (Append)…', 'promptAppendActiveSheet')
    .addItem('Write Active Sheet → Databricks (Replace)…', 'promptReplaceActiveSheet')
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
    // Backend selection + Lakebase configuration.
    backendType: props.getProperty(PROP.BACKEND_TYPE) || BACKEND.WAREHOUSE,
    lakebaseEndpoint: props.getProperty(PROP.LAKEBASE_ENDPOINT) || '',
    lakebaseSchema: props.getProperty(PROP.LAKEBASE_SCHEMA) || 'public',
    lakebasePk: props.getProperty(PROP.LAKEBASE_PK) || '',
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
  var backendType = (config.backendType || BACKEND.WAREHOUSE).trim();
  var lakebaseEndpoint = normalizeEndpoint_(config.lakebaseEndpoint);
  var lakebaseSchema = (config.lakebaseSchema || '').trim() || 'public';
  var lakebasePk = (config.lakebasePk || '').trim();

  if (!hostname) throw new Error('Server Hostname is required.');
  if ([AUTH.PAT, AUTH.SP, AUTH.OAUTH].indexOf(authType) === -1) {
    throw new Error('Unknown authentication type: ' + authType);
  }
  if ([BACKEND.WAREHOUSE, BACKEND.LAKEBASE].indexOf(backendType) === -1) {
    throw new Error('Unknown backend type: ' + backendType);
  }
  // Required fields differ by backend: the warehouse needs an HTTP Path (to
  // parse the warehouse id); Lakebase needs its Data API REST endpoint.
  if (backendType === BACKEND.WAREHOUSE && !httpPath) {
    throw new Error('HTTP Path is required for the SQL Warehouse backend.');
  }
  if (backendType === BACKEND.LAKEBASE && !lakebaseEndpoint) {
    throw new Error('Lakebase REST Endpoint is required for the Lakebase backend.');
  }

  props.setProperty(PROP.HOSTNAME, hostname);
  props.setProperty(PROP.HTTP_PATH, httpPath);
  props.setProperty(PROP.AUTH_TYPE, authType);
  props.setProperty(PROP.BACKEND_TYPE, backendType);
  props.setProperty(PROP.LAKEBASE_ENDPOINT, lakebaseEndpoint);
  props.setProperty(PROP.LAKEBASE_SCHEMA, lakebaseSchema);
  props.setProperty(PROP.LAKEBASE_PK, lakebasePk);

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
 * Menu/sidebar sync handler ("Run Manual Sync" / "Sync Now"). Reads the active
 * sheet's resolved source from the configured backend and overwrites the sheet.
 * Kept as a thin wrapper over readFromDatabricks() for backward compatibility.
 *
 * @return {Object} { success, sheetName, rowCount, columnCount, source }
 */
function syncDatabricksData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var source = resolveSource_(ss, sheet.getName());
  return readFromDatabricks(source, sheet, READ_MODE.OVERWRITE);
}

/**
 * Reads from Databricks into a sheet. Backend-agnostic: dispatches to the SQL
 * Warehouse or Lakebase Data API backend based on the saved configuration.
 *
 * @param {Object|string} sourceTable A resolved source ({kind, value}) or, as a
 *        convenience, a plain string. For the warehouse backend a string is
 *        treated as raw SQL if it looks like a query, else as a table name; for
 *        Lakebase it is always a table name.
 * @param {Sheet|string} targetSheet  A Sheet or the name of a sheet in the
 *        active spreadsheet.
 * @param {string=} mode  READ_MODE.OVERWRITE (default) clears the sheet first;
 *        READ_MODE.APPEND writes below existing content.
 * @return {Object} { success, sheetName, rowCount, columnCount, source }
 */
function readFromDatabricks(sourceTable, targetSheet, mode) {
  var sheet = resolveSheet_(targetSheet);
  var sheetName = sheet.getName();
  mode = mode || READ_MODE.OVERWRITE;

  try {
    var source = normalizeSource_(sourceTable);
    var backend = getBackend_();

    safeToast_('Reading from Databricks…', 'Databricks Sync', 10);

    var result = backend.readTable(source);
    writeResultToSheet_(sheet, result, mode);

    var msg = result.rows.length === 0
      ? 'Query returned no rows.'
      : 'Synced ' + result.rows.length + ' row(s) × ' + result.headers.length + ' column(s).';
    safeToast_(msg, 'Databricks Sync', 6);

    return {
      success: true,
      sheetName: sheetName,
      rowCount: result.rows.length,
      columnCount: result.headers.length,
      source: source.value
    };
  } catch (err) {
    var message = err && err.message ? err.message : String(err);
    safeToast_('Read failed: ' + message, 'Databricks Sync', 10);
    throw new Error(message);
  }
}

/**
 * Writes a sheet's contents back to a Databricks table. Row 1 of the sheet
 * holds the column names; rows 2..N are the data. Backend-agnostic.
 *
 * @param {Sheet|string} sourceSheet A Sheet or the name of a sheet.
 * @param {string} targetTable       Fully-qualified table (warehouse:
 *        catalog.schema.table) or table name (Lakebase).
 * @param {string} mode              WRITE_MODE.APPEND or WRITE_MODE.REPLACE.
 * @return {Object} { success, sheetName, targetTable, rowCount, columnCount, batches, mode }
 */
function writeToDatabricks(sourceSheet, targetTable, mode) {
  var sheet = resolveSheet_(sourceSheet);
  var sheetName = sheet.getName();

  try {
    if (!nonEmpty_(targetTable)) throw new Error('A target table is required.');
    if (mode !== WRITE_MODE.APPEND && mode !== WRITE_MODE.REPLACE) {
      throw new Error('Write mode must be "append" or "replace".');
    }

    var table = readSheetAsTable_(sheet); // { headers, rows } — throws if empty
    var backend = getBackend_();

    safeToast_('Writing ' + table.rows.length + ' row(s) to Databricks…', 'Databricks Sync', 10);

    var outcome = (mode === WRITE_MODE.REPLACE)
      ? backend.replaceTable(String(targetTable).trim(), table)
      : backend.appendRows(String(targetTable).trim(), table);

    var msg = (mode === WRITE_MODE.REPLACE ? 'Replaced ' : 'Appended ') +
      table.rows.length + ' row(s) in ' + targetTable + '.';
    safeToast_(msg, 'Databricks Sync', 6);

    return {
      success: true,
      sheetName: sheetName,
      targetTable: String(targetTable).trim(),
      rowCount: table.rows.length,
      columnCount: table.headers.length,
      batches: outcome && outcome.batches,
      mode: mode
    };
  } catch (err) {
    var message = err && err.message ? err.message : String(err);
    safeToast_('Write failed: ' + message, 'Databricks Sync', 10);
    throw new Error(message);
  }
}

/** Sidebar-callable: write the active sheet to a table. */
function writeActiveSheetToDatabricks(targetTable, mode) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  return writeToDatabricks(sheet, targetTable, mode);
}

/** Menu handler: prompt for a table name, then append the active sheet. */
function promptAppendActiveSheet() {
  promptWriteActiveSheet_(WRITE_MODE.APPEND);
}

/** Menu handler: prompt for a table name (with confirmation), then replace. */
function promptReplaceActiveSheet() {
  promptWriteActiveSheet_(WRITE_MODE.REPLACE);
}

/**
 * Shared prompt flow for the writeback menu items. Replace is destructive, so
 * it requires the user to re-type the table name to confirm.
 * @param {string} mode WRITE_MODE.APPEND or WRITE_MODE.REPLACE.
 */
function promptWriteActiveSheet_(mode) {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var verb = (mode === WRITE_MODE.REPLACE) ? 'Replace' : 'Append';

  var res = ui.prompt(
    verb + ' — target table',
    'Table to ' + verb.toLowerCase() + ' from sheet "' + sheet.getName() + '":',
    ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  var table = res.getResponseText().trim();
  if (!table) { ui.alert('No table entered.'); return; }

  if (mode === WRITE_MODE.REPLACE) {
    var confirm = ui.prompt(
      'Confirm destructive replace',
      'This OVERWRITES ALL rows in "' + table + '". Re-type the table name to confirm:',
      ui.ButtonSet.OK_CANCEL);
    if (confirm.getSelectedButton() !== ui.Button.OK) return;
    if (confirm.getResponseText().trim() !== table) {
      ui.alert('Table name did not match. Aborted.');
      return;
    }
  }

  writeToDatabricks(sheet, table, mode);
}

// ----------------------------------------------------------------------------
// Backend abstraction
// ----------------------------------------------------------------------------

/**
 * Returns a backend object exposing a uniform read/write interface:
 *   readTable(source)                    -> { headers, rows }
 *   appendRows(table, { headers, rows }) -> { batches }
 *   replaceTable(table, { headers, rows })-> { batches }
 *
 * The bearer token from getAccessToken() (PAT / SP / U2M OAuth) is shared by
 * both backends.
 *
 * @return {Object} A backend implementing the interface above.
 */
function getBackend_() {
  var props = PropertiesService.getUserProperties();
  var hostname = props.getProperty(PROP.HOSTNAME);
  if (!hostname) {
    throw new Error('Databricks connection is not configured. Use "Setup Connection" first.');
  }
  var type = props.getProperty(PROP.BACKEND_TYPE) || BACKEND.WAREHOUSE;
  var token = getAccessToken();

  return type === BACKEND.LAKEBASE
    ? makeLakebaseBackend_(props, hostname, token)
    : makeWarehouseBackend_(props, hostname, token);
}

/**
 * SQL Warehouse backend: reads via SELECT and writes via parameterized
 * INSERT / INSERT OVERWRITE through the SQL Statement Execution API.
 *
 * @param {Properties} props   User properties.
 * @param {string} hostname    Workspace hostname.
 * @param {string} token       Bearer token.
 * @return {Object} Backend interface.
 */
function makeWarehouseBackend_(props, hostname, token) {
  var httpPath = props.getProperty(PROP.HTTP_PATH);
  if (!httpPath) throw new Error('HTTP Path is not configured for the SQL Warehouse backend.');
  var warehouseId = parseWarehouseId_(httpPath);

  function run(sql, params) {
    return executeStatement_(hostname, token, sql, warehouseId, params);
  }

  return {
    readTable: function (source) {
      var sql = (source.kind === 'sql') ? source.value : 'SELECT * FROM ' + source.value;
      return run(sql);
    },

    appendRows: function (table, data) {
      var qualified = quoteQualifiedName_(table);
      var cols = validateHeaders_(data.headers).map(quoteIdent_).join(', ');
      var batches = writeInBatches_(data.rows, function (batch) {
        var built = buildInsertValues_(batch, data.headers);
        run('INSERT INTO ' + qualified + ' (' + cols + ') VALUES ' + built.tuples, built.params);
      });
      return { batches: batches };
    },

    replaceTable: function (table, data) {
      var qualified = quoteQualifiedName_(table);
      var headers = validateHeaders_(data.headers);
      var cols = headers.map(quoteIdent_).join(', ');
      // First batch replaces the table contents atomically (INSERT OVERWRITE);
      // subsequent batches append. Empty sheet -> just empty the table.
      if (data.rows.length === 0) {
        run('TRUNCATE TABLE ' + qualified);
        return { batches: 1 };
      }
      var first = true;
      var batches = writeInBatches_(data.rows, function (batch) {
        var built = buildInsertValues_(batch, headers);
        var verb = first ? 'INSERT OVERWRITE ' : 'INSERT INTO ';
        run(verb + qualified + ' (' + cols + ') VALUES ' + built.tuples, built.params);
        first = false;
      });
      return { batches: batches };
    }
  };
}

/**
 * Lakebase backend over the Data API (PostgREST, HTTPS). Reads return an array
 * of objects; writes POST arrays of objects. Full replace deletes existing rows
 * first, which PostgREST only allows with a filter (needs a configured PK).
 *
 * @param {Properties} props   User properties.
 * @param {string} hostname    Workspace hostname (used only for error hints).
 * @param {string} token       Bearer token (Databricks OAuth).
 * @return {Object} Backend interface.
 */
function makeLakebaseBackend_(props, hostname, token) {
  var endpoint = props.getProperty(PROP.LAKEBASE_ENDPOINT);
  if (!endpoint) throw new Error('Lakebase REST Endpoint is not configured.');
  var schema = props.getProperty(PROP.LAKEBASE_SCHEMA) || 'public';
  var pk = props.getProperty(PROP.LAKEBASE_PK) || '';
  var authType = props.getProperty(PROP.AUTH_TYPE) || AUTH.PAT;
  var authHeader = { Authorization: 'Bearer ' + token };

  // A PAT is a workspace token, not the Databricks-identity OAuth token the
  // Data API's authenticator role expects; warn early with a clear hint.
  if (authType === AUTH.PAT) {
    Logger.log('Lakebase Data API with a PAT may be rejected; Service Principal or User OAuth is recommended.');
  }

  function urlFor(table) {
    return endpoint.replace(/\/+$/, '') + '/' + encodeURIComponent(schema) +
      '/' + encodeURIComponent(table);
  }

  return {
    readTable: function (source) {
      if (source.kind === 'sql') {
        throw new Error('The Lakebase Data API reads whole tables, not custom SQL. ' +
          'Remove this sheet\'s Databricks_Settings query, or use the SQL Warehouse backend.');
      }
      var arr = fetchJson_(urlFor(source.value) + '?select=*', {
        method: 'get',
        headers: authHeader,
        muteHttpExceptions: true
      }, 'Lakebase read');
      return normalizeObjects_(arr);
    },

    appendRows: function (table, data) {
      validateHeaders_(data.headers);
      var url = urlFor(table);
      var batches = writeInBatches_(data.rows, function (batch) {
        var objs = rowsToObjects_(data.headers, batch);
        fetchJson_(url, {
          method: 'post',
          contentType: 'application/json',
          headers: authHeader,
          payload: JSON.stringify(objs),
          muteHttpExceptions: true
        }, 'Lakebase append');
      });
      return { batches: batches };
    },

    replaceTable: function (table, data) {
      validateHeaders_(data.headers);
      if (!pk) {
        throw new Error('Replace on Lakebase requires a Primary Key column so all ' +
          'rows can be safely deleted (PostgREST blocks unfiltered bulk delete). ' +
          'Set "Primary Key column" in Setup Connection, or use Append.');
      }
      // Delete every row via an always-true filter on the PK, then append.
      var url = urlFor(table);
      fetchJson_(url + '?' + encodeURIComponent(pk) + '=not.is.null', {
        method: 'delete',
        headers: authHeader,
        muteHttpExceptions: true
      }, 'Lakebase replace (delete)');
      // NULL-PK rows are not matched by not.is.null; delete them separately.
      fetchJson_(url + '?' + encodeURIComponent(pk) + '=is.null', {
        method: 'delete',
        headers: authHeader,
        muteHttpExceptions: true
      }, 'Lakebase replace (delete nulls)');

      var batches = writeInBatches_(data.rows, function (batch) {
        var objs = rowsToObjects_(data.headers, batch);
        fetchJson_(url, {
          method: 'post',
          contentType: 'application/json',
          headers: authHeader,
          payload: JSON.stringify(objs),
          muteHttpExceptions: true
        }, 'Lakebase replace (insert)');
      });
      return { batches: batches };
    }
  };
}

// ----------------------------------------------------------------------------
// Writeback helpers
// ----------------------------------------------------------------------------

/**
 * Reads a sheet into { headers, rows }. Row 1 is the header; the rest are data.
 * Throws a descriptive error for an empty sheet or a missing header row.
 *
 * @param {Sheet} sheet The source sheet.
 * @return {Object} { headers: string[], rows: Array<Array> }
 */
function readSheetAsTable_(sheet) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (!values.length || (values.length === 1 && isBlankRow_(values[0]))) {
    throw new Error('Sheet "' + sheet.getName() + '" is empty — nothing to write.');
  }
  var headers = values[0].map(function (h) { return String(h).trim(); });
  if (isBlankRow_(headers)) {
    throw new Error('Row 1 must contain column names.');
  }
  var rows = values.slice(1).filter(function (r) { return !isBlankRow_(r); });
  return { headers: headers, rows: rows };
}

/** True when every cell in a row is blank. */
function isBlankRow_(row) {
  return row.every(function (c) { return c === '' || c === null || c === undefined; });
}

/**
 * Neutralizes spreadsheet formula injection (CWE-1236) in values read from
 * Databricks before they are written to a sheet. A string beginning with one of
 * the formula-trigger characters ( = + - @ ) — or a leading tab/carriage return
 * that Sheets strips before parsing — is coerced to a literal by prefixing a
 * single quote, so it is displayed verbatim instead of being evaluated.
 *
 * Non-strings (numbers, booleans, Dates from native-typed backends such as
 * Lakebase) are returned unchanged: only strings can carry a formula. Numeric
 * strings like "-5" or "+441234" (SQL Warehouse returns all values as strings)
 * are also left unchanged so legitimate signed numbers still land as numbers.
 *
 * @param {*} cell A cell value from a backend read.
 * @return {*} The value, escaped to a literal string if it would trigger a formula.
 */
function escapeCellForSheet_(cell) {
  if (typeof cell !== 'string' || cell.length === 0) return cell;
  var first = cell.charAt(0);
  if (first === '=' || first === '+' || first === '-' || first === '@' ||
      first === '\t' || first === '\r') {
    // Leave plain numeric strings (incl. signed) as-is so they parse as numbers.
    if ((first === '+' || first === '-') && /^[+-]?(\d+\.?\d*|\.\d+)$/.test(cell)) {
      return cell;
    }
    return "'" + cell;
  }
  return cell;
}

/**
 * Validates header names for use as SQL/JSON identifiers: non-empty and unique.
 * @param {string[]} headers Column names from row 1.
 * @return {string[]} The same headers (trimmed) if valid.
 */
function validateHeaders_(headers) {
  var seen = {};
  headers.forEach(function (h) {
    var name = String(h).trim();
    if (!name) throw new Error('Empty column name in the header row.');
    var key = name.toLowerCase();
    if (seen[key]) throw new Error('Duplicate column name: "' + name + '".');
    seen[key] = true;
  });
  return headers.map(function (h) { return String(h).trim(); });
}

/**
 * Builds the VALUES clause and named parameters for one batch of rows.
 * Uses :p_<row>_<col> markers so cell values never enter the SQL text.
 *
 * @param {Array<Array>} batch   Rows in this batch.
 * @param {string[]} headers     Column names (defines width/order).
 * @return {Object} { tuples: string, params: Array }
 */
function buildInsertValues_(batch, headers) {
  var params = [];
  var tuples = batch.map(function (row, r) {
    var markers = headers.map(function (_, c) {
      var name = 'p_' + r + '_' + c;
      params.push(encodeParam_(name, row[c]));
      return ':' + name;
    });
    return '(' + markers.join(', ') + ')';
  });
  return { tuples: tuples.join(', '), params: params };
}

/**
 * Encodes a cell value as a typed SQL statement parameter. A null value (empty
 * cell) is sent with no type, which the API binds as SQL NULL.
 *
 * @param {string} name Parameter name (without the leading colon).
 * @param {*} v         Cell value.
 * @return {Object} { name, value, type? }
 */
function encodeParam_(name, v) {
  if (v === null || v === undefined || v === '') return { name: name, value: null };
  if (typeof v === 'boolean') return { name: name, value: String(v), type: 'BOOLEAN' };
  if (typeof v === 'number') {
    return Number.isInteger(v)
      ? { name: name, value: String(v), type: 'BIGINT' }
      : { name: name, value: String(v), type: 'DOUBLE' };
  }
  if (v instanceof Date) return { name: name, value: v.toISOString(), type: 'TIMESTAMP' };
  return { name: name, value: String(v), type: 'STRING' };
}

/**
 * Splits rows into batches and invokes writeBatch(batch) for each, respecting
 * the per-batch row cap, a statement byte-size estimate, and the Apps Script
 * runtime budget. Returns the number of batches written.
 *
 * @param {Array<Array>} rows        All rows to write.
 * @param {function(Array<Array>)} writeBatch  Writes one batch (throws on error).
 * @return {number} Batches written.
 */
function writeInBatches_(rows, writeBatch) {
  var start = Date.now();
  var batches = 0;
  var i = 0;
  while (i < rows.length) {
    if (Date.now() - start > WRITE_RUNTIME_BUDGET_MS) {
      throw new Error('Stopped near the Apps Script time limit after ' + batches +
        ' batch(es) (~' + i + ' rows). Re-run to continue, or write fewer rows at once.');
    }
    var batch = [];
    var bytes = 0;
    while (i < rows.length && batch.length < WRITE_MAX_ROWS_PER_BATCH &&
           bytes < WRITE_MAX_STATEMENT_BYTES) {
      var row = rows[i];
      bytes += estimateRowBytes_(row);
      batch.push(row);
      i++;
    }
    writeBatch(batch);
    batches++;
  }
  return batches;
}

/** Rough byte estimate of a row's serialized values, for batch sizing. */
function estimateRowBytes_(row) {
  var n = 0;
  for (var c = 0; c < row.length; c++) {
    var v = row[c];
    n += (v === null || v === undefined) ? 4 : String(v).length + 8;
  }
  return n;
}

/**
 * Converts rows to PostgREST row objects keyed by header name. Empty cells
 * become JSON null.
 *
 * @param {string[]} headers Column names.
 * @param {Array<Array>} rows Data rows.
 * @return {Array<Object>} Row objects.
 */
function rowsToObjects_(headers, rows) {
  return rows.map(function (r) {
    var o = {};
    headers.forEach(function (h, i) {
      var v = r[i];
      o[h] = (v === '' || v === undefined) ? null : v;
    });
    return o;
  });
}

/**
 * Normalizes a PostgREST array-of-objects result into { headers, rows } so the
 * shared writeResultToSheet_ can render it. Column order comes from the first
 * row; nested objects/arrays are JSON-stringified; null becomes ''.
 *
 * @param {Array<Object>} arr Rows from the Data API.
 * @return {Object} { headers, rows }
 */
function normalizeObjects_(arr) {
  if (!arr || !arr.length) return { headers: [], rows: [] };
  var headers = Object.keys(arr[0]);
  var rows = arr.map(function (o) {
    return headers.map(function (h) {
      var v = o[h];
      if (v === null || v === undefined) return '';
      return (typeof v === 'object') ? JSON.stringify(v) : v;
    });
  });
  return { headers: headers, rows: rows };
}

/**
 * Quotes a single SQL identifier with backticks, escaping embedded backticks.
 * @param {string} name Identifier.
 * @return {string} Backtick-quoted identifier.
 */
function quoteIdent_(name) {
  return '`' + String(name).trim().replace(/`/g, '``') + '`';
}

/**
 * Quotes a possibly-qualified name (catalog.schema.table) part-by-part so each
 * segment is safely escaped. Rejects empty segments.
 * @param {string} name e.g. "cat.schema.table".
 * @return {string} e.g. "`cat`.`schema`.`table`".
 */
function quoteQualifiedName_(name) {
  var parts = String(name).trim().split('.').map(function (p) { return p.trim(); });
  if (parts.some(function (p) { return p === ''; })) {
    throw new Error('Invalid table name: "' + name + '".');
  }
  return parts.map(quoteIdent_).join('.');
}

/**
 * Resolves the read source for a sheet into a { kind, value } descriptor:
 *   { kind: 'sql',   value: '<custom SQL>' }  — a custom query from Settings.
 *   { kind: 'table', value: '<sheet name>' } — default SELECT * FROM <sheet>.
 * Reuses the Databricks_Settings convention.
 *
 * @param {Spreadsheet} ss   The active spreadsheet.
 * @param {string} sheetName The sheet name.
 * @return {Object} { kind, value }
 */
function resolveSource_(ss, sheetName) {
  var custom = resolveQuery_(ss, sheetName);
  return (custom === 'SELECT * FROM ' + sheetName)
    ? { kind: 'table', value: sheetName }
    : { kind: 'sql', value: custom };
}

/**
 * Normalizes the sourceTable argument of readFromDatabricks into { kind, value }.
 * @param {Object|string} sourceTable A descriptor or a plain string.
 * @return {Object} { kind, value }
 */
function normalizeSource_(sourceTable) {
  if (sourceTable && typeof sourceTable === 'object' && sourceTable.kind) {
    return sourceTable;
  }
  var s = String(sourceTable == null ? '' : sourceTable).trim();
  if (!s) throw new Error('A source table or query is required.');
  return /\s/.test(s) && /select/i.test(s)
    ? { kind: 'sql', value: s }
    : { kind: 'table', value: s };
}

/**
 * Resolves a Sheet from a Sheet object or a sheet name in the active
 * spreadsheet.
 * @param {Sheet|string} sheetOrName A Sheet or a sheet name.
 * @return {Sheet}
 */
function resolveSheet_(sheetOrName) {
  if (sheetOrName && typeof sheetOrName.getName === 'function') return sheetOrName;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (nonEmpty_(sheetOrName)) {
    var sheet = ss.getSheetByName(String(sheetOrName).trim());
    if (!sheet) throw new Error('No sheet named "' + sheetOrName + '".');
    return sheet;
  }
  return ss.getActiveSheet();
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
 * @param {string} hostname     Workspace hostname (no scheme).
 * @param {string} token        Bearer token.
 * @param {string} sql          The SQL statement (may contain :named markers).
 * @param {string} warehouseId  Target warehouse id.
 * @param {Array=} parameters   Optional named parameters
 *                              [{ name, value, type }] for parameterized DML.
 * @return {Object} { headers: string[], rows: Array<Array> }
 */
function executeStatement_(hostname, token, sql, warehouseId, parameters) {
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
  // Named parameters keep values out of the SQL text (no manual escaping) and
  // let the API cast them to the declared types.
  if (parameters && parameters.length) payload.parameters = parameters;

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
 * Writes a { headers, rows } result into a sheet.
 *   OVERWRITE (default) — clears the sheet, then writes headers + rows at A1.
 *   APPEND — writes rows below the sheet's existing content (headers only when
 *            the sheet is empty).
 * Null values are written as empty cells; ragged rows are padded to the header
 * width so setValues() receives a rectangular array.
 *
 * @param {Sheet} sheet    The target sheet.
 * @param {Object} result  { headers, rows } from a backend read.
 * @param {string=} mode   READ_MODE.OVERWRITE (default) or READ_MODE.APPEND.
 */
function writeResultToSheet_(sheet, result, mode) {
  mode = mode || READ_MODE.OVERWRITE;

  var headers = result.headers || [];
  if (headers.length === 0) {
    // No schema returned (e.g. a DDL/DML statement). Nothing to write.
    if (mode === READ_MODE.OVERWRITE) sheet.clearContents();
    return;
  }

  var width = headers.length;
  var rows = result.rows || [];

  var dataRows = rows.map(function (row) {
    row = row || [];
    var normalized = new Array(width);
    for (var c = 0; c < width; c++) {
      var cell = row[c];
      normalized[c] = escapeCellForSheet_((cell === null || cell === undefined) ? '' : cell);
    }
    return normalized;
  });

  if (mode === READ_MODE.APPEND && sheet.getLastRow() > 0) {
    // Append data rows only, below existing content (no header row).
    if (dataRows.length === 0) return;
    sheet.getRange(sheet.getLastRow() + 1, 1, dataRows.length, width).setValues(dataRows);
    return;
  }

  // Overwrite (or append to an empty sheet): write headers + data from A1.
  if (mode === READ_MODE.OVERWRITE) sheet.clearContents();
  var safeHeaders = headers.map(escapeCellForSheet_);
  var output = [safeHeaders].concat(dataRows);
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

/**
 * Normalizes a Lakebase Data API REST endpoint: trims whitespace, ensures an
 * https:// scheme, and strips trailing slashes. Unlike a hostname, the endpoint
 * keeps its path (the schema/table is appended to it later).
 * "rest-endpoint.example.databricks.com/" -> "https://rest-endpoint.example.databricks.com"
 *
 * @param {string} endpoint Raw endpoint input.
 * @return {string} Normalized endpoint URL, or '' if blank.
 */
function normalizeEndpoint_(endpoint) {
  if (!endpoint) return '';
  var e = String(endpoint).trim();
  if (!e) return '';
  if (!/^https?:\/\//i.test(e)) e = 'https://' + e;
  return e.replace(/\/+$/, '');
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
