/* ============================================================
   Quality Cheese — Time & Motion Dashboard
   Lap-based cycle timing: each Lap saves an entry (its activity
   time + running total). Station/Activity/Cheese set once.
   Multi-sheet Excel export (one sheet per station).
   ============================================================ */

const STORAGE_KEY = "qc_time_motion_rows_v2";
const SETTINGS_KEY = "qc_time_motion_settings_v2";

/* ---------- State ---------- */
let rows = loadRows();          // array of entry objects
let elapsed = 0;                // total stopwatch ms (across pauses)
let running = false;
let startTime = 0;              // performance.now() at last start
let rafId = null;
let lastLapMs = 0;              // total-ms value at the previous lap
let lapCounter = 0;             // entry number within the current run

/* ---------- Element refs ---------- */
const $ = (id) => document.getElementById(id);
const els = {
  station: $("station"),
  cheese: $("cheese"),
  activity: $("activity"),
  display: $("display"),         // total time
  lapDisplay: $("lapDisplay"),   // current activity (current lap)
  startStop: $("startStop"),
  lap: $("lap"),
  reset: $("reset"),
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

// Accepts "mm:ss", "h:mm:ss", or plain seconds/decimal -> seconds (number) or null
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

function resetStopwatch() {
  if (running || elapsed > 0) {
    if (!confirm("Reset the stopwatch to zero? (Your saved entries in the table are kept.)")) return;
  }
  running = false;
  cancelAnimationFrame(rafId);
  elapsed = 0;
  lastLapMs = 0;
  lapCounter = 0;
  els.lapDisplay.textContent = fmtStopwatch(0);
  els.display.textContent = fmtStopwatch(0);
  els.startStop.textContent = "Start";
  els.startStop.classList.add("btn-primary");
  els.startStop.classList.remove("btn-danger");
}

/* ============================================================
   Lap = save an entry, restart the activity timer
   ============================================================ */

function recordLap() {
  if (!running) {
    toast("Press Start first");
    return;
  }
  const station = els.station.value.trim();
  if (!station) {
    toast("Enter a station number first");
    els.station.focus();
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
  lapCounter += 1;

  const now = new Date();
  rows.push({
    station,
    activity,
    cheese: els.cheese.value.trim(),
    lap: lapCounter,
    activitySec: Math.round(lapMs / 100) / 10,   // 0.1s precision
    betweenSec: null,                            // filled in by hand if wanted
    totalSec: Math.round(totalMs / 100) / 10,
    time: now.toLocaleTimeString(),
    date: now.toLocaleDateString(),
    iso: now.toISOString(),
  });

  saveRows();
  renderTable();
  toast(`Activity #${lapCounter} saved`);
}

/* ============================================================
   Settings (station + activity + cheese) persistence
   ============================================================ */

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    if (s.station != null) els.station.value = s.station;
    if (s.activity != null) els.activity.value = s.activity;
    if (s.cheese != null) els.cheese.value = s.cheese;
  } catch (e) { /* ignore */ }
}

function saveSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      station: els.station.value,
      activity: els.activity.value,
      cheese: els.cheese.value,
    })
  );
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
      `<tr class="empty-row"><td colspan="8">No entries yet — press Start, then tap Lap for each activity.</td></tr>`;
  } else {
    rows.forEach((r, idx) => {
      const betweenVal = r.betweenSec != null ? secToMMSS(r.betweenSec) : "";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.station)}</td>
        <td>${escapeHtml(r.activity)}</td>
        <td>${escapeHtml(r.lap)}</td>
        <td>${secToMMSS(r.activitySec)}</td>
        <td><input class="between-input" data-idx="${idx}" inputmode="decimal"
                   placeholder="mm:ss" value="${betweenVal}" /></td>
        <td>${secToMMSS(r.totalSec)}</td>
        <td>${escapeHtml(r.time)}</td>
        <td><button class="del-btn" data-idx="${idx}" aria-label="Delete entry">✕</button></td>`;
      els.tableBody.appendChild(tr);
    });
  }
  els.rowCount.textContent = `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`;
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
    "Date", "Time", "Cheese Name", "Activity", "Activity #",
    "Activity Time (s)", "Activity Time (mm:ss)",
    "Between (s)", "Between (mm:ss)",
    "Total Time (s)", "Total Time (mm:ss)",
  ];

  // Group rows by station number.
  const byStation = {};
  rows.forEach((r) => {
    (byStation[r.station] = byStation[r.station] || []).push(r);
  });

  const wb = XLSX.utils.book_new();

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
        r.lap ?? "",
        r.activitySec ?? "",
        secToMMSS(r.activitySec),
        r.betweenSec ?? "",
        secToMMSS(r.betweenSec),
        r.totalSec ?? "",
        secToMMSS(r.totalSec),
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 11 }, { wch: 11 }, { wch: 16 }, { wch: 22 }, { wch: 9 },
      { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    ];
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

els.exportBtn.addEventListener("click", exportExcel);

els.clearBtn.addEventListener("click", () => {
  if (rows.length === 0) { toast("Nothing to clear"); return; }
  if (confirm(`Delete all ${rows.length} saved entries? This cannot be undone.\n\nTip: export to Excel first if you want a backup.`)) {
    rows = [];
    saveRows();
    renderTable();
    toast("All data cleared");
  }
});

// Table: delete buttons + editable "between" fields.
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

// Persist the once-per-study fields as they're typed.
els.station.addEventListener("input", saveSettings);
els.activity.addEventListener("input", saveSettings);
els.cheese.addEventListener("input", saveSettings);

/* ---------- Init ---------- */
loadSettings();
renderTable();
els.lapDisplay.textContent = fmtStopwatch(0);
els.display.textContent = fmtStopwatch(0);
