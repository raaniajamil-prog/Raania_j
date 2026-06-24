/* ============================================================
   Quality Cheese — Time & Motion Dashboard
   Three station "pages" (tabs). Each Lap saves one entry (its
   own activity time). Running total shown live but not stored.
   Multi-sheet Excel export (one sheet per station).
   ============================================================ */

const STATIONS = ["1", "2", "3"];
const ROWS_KEY = "qc_tm_rows_v3";
const SETTINGS_KEY = "qc_tm_settings_v3";   // { "1": {activity, cheese}, ... }
const ACTIVE_KEY = "qc_tm_active_v3";

/* ---------- State ---------- */
let rows = loadRows();          // every entry, across all stations
let settings = loadSettings();  // per-station activity + cheese
let activeStation = localStorage.getItem(ACTIVE_KEY) || "1";

let elapsed = 0;                // total stopwatch ms (across pauses)
let running = false;
let startTime = 0;
let rafId = null;
let lastLapMs = 0;              // total-ms value at the previous lap

/* ---------- Element refs ---------- */
const $ = (id) => document.getElementById(id);
const els = {
  tabs: $("tabs"),
  setupStation: $("setupStation"),
  tableStation: $("tableStation"),
  cheese: $("cheese"),
  activity: $("activity"),
  display: $("display"),
  lapDisplay: $("lapDisplay"),
  startStop: $("startStop"),
  lap: $("lap"),
  reset: $("reset"),
  tableBody: $("tableBody"),
  rowCount: $("rowCount"),
  exportBtn: $("exportBtn"),
  clearBtn: $("clearBtn"),
};

/* ============================================================
   Time helpers
   ============================================================ */

function fmtStopwatch(ms) {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const t = Math.floor((ms % 1000) / 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${t}`;
}

function secToMMSS(sec) {
  if (sec == null || isNaN(sec)) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseTimeToSeconds(value) {
  if (value == null) return null;
  const v = String(value).trim();
  if (v === "") return null;
  if (v.includes(":")) {
    const parts = v.split(":").map((p) => p.trim());
    if (parts.length === 2) {
      return (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
    }
    if (parts.length === 3) {
      return (parseFloat(parts[0]) || 0) * 3600 + (parseFloat(parts[1]) || 0) * 60 + (parseFloat(parts[2]) || 0);
    }
  }
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/* ============================================================
   Stopwatch — total + current lap
   ============================================================ */

function currentTotalMs() {
  return running ? elapsed + (performance.now() - startTime) : elapsed;
}
function currentLapMs() {
  return currentTotalMs() - lastLapMs;
}

function tick() {
  els.lapDisplay.textContent = fmtStopwatch(currentLapMs());
  els.display.textContent = fmtStopwatch(currentTotalMs());
  rafId = requestAnimationFrame(tick);
}

function startStopwatch() {
  running = true;
  startTime = performance.now();
  els.startStop.textContent = "Stop";
  els.startStop.classList.remove("btn-primary");
  els.startStop.classList.add("btn-danger");
  rafId = requestAnimationFrame(tick);
}

function stopStopwatch() {
  running = false;
  elapsed += performance.now() - startTime;
  cancelAnimationFrame(rafId);
  els.lapDisplay.textContent = fmtStopwatch(currentLapMs());
  els.display.textContent = fmtStopwatch(currentTotalMs());
  els.startStop.textContent = "Start";
  els.startStop.classList.add("btn-primary");
  els.startStop.classList.remove("btn-danger");
}

function resetStopwatch(silent) {
  if (!silent && (running || elapsed > 0)) {
    if (!confirm("Reset the stopwatch to zero? (Your saved entries are kept.)")) return;
  }
  running = false;
  cancelAnimationFrame(rafId);
  elapsed = 0;
  lastLapMs = 0;
  els.lapDisplay.textContent = fmtStopwatch(0);
  els.display.textContent = fmtStopwatch(0);
  els.startStop.textContent = "Start";
  els.startStop.classList.add("btn-primary");
  els.startStop.classList.remove("btn-danger");
}

/* ============================================================
   Lap = save one entry for the active station
   ============================================================ */

function recordLap() {
  if (!running) {
    toast("Press Start first");
    return;
  }
  const activity = els.activity.value.trim();
  if (!activity) {
    toast("Enter the activity first");
    els.activity.focus();
    return;
  }

  const totalMs = currentTotalMs();
  const lapMs = totalMs - lastLapMs;
  if (lapMs < 50) return; // ignore accidental double-taps
  lastLapMs = totalMs;

  const now = new Date();
  rows.push({
    station: activeStation,
    activity,
    cheese: els.cheese.value.trim(),
    activitySec: Math.round(lapMs / 100) / 10,   // 0.1s precision
    betweenSec: null,                            // typed in by hand if wanted
    time: now.toLocaleTimeString(),
    date: now.toLocaleDateString(),
    iso: now.toISOString(),
  });

  saveRows();
  renderTable();
  toast("Activity saved");
}

/* ============================================================
   Persistence
   ============================================================ */

function loadRows() {
  try { return JSON.parse(localStorage.getItem(ROWS_KEY)) || []; }
  catch (e) { return []; }
}
function saveRows() {
  localStorage.setItem(ROWS_KEY, JSON.stringify(rows));
}

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/* ============================================================
   Station switching
   ============================================================ */

function switchStation(station) {
  if (!STATIONS.includes(station)) return;
  // Save current field values to the station we're leaving.
  saveCurrentFields();
  activeStation = station;
  localStorage.setItem(ACTIVE_KEY, activeStation);
  resetStopwatch(true);          // fresh timer for the new station
  loadCurrentFields();
  refreshStationLabels();
  renderTable();
}

function saveCurrentFields() {
  settings[activeStation] = {
    activity: els.activity.value,
    cheese: els.cheese.value,
  };
  saveSettings();
}

function loadCurrentFields() {
  const s = settings[activeStation] || {};
  els.activity.value = s.activity || "";
  els.cheese.value = s.cheese || "";
}

function refreshStationLabels() {
  const label = `Station ${activeStation}`;
  els.setupStation.textContent = label;
  els.tableStation.textContent = label;
  [...els.tabs.querySelectorAll(".tab")].forEach((b) => {
    b.classList.toggle("active", b.dataset.station === activeStation);
  });
}

/* ============================================================
   Table (active station only)
   ============================================================ */

function renderTable() {
  els.tableBody.innerHTML = "";
  let count = 0;
  rows.forEach((r, idx) => {
    if (r.station !== activeStation) return;
    count += 1;
    const betweenVal = r.betweenSec != null ? secToMMSS(r.betweenSec) : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${count}</td>
      <td>${escapeHtml(r.activity)}</td>
      <td>${secToMMSS(r.activitySec)}</td>
      <td><input class="between-input" data-idx="${idx}" inputmode="decimal"
                 placeholder="mm:ss" value="${betweenVal}" /></td>
      <td>${escapeHtml(r.time)}</td>
      <td><button class="del-btn" data-idx="${idx}" aria-label="Delete entry">✕</button></td>`;
    els.tableBody.appendChild(tr);
  });

  if (count === 0) {
    els.tableBody.innerHTML =
      `<tr class="empty-row"><td colspan="6">No entries yet — press Start, then tap Lap for each activity.</td></tr>`;
  }
  els.rowCount.textContent = `${count} ${count === 1 ? "entry" : "entries"}`;
}

