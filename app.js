/* ============================================================
   Quality Cheese — Time & Motion Dashboard
   Pure client-side: stopwatch, data table, localStorage,
   and multi-sheet Excel export (one sheet per station).
   ============================================================ */

const STORAGE_KEY = "qc_time_motion_rows_v1";
const SETTINGS_KEY = "qc_time_motion_settings_v1";

/* ---------- State ---------- */
let rows = loadRows();          // array of observation objects
let elapsed = 0;                // stopwatch elapsed ms
let running = false;
let startTime = 0;              // performance.now() at last start
let rafId = null;
let laps = [];

/* ---------- Element refs ---------- */
const $ = (id) => document.getElementById(id);
const els = {
  station: $("station"),
  stationEcho: $("stationEcho"),
  cheese: $("cheese"),
  display: $("display"),
  startStop: $("startStop"),
  lap: $("lap"),
  reset: $("reset"),
  useActivity: $("useActivity"),
  useBetween: $("useBetween"),
  lapList: $("lapList"),
  activity: $("activity"),
  labour: $("labour"),
  activityTime: $("activityTime"),
  betweenTime: $("betweenTime"),
  addRow: $("addRow"),
  tableBody: $("tableBody"),
  rowCount: $("rowCount"),
  exportBtn: $("exportBtn"),
  clearBtn: $("clearBtn"),
};

/* ============================================================
   Time formatting helpers
   ============================================================ */

// ms -> "mm:ss.t"
function fmtStopwatch(ms) {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const t = Math.floor((ms % 1000) / 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${t}`;
}

// seconds -> "mm:ss"
function secToMMSS(sec) {
  if (sec == null || isNaN(sec)) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Accepts "mm:ss", "m:ss", or plain seconds/decimal -> seconds (number) or null
function parseTimeToSeconds(value) {
  if (value == null) return null;
  const v = String(value).trim();
  if (v === "") return null;
  if (v.includes(":")) {
    const parts = v.split(":").map((p) => p.trim());
    if (parts.length === 2) {
      const m = parseFloat(parts[0]) || 0;
      const s = parseFloat(parts[1]) || 0;
      return m * 60 + s;
    }
    if (parts.length === 3) {
      const h = parseFloat(parts[0]) || 0;
      const m = parseFloat(parts[1]) || 0;
      const s = parseFloat(parts[2]) || 0;
      return h * 3600 + m * 60 + s;
    }
  }
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/* ============================================================
   Stopwatch
   ============================================================ */

function tick() {
  const now = performance.now();
  els.display.textContent = fmtStopwatch(elapsed + (now - startTime));
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
  els.display.textContent = fmtStopwatch(elapsed);
  els.startStop.textContent = "Start";
  els.startStop.classList.add("btn-primary");
  els.startStop.classList.remove("btn-danger");
}

function resetStopwatch() {
  running = false;
  cancelAnimationFrame(rafId);
  elapsed = 0;
  laps = [];
  els.display.textContent = fmtStopwatch(0);
  els.startStop.textContent = "Start";
  els.startStop.classList.add("btn-primary");
  els.startStop.classList.remove("btn-danger");
  renderLaps();
}

function currentElapsedMs() {
  return running ? elapsed + (performance.now() - startTime) : elapsed;
}

function recordLap() {
  const ms = currentElapsedMs();
  const prevTotal = laps.length ? laps[laps.length - 1].total : 0;
  laps.push({ total: ms, split: ms - prevTotal });
  renderLaps();
}

function renderLaps() {
  els.lapList.innerHTML = "";
  laps.forEach((lap, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>Lap ${i + 1} &nbsp; (split ${fmtStopwatch(lap.split)})</span><span>${fmtStopwatch(lap.total)}</span>`;
    els.lapList.appendChild(li);
  });
}

/* ============================================================
   Settings (station + cheese) persistence
   ============================================================ */

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    if (s.station != null) els.station.value = s.station;
    if (s.cheese != null) els.cheese.value = s.cheese;
  } catch (e) { /* ignore */ }
  updateStationEcho();
}

function saveSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ station: els.station.value, cheese: els.cheese.value })
  );
}

function updateStationEcho() {
  els.stationEcho.textContent = els.station.value.trim() || "—";
}

/* ============================================================
   Rows: persistence + rendering
   ============================================================ */

