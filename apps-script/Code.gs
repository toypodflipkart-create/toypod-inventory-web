/**
 * TOYPOD Inventory API for GitHub Pages frontend.
 * Professional v2: hides helper/note rows from the Box Stock Tracker payload.
 *
 * How to use:
 * 1) Open your Google Sheet.
 * 2) Extensions → Apps Script.
 * 3) Paste this file into Code.gs.
 * 4) Deploy → New deployment → Web app.
 * 5) Execute as: Me. Who has access: Anyone.
 * 6) Copy the Web App URL into config.js as API_URL.
 */

const SHEET_CONFIG = {
  skuMaster: { name: 'SKU Master', headerRow: 2 },
  dailyProduction: { name: 'Daily Production', headerRow: 3 },
  dispatch: { name: 'Dispatch', headerRow: 3 },
  returns: { name: 'Returns', headerRow: 3 },
  inventoryDashboard: { name: 'Inventory Dashboard', headerRow: 3 },
  partySalesSummary: { name: 'Party Sales Summary', headerRow: 2 },
  boxPurchaseLog: { name: 'Box Purchase Log', headerRow: 3 },
  boxStockTracker: { name: 'Box Stock Tracker', headerRow: 4 }
};

function doGet(e) {
  const payload = buildPayload_();
  const json = JSON.stringify(payload);
  const callback = e && e.parameter && e.parameter.callback;

  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function buildPayload_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventoryDashboard = readTable_(ss, SHEET_CONFIG.inventoryDashboard);
  const partySalesSummary = readTable_(ss, SHEET_CONFIG.partySalesSummary);
  const metrics = readMetrics_(ss);

  return {
    updatedAt: new Date().toISOString(),
    spreadsheetName: ss.getName(),
    metrics,
    managementMIS: metrics.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {}),
    skuMaster: readTable_(ss, SHEET_CONFIG.skuMaster),
    inventoryDashboard,
    partySalesSummary,
    dailyProduction: readTable_(ss, SHEET_CONFIG.dailyProduction),
    dispatch: readTable_(ss, SHEET_CONFIG.dispatch),
    returns: readTable_(ss, SHEET_CONFIG.returns),
    boxPurchaseLog: readTable_(ss, SHEET_CONFIG.boxPurchaseLog),
    boxStockTracker: readTable_(ss, SHEET_CONFIG.boxStockTracker)
  };
}

function readTable_(ss, config) {
  const sheet = ss.getSheetByName(config.name);
  if (!sheet) return [];

  const values = sheet.getDataRange().getDisplayValues();
  const headerIndex = config.headerRow - 1;
  const headers = values[headerIndex] || [];
  const keys = headers.map((header, index) => normalizeHeader_(header) || `col${index + 1}`);

  return values.slice(config.headerRow)
    .map((row, offset) => {
      const record = { __row: config.headerRow + offset + 1 };
      keys.forEach((key, index) => record[key] = row[index]);
      return record;
    })
    .filter((record) => keys.some((key) => String(record[key] || '').trim() !== ''))
    .filter((record) => !isHelperNoteRow_(config.name, record));
}

function isHelperNoteRow_(sheetName, record) {
  if (sheetName !== 'Box Stock Tracker') return false;

  const title = String(record.boxTypeSize || '').trim().toLowerCase();
  if (!title) return true;

  if (title.indexOf('sufficient >') !== -1) return true;
  if (title.indexOf('monitor between') !== -1) return true;
  if (title.indexOf('returns are logged') !== -1) return true;
  if (title.indexOf('out of stock = 0') !== -1) return true;

  const dataFields = [
    'openingBoxStock',
    'purchasedPurchaseLog',
    'boxesUsedSalesDispatch',
    'closingBoxStock',
    'minStock',
    'reOrderAlert',
    'totalPurchased'
  ];
  return dataFields.every((key) => String(record[key] || '').trim() === '');
}

function readMetrics_(ss) {
  const sheet = ss.getSheetByName('Management MIS');
  if (!sheet) return [];

  const values = sheet.getRange(3, 1, Math.max(sheet.getLastRow() - 2, 1), 2).getDisplayValues();
  return values
    .filter((row) => String(row[0] || '').trim() !== '')
    .map((row) => ({
      label: row[0],
      key: normalizeHeader_(row[0]),
      value: toNumberIfPossible_(row[1])
    }));
}

function normalizeHeader_(value) {
  const text = String(value || '')
    .replace(/\n/g, ' ')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toLowerCase();

  if (!text) return '';

  const parts = text.split(/\s+/).filter((part) => part !== 'all' && part !== 'time');
  if (!parts.length) return '';

  return parts[0] + parts.slice(1).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function toNumberIfPossible_(value) {
  const text = String(value || '').replace(/,/g, '').trim();
  if (text === '') return 0;
  const number = Number(text);
  return isNaN(number) ? value : number;
}