function escapeHtml(v) {
  if (v == null) return "";
  return String(v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function deleteRow(idx) {
  rows.splice(idx, 1);
  saveRows();
  renderTable();
}

/* ============================================================
   Excel export — one sheet per station
   ============================================================ */

function exportExcel() {
  if (rows.length === 0) {
    toast("No data to export yet");
    return;
  }

  const headers = [
    "Date", "Time", "Cheese Name", "Activity", "#",
    "Activity Time (s)", "Activity Time (mm:ss)",
    "Between (s)", "Between (mm:ss)",
  ];

  const wb = XLSX.utils.book_new();

  STATIONS.forEach((station) => {
    const aoa = [headers];
    let n = 0;
    rows.forEach((r) => {
      if (r.station !== station) return;
      n += 1;
      aoa.push([
        r.date || "",
        r.time || "",
        r.cheese || "",
        r.activity || "",
        n,
        r.activitySec ?? "",
        secToMMSS(r.activitySec),
        r.betweenSec ?? "",
        secToMMSS(r.betweenSec),
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 11 }, { wch: 11 }, { wch: 16 }, { wch: 22 }, { wch: 5 },
      { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, `Station ${station}`);
  });

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `quality-cheese-time-motion_${stamp}.xlsx`);
  toast("Excel file downloaded");
}

/* ============================================================
   Toast
   ============================================================ */

let toastTimer = null;
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ============================================================
   Wire up events
   ============================================================ */

els.tabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) switchStation(tab.dataset.station);
});

els.startStop.addEventListener("click", () => (running ? stopStopwatch() : startStopwatch()));
els.lap.addEventListener("click", recordLap);
els.reset.addEventListener("click", () => resetStopwatch(false));

els.exportBtn.addEventListener("click", exportExcel);

els.clearBtn.addEventListener("click", () => {
  const mine = rows.filter((r) => r.station === activeStation).length;
  if (mine === 0) { toast("Nothing to clear for this station"); return; }
  if (confirm(`Delete all ${mine} entries for Station ${activeStation}? This cannot be undone.\n\nTip: export to Excel first if you want a backup.`)) {
    rows = rows.filter((r) => r.station !== activeStation);
    saveRows();
    renderTable();
    toast(`Station ${activeStation} cleared`);
  }
});

els.tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".del-btn");
  if (btn) deleteRow(parseInt(btn.dataset.idx, 10));
});
els.tableBody.addEventListener("input", (e) => {
  const input = e.target.closest(".between-input");
  if (!input) return;
  const idx = parseInt(input.dataset.idx, 10);
  if (rows[idx]) {
    rows[idx].betweenSec = parseTimeToSeconds(input.value);
    saveRows();
  }
});

// Persist setup fields as they're typed (to the active station).
els.activity.addEventListener("input", saveCurrentFields);
els.cheese.addEventListener("input", saveCurrentFields);

/* ---------- Init ---------- */
loadCurrentFields();
refreshStationLabels();
renderTable();
els.lapDisplay.textContent = fmtStopwatch(0);
els.display.textContent = fmtStopwatch(0);
