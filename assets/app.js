const CONFIG = window.APP_CONFIG || {};
const state = {
  data: null,
  inventorySearch: "",
  statusFilter: "all",
  boxSearch: ""
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function apiUrl() {
  return String(CONFIG.API_URL || CONFIG.GOOGLE_SCRIPT_URL || "").trim();
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function safeText(value, fallback = "—") {
  if (!hasValue(value)) return fallback;
  return String(value);
}

function escapeHtml(value) {
  return safeText(value, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function num(value) {
  const n = Number(String(value ?? 0).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function fmtNumber(value) {
  return num(value).toLocaleString("en-IN");
}

function cleanStatus(status) {
  return safeText(status, "").toLowerCase();
}

function displayStatus(status) {
  const text = safeText(status, "").replace(/[✅🟡🔴❌]/g, "").trim();
  if (!text) return "No alert";
  return text
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Ok", "OK");
}

function statusClass(status) {
  const s = cleanStatus(status);
  if (s.includes("out")) return "out";
  if (s.includes("reorder")) return "reorder";
  if (s.includes("low") || s.includes("monitor")) return "low monitor";
  if (s.includes("ok") || s.includes("sufficient")) return "ok";
  return "neutral";
}

function inventoryStatusKey(row) {
  const s = cleanStatus(row.status);
  if (s.includes("out")) return "out";
  if (s.includes("low") || s.includes("monitor") || s.includes("reorder")) return "low";
  if (s.includes("ok") || s.includes("sufficient")) return "ok";
  return "other";
}

function statusRank(status) {
  const s = cleanStatus(status);
  if (s.includes("out")) return 0;
  if (s.includes("reorder")) return 1;
  if (s.includes("low") || s.includes("monitor")) return 2;
  if (s.includes("ok") || s.includes("sufficient")) return 3;
  return 4;
}

function setStatus(message, type = "neutral") {
  const el = $("#syncStatus");
  el.textContent = message;
  el.dataset.type = type;
}

async function fetchJsonp(url) {
  return new Promise((resolve, reject) => {
    const callback = `jsonp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const sep = url.includes("?") ? "&" : "?";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("JSONP request timed out"));
    }, 15000);

    function cleanup() {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
    }

    window[callback] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP request failed"));
    };

    script.src = `${url}${sep}callback=${encodeURIComponent(callback)}&t=${Date.now()}`;
    document.body.appendChild(script);
  });
}

async function loadData() {
  setStatus("Loading…");
  const urlBase = apiUrl();

  try {
    if (urlBase) {
      const url = `${urlBase}${urlBase.includes("?") ? "&" : "?"}action=all&t=${Date.now()}`;
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.data = await response.json();
      } catch (fetchError) {
        state.data = await fetchJsonp(url);
      }
      setStatus(`Live sync • ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, "live");
    } else {
      const response = await fetch("data/sample-data.json", { cache: "no-store" });
      state.data = await response.json();
      setStatus("Demo data • Add Apps Script URL", "demo");
    }
    renderAll();
  } catch (error) {
    console.error(error);
    setStatus("Could not load data", "error");
  }
}

function metricValue(labelIncludes) {
  const metrics = state.data?.metrics || [];
  const found = metrics.find((m) => safeText(m.label, "").toLowerCase().includes(labelIncludes.toLowerCase()));
  return found ? found.value : 0;
}

function inventoryRows() {
  return (state.data?.inventoryDashboard || [])
    .filter((row) => hasValue(row.skuCode))
    .filter((row) => !String(row.skuCode || "").toLowerCase().includes("total"));
}

function boxRows() {
  return (state.data?.boxStockTracker || [])
    .filter((row) => hasValue(row.boxTypeSize))
    .filter((row) => !String(row.boxTypeSize || "").toLowerCase().includes("total"))
    .filter((row) => !isBoxNoteRow(row));
}

function isBoxNoteRow(row) {
  const title = String(row.boxTypeSize || "").trim().toLowerCase();
  if (!title) return true;
  if (title.includes("sufficient >") || title.includes("monitor between") || title.includes("returns are logged")) return true;
  if (title.startsWith("📌") || title.startsWith("✅ sufficient >")) return true;
  const onlyFirstColumnHasContent = !hasValue(row.reOrderAlert) && [
    row.openingBoxStock,
    row.purchasedPurchaseLog,
    row.boxesUsedSalesDispatch,
    row.closingBoxStock,
    row.minStock,
    row.totalPurchased
  ].every((value) => !hasValue(value));
  return onlyFirstColumnHasContent;
}

function renderMetrics() {
  const totalSkus = metricValue("Total SKUs") || inventoryRows().length;
  const currentStock = metricValue("Total Current Stock");
  const lowStock = metricValue("Low Stock");
  const outStock = metricValue("Out of Stock");

  const metrics = [
    { icon: "📦", label: "Total SKUs", value: totalSkus, className: "" },
    { icon: "📊", label: "Current Stock", value: currentStock, className: "good" },
    { icon: "⚠️", label: "Low Stock SKUs", value: lowStock, className: "warning" },
    { icon: "⛔", label: "Out of Stock", value: outStock, className: "danger" },
    { icon: "🏭", label: "Today Production", value: metricValue("Today's Production"), className: "" },
    { icon: "🚚", label: "Dispatched", value: metricValue("Total Dispatched"), className: "" },
    { icon: "↩", label: "Returned", value: metricValue("Total Returned"), className: "warning" },
    { icon: "💰", label: "Net Sales", value: metricValue("Net Sales"), className: "good" }
  ];

  $("#metricGrid").innerHTML = metrics.map((m) => `
    <article class="metric-card ${m.className}">
      <div class="metric-icon" aria-hidden="true">${escapeHtml(m.icon)}</div>
      <div>
        <div class="label">${escapeHtml(m.label)}</div>
        <div class="value">${fmtNumber(m.value)}</div>
      </div>
    </article>
  `).join("");
}

function emptyState() {
  return $("#emptyStateTemplate").content.firstElementChild.cloneNode(true);
}

function stockPercent(current, min) {
  const currentValue = Math.max(num(current), 0);
  const minValue = num(min);
  if (minValue <= 0) return currentValue > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((currentValue / (minValue * 1.5)) * 100)));
}

function progressMarkup(current, min, label = "Stock coverage") {
  const percent = stockPercent(current, min);
  return `
    <div class="stock-progress" aria-label="${escapeHtml(label)} ${percent}%">
      <div class="stock-progress-head">
        <span>${escapeHtml(label)}</span>
        <strong>${percent}%</strong>
      </div>
      <div class="progress-track"><span style="width:${percent}%"></span></div>
    </div>
  `;
}

function renderInventory() {
  const list = $("#inventoryList");
  const q = state.inventorySearch.trim().toLowerCase();
  const rows = inventoryRows()
    .filter((row) => {
      const haystack = [row.skuCode, row.productName, row.category, row.status].join(" ").toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesStatus = state.statusFilter === "all" || inventoryStatusKey(row) === state.statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || num(a.currentStock) - num(b.currentStock));

  list.innerHTML = "";
  if (!rows.length) {
    list.appendChild(emptyState());
    return;
  }

  list.innerHTML = rows.map((row) => `
    <article class="item-card status-${statusClass(row.status).split(" ")[0]}">
      <div class="item-top">
        <div>
          <h3 class="item-title">${escapeHtml(row.skuCode)}</h3>
          <p class="item-subtitle">${escapeHtml(row.productName)} • ${escapeHtml(row.category)}</p>
        </div>
        <span class="badge ${statusClass(row.status)}">${escapeHtml(displayStatus(row.status))}</span>
      </div>
      ${progressMarkup(row.currentStock, row.minStock)}
      <div class="stat-grid">
        <div class="stat"><span>Opening</span><strong>${fmtNumber(row.openingStock)}</strong></div>
        <div class="stat"><span>Produced</span><strong>${fmtNumber(row.totalProduced)}</strong></div>
        <div class="stat"><span>Dispatched</span><strong>${fmtNumber(row.totalDispatched)}</strong></div>
        <div class="stat highlight"><span>Current</span><strong>${fmtNumber(row.currentStock)}</strong></div>
        <div class="stat"><span>Returned</span><strong>${fmtNumber(row.totalReturned)}</strong></div>
        <div class="stat"><span>Min Stock</span><strong>${fmtNumber(row.minStock)}</strong></div>
      </div>
    </article>
  `).join("");
}

function boxStatMarkup(label, value) {
  if (!hasValue(value)) return "";
  return `<div class="stat"><span>${escapeHtml(label)}</span><strong>${fmtNumber(value)}</strong></div>`;
}

function renderBoxes() {
  const list = $("#boxList");
  const q = state.boxSearch.trim().toLowerCase();
  const rows = boxRows()
    .filter((row) => !q || [row.boxTypeSize, row.reOrderAlert].join(" ").toLowerCase().includes(q))
    .sort((a, b) => statusRank(a.reOrderAlert) - statusRank(b.reOrderAlert) || num(a.closingBoxStock) - num(b.closingBoxStock));

  list.innerHTML = "";
  if (!rows.length) {
    list.appendChild(emptyState());
    return;
  }

  list.innerHTML = rows.map((row) => {
    const minStock = num(row.minStock);
    const statItems = [
      boxStatMarkup("Opening", row.openingBoxStock),
      boxStatMarkup("Purchased", row.purchasedPurchaseLog),
      boxStatMarkup("Used", row.boxesUsedSalesDispatch),
      boxStatMarkup("Closing", row.closingBoxStock),
      minStock > 0 ? boxStatMarkup("Min Stock", row.minStock) : "",
      boxStatMarkup("All Purchased", row.totalPurchased)
    ].filter(Boolean).join("");

    return `
      <article class="item-card status-${statusClass(row.reOrderAlert).split(" ")[0]}">
        <div class="item-top">
          <div>
            <h3 class="item-title">${escapeHtml(row.boxTypeSize)}</h3>
            <p class="item-subtitle">Packaging stock tracker</p>
          </div>
          <span class="badge ${statusClass(row.reOrderAlert)}">${escapeHtml(displayStatus(row.reOrderAlert))}</span>
        </div>
        ${progressMarkup(row.closingBoxStock, row.minStock, "Box coverage")}
        <div class="stat-grid box-stats">
          ${statItems}
        </div>
      </article>
    `;
  }).join("");
}

function renderParties() {
  const list = $("#partyList");
  const rows = (state.data?.partySalesSummary || [])
    .filter((row) => hasValue(row.partyName))
    .filter((row) => !String(row.partyName || "").toLowerCase().includes("total"))
    .sort((a, b) => num(b.netSalesQty) - num(a.netSalesQty));

  list.innerHTML = "";
  if (!rows.length) {
    list.appendChild(emptyState());
    return;
  }

  list.innerHTML = rows.map((row) => `
    <article class="item-card">
      <div class="item-top">
        <div>
          <h3 class="item-title">${escapeHtml(row.partyName)}</h3>
          <p class="item-subtitle">Marketplace / party sales summary</p>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat"><span>Dispatched</span><strong>${fmtNumber(row.totalQtyDispatched)}</strong></div>
        <div class="stat"><span>Returned</span><strong>${fmtNumber(row.totalQtyReturned)}</strong></div>
        <div class="stat highlight"><span>Net Sales</span><strong>${fmtNumber(row.netSalesQty)}</strong></div>
      </div>
    </article>
  `).join("");
}

function logRows(rows, title, fields) {
  const clean = (rows || []).filter((r) => Object.values(r).some((v) => hasValue(v)));
  const body = clean.length ? clean.slice(-6).reverse().map((row) => {
    const main = fields.main.map((f) => safeText(row[f], "")).filter(Boolean).join(" • ") || "Entry";
    const sub = fields.sub.map((f) => safeText(row[f], "")).filter(Boolean).join(" • ");
    const qty = row[fields.qty] !== undefined ? fmtNumber(row[fields.qty]) : "";
    return `
      <div class="log-row">
        <div>
          <strong>${escapeHtml(main)}</strong>
          <small>${escapeHtml(sub)}</small>
        </div>
        <strong>${escapeHtml(qty)}</strong>
      </div>
    `;
  }).join("") : `<div class="empty-state"><strong>No entries yet</strong><span>Add rows in Google Sheet to show logs here.</span></div>`;
  return `<section class="log-box"><h3>${escapeHtml(title)}</h3>${body}</section>`;
}

function renderLogs() {
  $("#logGrid").innerHTML = [
    logRows(state.data?.dailyProduction, "Production", { main: ["skuCode"], sub: ["date", "remarks"], qty: "qtyProduced" }),
    logRows(state.data?.dispatch, "Dispatch", { main: ["skuCode", "partyName"], sub: ["date", "invoiceNo", "remarks"], qty: "qtyDispatched" }),
    logRows(state.data?.returns, "Returns", { main: ["skuCode", "partyName"], sub: ["date", "reason"], qty: "returnQty" }),
    logRows(state.data?.boxPurchaseLog, "Box Purchases", { main: ["boxTypeSku"], sub: ["date", "supplierSource", "remarks"], qty: "qtyPurchased" })
  ].join("");
}

function renderAll() {
  renderMetrics();
  renderInventory();
  renderBoxes();
  renderParties();
  renderLogs();
}

function setupEvents() {
  $("#refreshBtn").addEventListener("click", loadData);
  $("#inventorySearch").addEventListener("input", (event) => {
    state.inventorySearch = event.target.value;
    renderInventory();
  });
  $("#statusFilter").addEventListener("change", (event) => {
    state.statusFilter = event.target.value;
    renderInventory();
  });
  $("#boxSearch").addEventListener("input", (event) => {
    state.boxSearch = event.target.value;
    renderBoxes();
  });
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      $$(".panel").forEach((panel) => panel.classList.remove("active"));
      tab.classList.add("active");
      $(`#${tab.dataset.tab}`).classList.add("active");
    });
  });
}

setupEvents();
loadData();

if (Number(CONFIG.REFRESH_SECONDS) > 0) {
  setInterval(loadData, Number(CONFIG.REFRESH_SECONDS) * 1000);
}
