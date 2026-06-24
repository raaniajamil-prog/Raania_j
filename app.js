/* ============================================================
   Quality Cheese — Time & Motion Dashboard
   Three station "pages" (tabs). Two-phase timing: the stopwatch
   alternates between timing an ACTIVITY and the GAP after it, so
   both are captured automatically (no manual typing).
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
let lastLapMs = 0;              // total-ms value at the start of the current segment
let phase = "activity";         // "activity" or "gap"
let pendingRow = null;          // the entry awaiting its gap (between) time

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
  phaseChip: $("phaseChip"),
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
   Stopwatch — total + current segment
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
  phase = "activity";
  pendingRow = null;
  els.lapDisplay.textContent = fmtStopwatch(0);
  els.display.textContent = fmtStopwatch(0);
  els.startStop.textContent = "Start";
  els.startStop.classList.add("btn-primary");
  els.startStop.classList.remove("btn-danger");
  updatePhaseUI();
}

/* ============================================================
   Two-phase logging: End activity -> End gap -> End activity ...
   ============================================================ */

function markSegment() {
  if (!running) {
    toast("Press Start first");
    return;
  }

  const totalMs = currentTotalMs();
  const segMs = totalMs - lastLapMs;
  if (segMs < 50) return; // ignore accidental double-taps

  if (phase === "activity") {
    const activity = els.activity.value.trim();
    if (!activity) {
      toast("Enter the activity first");
      els.activity.focus();
      return;
    }
    const now = new Date();
    const row = {
      station: activeStation,
      activity,
      cheese: els.cheese.value.trim(),
      activitySec: Math.round(segMs / 100) / 10,   // 0.1s precision
      betweenSec: null,
      labour: "",
      delayReason: "",
      time: now.toLocaleTimeString(),
      date: now.toLocaleDateString(),
      iso: now.toISOString(),
    };
    rows.push(row);
    pendingRow = row;
    phase = "gap";
    toast("Activity saved — now timing the gap");
  } else {
    // Closing the gap: attach the between time to the pending entry.
    if (pendingRow) pendingRow.betweenSec = Math.round(segMs / 100) / 10;
    pendingRow = null;
    phase = "activity";
    toast("Gap saved — now timing the next activity");
  }

  lastLapMs = totalMs;
  saveRows();
  renderTable();
  updatePhaseUI();
}

function updatePhaseUI() {
  if (phase === "activity") {
    els.phaseChip.textContent = "Timing: Activity";
    els.phaseChip.classList.remove("phase-gap");
    els.phaseChip.classList.add("phase-activity");
    els.lap.textContent = "End activity";
  } else {
    els.phaseChip.textContent = "Timing: Gap (between)";
    els.phaseChip.classList.remove("phase-activity");
    els.phaseChip.classList.add("phase-gap");
    els.lap.textContent = "End gap";
  }
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
      <td>${secToMMSS(r.activitySec)}</td>
      <td><input class="between-input" data-idx="${idx}" inputmode="decimal"
                 placeholder="—" value="${betweenVal}" /></td>
      <td><select class="labour-select" data-idx="${idx}">${labourOptions(r.labour)}</select></td>
      <td><input class="note-input" data-idx="${idx}" type="text"
                 placeholder="e.g. waited for curd" value="${escapeHtml(r.delayReason || "")}" /></td>
      <td><button class="del-btn" data-idx="${idx}" aria-label="Delete entry">✕</button></td>`;
    els.tableBody.appendChild(tr);
  });

  if (count === 0) {
    els.tableBody.innerHTML =
      `<tr class="empty-row"><td colspan="6">No entries yet — press Start, then End activity / End gap.</td></tr>`;
  }
  els.rowCount.textContent = `${count} ${count === 1 ? "entry" : "entries"}`;
}

function escapeHtml(v) {
  if (v == null) return "";
  return String(v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Dropdown options for the Labour (number of workers) picker: 0–12.
function labourOptions(selected) {
  let opts = `<option value=""${selected ? "" : " selected"}>—</option>`;
  for (let i = 0; i <= 12; i++) {
    const sel = String(i) === String(selected) ? " selected" : "";
    opts += `<option value="${i}"${sel}>${i}</option>`;
  }
  return opts;
}

function deleteRow(idx) {
  if (rows[idx] === pendingRow) pendingRow = null;
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

  const wb = XLSX.utils.book_new();

  STATIONS.forEach((station) => {
    const stationRows = rows.filter((r) => r.station === station);
    const setup = settings[station] || {};
    const activity = (stationRows[0] && stationRows[0].activity) || setup.activity || "";
    const date = (stationRows[0] && stationRows[0].date) || "";

    // Header block, then the four data columns.
    const aoa = [
      ["Station", station],
      ["Activity", activity],
      ["Date", date],
      [],
      ["Time taken", "Time in between", "Labour", "Delay"],
    ];
    stationRows.forEach((r) => {
      aoa.push([
        secToMMSS(r.activitySec),
        secToMMSS(r.betweenSec),
        r.labour || "",
        r.delayReason || "",
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 30 }];
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
els.lap.addEventListener("click", markSegment);
els.reset.addEventListener("click", () => resetStopwatch(false));

els.exportBtn.addEventListener("click", exportExcel);

els.clearBtn.addEventListener("click", () => {
  const mine = rows.filter((r) => r.station === activeStation).length;
  if (mine === 0) { toast("Nothing to clear for this station"); return; }
  if (confirm(`Delete all ${mine} entries for Station ${activeStation}? This cannot be undone.\n\nTip: export to Excel first if you want a backup.`)) {
    rows = rows.filter((r) => r.station !== activeStation);
    pendingRow = null;
    saveRows();
    renderTable();
    toast(`Station ${activeStation} cleared`);
  }
});

els.tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".del-btn");
  if (btn) deleteRow(parseInt(btn.dataset.idx, 10));
});
els.tableBody.addEventListener("change", (e) => {
  const sel = e.target.closest(".labour-select");
  if (!sel) return;
  const idx = parseInt(sel.dataset.idx, 10);
  if (rows[idx]) {
    rows[idx].labour = sel.value;
    saveRows();
  }
});
els.tableBody.addEventListener("input", (e) => {
  const between = e.target.closest(".between-input");
  if (between) {
    const idx = parseInt(between.dataset.idx, 10);
    if (rows[idx]) {
      rows[idx].betweenSec = parseTimeToSeconds(between.value);
      saveRows();
    }
    return;
  }
  const note = e.target.closest(".note-input");
  if (note) {
    const idx = parseInt(note.dataset.idx, 10);
    if (rows[idx]) {
      rows[idx].delayReason = note.value;
      saveRows();
    }
  }
});

els.activity.addEventListener("input", saveCurrentFields);
els.cheese.addEventListener("input", saveCurrentFields);

/* ---------- Init ---------- */
loadCurrentFields();
refreshStationLabels();
renderTable();
updatePhaseUI();
els.lapDisplay.textContent = fmtStopwatch(0);
els.display.textContent = fmtStopwatch(0);
