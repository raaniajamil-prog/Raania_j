# Quality Cheese — Time & Motion Dashboard

A phone-friendly dashboard for running time-and-motion studies on the factory
floor. It replaces the clipboard: time activities with a built-in stopwatch,
record observations into a table, and export everything to an Excel workbook
where **each station is its own sheet**.

No installation, no server, no accounts — it's a single web page that runs
entirely in your phone's browser and saves your data on the device.

---

## What it does

- **Stopwatch** — start / stop / reset, with lap times. Tap **"Use as Activity
  time"** or **"Use as Between time"** to drop the timed value straight into the
  data form (no copying numbers by hand).
- **Station number** — every observation is tagged with the station you set at
  the top.
- **Cheese name** — set once and it carries over to each new row.
- **Data table** — records Activity, Time per activity, Time between activities,
  and Labour (number of workers), with a timestamp.
- **Auto-save** — data is stored on the device, so closing the browser or
  locking the phone won't lose anything.
- **Export to Excel (.xlsx)** — one tap downloads a workbook. Each station
  becomes a separate sheet (`Station 1`, `Station 2`, …) with both raw seconds
  (for calculations) and `mm:ss` (for reading) columns.

---

## How to use it on your phone

### Option A — Host it free on GitHub Pages (recommended)

This gives you a permanent web link you can open on any phone.

1. Push this repository to GitHub (this branch already contains the files).
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Pick this branch and the **`/ (root)`** folder, then **Save**.
5. After a minute GitHub gives you a URL like
   `https://<your-username>.github.io/<repo-name>/`.
6. Open that URL on your phone. In your browser menu choose **"Add to Home
   Screen"** so it behaves like an app.

### Option B — Open the file directly

Download the three files (`index.html`, `styles.css`, `app.js`) into the same
folder and open `index.html` in any browser.

> Excel export needs an internet connection the first time, because it loads the
> spreadsheet library from a CDN. Once the page has loaded, timing and data
> entry work offline.

---

## Typical workflow

1. Enter the **station number** and **cheese name** at the top.
2. Press **Start** when an activity begins; **Stop** when it ends.
3. Tap **"Use as Activity time"** to capture that duration.
4. Reset, time the gap before the next activity, tap **"Use as Between time"**.
5. Type the **Activity** name and **Labour** count, then **"+ Add to table"**.
6. Repeat for each activity. Change the station number when you move stations.
7. At the end of the study, tap **"Export to Excel"** to download the workbook.

---

## Files

| File         | Purpose                                          |
|--------------|--------------------------------------------------|
| `index.html` | Page structure (stopwatch, form, table)          |
| `styles.css` | Mobile-first styling                             |
| `app.js`     | Stopwatch, data handling, storage, Excel export  |

The Excel export uses [SheetJS](https://sheetjs.com/) loaded from a CDN.