function loadRows() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveRows() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function renderTable() {
  els.tableBody.innerHTML = "";
  if (rows.length === 0) {
    els.tableBody.innerHTML =
      `<tr class="empty-row"><td colspan="8">No data yet — add your first observation above.</td></tr>`;
  } else {
    rows.forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.station)}</td>
        <td>${escapeHtml(r.cheese)}</td>
        <td>${escapeHtml(r.activity)}</td>
        <td>${secToMMSS(r.activitySec)}</td>
        <td>${secToMMSS(r.betweenSec)}</td>
        <td>${escapeHtml(r.labour)}</td>
        <td>${escapeHtml(r.time)}</td>
        <td><button class="del-btn" data-idx="${idx}" aria-label="Delete row">✕</button></td>`;
      els.tableBody.appendChild(tr);
    });
  }
  els.rowCount.textContent = `${rows.length} row${rows.length === 1 ? "" : "s"}`;
}

function escapeHtml(v) {
  if (v == null) return "";
  return String(v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ============================================================
   Add / delete observations
   ============================================================ */

function addRow() {
  const station = els.station.value.trim();
  if (!station) {
    toast("Please enter a station number first");
    els.station.focus();
    return;
  }
  const activity = els.activity.value.trim();
  if (!activity) {
    toast("Please enter an activity name");
    els.activity.focus();
    return;
  }

  const now = new Date();
  rows.push({
    station,
    cheese: els.cheese.value.trim(),
    activity,
    activitySec: parseTimeToSeconds(els.activityTime.value),
    betweenSec: parseTimeToSeconds(els.betweenTime.value),
    labour: els.labour.value.trim(),
    time: now.toLocaleTimeString(),
    date: now.toLocaleDateString(),
    iso: now.toISOString(),
  });

  saveRows();
  renderTable();

  // Clear the per-observation fields, keep station + cheese for the next entry.
  els.activity.value = "";
  els.activityTime.value = "";
  els.betweenTime.value = "";
  els.labour.value = "";
  els.activity.focus();
  toast("Observation added");
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
    "Date", "Time", "Cheese Name", "Activity",
    "Time per Activity (s)", "Time per Activity (mm:ss)",
    "Time Between (s)", "Time Between (mm:ss)",
    "Labour (workers)",
  ];

  // Group rows by station number.
  const byStation = {};
  rows.forEach((r) => {
    (byStation[r.station] = byStation[r.station] || []).push(r);
  });

  const wb = XLSX.utils.book_new();

  // Sort station keys numerically where possible.
  const stationKeys = Object.keys(byStation).sort((a, b) => {
    const na = parseFloat(a), nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });

  stationKeys.forEach((station) => {
    const aoa = [headers];
    byStation[station].forEach((r) => {
      aoa.push([
        r.date || "",
        r.time || "",
        r.cheese || "",
        r.activity || "",
        r.activitySec ?? "",
        secToMMSS(r.activitySec),
        r.betweenSec ?? "",
        secToMMSS(r.betweenSec),
        r.labour || "",
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 11 }, { wch: 11 }, { wch: 16 }, { wch: 22 },
      { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    ];
    // Sheet names: max 31 chars, no special chars.
    const safeName = `Station ${station}`.slice(0, 31).replace(/[\\\/\?\*\[\]:]/g, "");
    XLSX.utils.book_append_sheet(wb, ws, safeName);
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

els.startStop.addEventListener("click", () => (running ? stopStopwatch() : startStopwatch()));
els.lap.addEventListener("click", recordLap);
els.reset.addEventListener("click", resetStopwatch);

els.useActivity.addEventListener("click", () => {
  els.activityTime.value = secToMMSS(currentElapsedMs() / 1000);
  toast("Copied to Time per activity");
});
els.useBetween.addEventListener("click", () => {
  els.betweenTime.value = secToMMSS(currentElapsedMs() / 1000);
  toast("Copied to Time between");
});

els.addRow.addEventListener("click", addRow);
els.exportBtn.addEventListener("click", exportExcel);

els.clearBtn.addEventListener("click", () => {
  if (rows.length === 0) { toast("Nothing to clear"); return; }
  if (confirm(`Delete all ${rows.length} recorded rows? This cannot be undone.\n\nTip: export to Excel first if you want a backup.`)) {
    rows = [];
    saveRows();
    renderTable();
    toast("All data cleared");
  }
});

els.tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".del-btn");
  if (btn) deleteRow(parseInt(btn.dataset.idx, 10));
});

els.station.addEventListener("input", () => { updateStationEcho(); saveSettings(); });
els.cheese.addEventListener("input", saveSettings);

/* ---------- Init ---------- */
loadSettings();
renderTable();
els.display.textContent = fmtStopwatch(0);
