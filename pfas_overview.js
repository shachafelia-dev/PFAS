import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";

// ============================================================
//  CONFIGURATION
// ============================================================

// EPA legal limits (ng/L) — contaminants without an entry here have no MCL
const MCL_LIMITS = {
  PFOA:     4,
  PFOS:     4,
  PFNA:    10,
  PFHxS:   10,
  "HFPO-DA": 10,
};

// Colors for entry points — first entry point gets color[0], second gets color[1], etc.
const ENTRY_POINT_COLORS = [
  "#2563eb", // blue
  "#ec4899", // pink
  "#16a34a", // green
  "#d97706", // amber
  "#7c3aed", // purple
  "#0d9488", // teal
  "#ef4444", // red
  "#92400e", // brown
  "#0ea5e9", // sky
  "#84cc16", // lime
];


// ============================================================
//  STEP 1 — READ THE CSV FILE
//  Uses PapaParse to turn raw CSV text into an array of row objects.
//  Each row object has keys matching the CSV column headers.
// ============================================================

async function readCSV() {
  const raw = await window.fs.readFile(
    "NJ_American_Water_utilities_UCMR5_all.csv",
    { encoding: "utf8" }
  );

  const { data } = Papa.parse(raw, {
    header:        true,   // first row = column names
    dynamicTyping: true,   // numbers stay numbers, not strings
    skipEmptyLines: true,
  });

  return data;
}


// ============================================================
//  STEP 2 — FILTER OUT NON-DETECTS
//  Rows where AnalyticalResultsSign = "<" mean the lab
//  couldn't detect anything. We skip those entirely.
// ============================================================

function isDetected(row) {
  const sign  = (row.AnalyticalResultsSign || "").trim();
  const value = parseFloat(row.AnalyticalResultValue);

  if (sign === "<")       return false; // below detection limit
  if (isNaN(value))       return false; // no value at all
  if (value <= 0)         return false; // zero or negative = not real

  return true;
}


// ============================================================
//  STEP 3 — GROUP THE DATA
//
//  Build a nested structure:
//    grouped[PWSID][Contaminant][EntryPointName] = [
//      { date: "4/8/2024", value: 10.4 },
//      { date: "8/21/2024", value: 10.9 },
//    ]
//
//  Unit conversion: CSV stores values in µg/L
//  We multiply × 1000 to convert to ng/L (same unit as the MCL limits)
// ============================================================

function groupData(rows) {
  const grouped = {};

  rows.forEach(row => {

    // --- skip non-detects (Step 2) ---
    if (!isDetected(row)) return;

    // --- extract the fields we need ---
    const pwsid      = (row.PWSID           || "").trim();
    const contam     = (row.Contaminant      || "").trim();
    const entryPoint = (row.SamplePointName  || "Unknown").trim();
    const date       = (row.CollectionDate   || "").trim();
    const valueNgL   = parseFloat(row.AnalyticalResultValue) * 1000; // µg/L → ng/L

    if (!pwsid || !contam || !date) return; // skip incomplete rows

    // --- build the nested structure ---
    if (!grouped[pwsid])                       grouped[pwsid] = {};
    if (!grouped[pwsid][contam])               grouped[pwsid][contam] = {};
    if (!grouped[pwsid][contam][entryPoint])   grouped[pwsid][contam][entryPoint] = [];

    grouped[pwsid][contam][entryPoint].push({
      date,
      value: parseFloat(valueNgL.toFixed(2)),
    });
  });

  return grouped;
}


// ============================================================
//  STEP 4 — BUILD CHART DATA FOR ONE CONTAMINANT
//
//  Takes the entry point map for one contaminant and converts
//  it into the format Chart.js expects:
//  {
//    labels:   ["Feb 24", "Apr 24", ...],   ← X axis (all dates, sorted)
//    datasets: [                             ← one per entry point
//      { label: "Woodland Ave", data: [null, 10.4, 10.9, null] },
//      { label: "Mill Road",    data: [null,  8.8,  7.1, null] },
//    ]
//  }
//
//  If an entry point was NOT sampled on a given date → null
//  (Chart.js shows a gap instead of a zero)
// ============================================================

function buildChartData(entryPointMap) {

  // --- collect every unique date across all entry points, sorted chronologically ---
  const allDatesSet = new Set();
  Object.values(entryPointMap).forEach(points =>
    points.forEach(p => allDatesSet.add(p.date))
  );
  const allDates = [...allDatesSet].sort((a, b) => new Date(a) - new Date(b));

  // --- human-readable labels for the X axis ---
  const labels = allDates.map(d =>
    new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" })
  );

  // --- one dataset per entry point ---
  const datasets = Object.entries(entryPointMap).map(([epName, points], index) => {

    // build a quick lookup: date → value
    const valueByDate = {};
    points.forEach(p => { valueByDate[p.date] = p.value; });

    // for each date slot: use the value if sampled, null if not
    const data = allDates.map(date => valueByDate[date] ?? null);

    return {
      label:            epName,
      data,
      borderColor:      ENTRY_POINT_COLORS[index % ENTRY_POINT_COLORS.length],
      backgroundColor:  ENTRY_POINT_COLORS[index % ENTRY_POINT_COLORS.length] + "33",
      pointRadius:      5,
      pointHoverRadius: 7,
      borderWidth:      2,
      showLine:         false, // dots only — no connecting lines
      spanGaps:         false, // keep gaps where not sampled
    };
  });

  return { labels, datasets };
}


// ============================================================
//  STEP 5 — ADD THE MCL LINE
//  If the contaminant has a known MCL, add a flat red dashed
//  line dataset across all dates at that value.
// ============================================================

function buildMCLDataset(contaminant, numberOfDates) {
  const mcl = MCL_LIMITS[contaminant];
  if (!mcl) return null; // no MCL for this contaminant

  return {
    label:       `MCL = ${mcl} ng/L`,
    data:        Array(numberOfDates).fill(mcl), // flat line at MCL value
    borderColor: "#991b1b",
    borderDash:  [6, 3],
    borderWidth: 1.5,
    pointRadius: 0,     // no dots on the MCL line
    fill:        false,
    tension:     0,
    showLine:    true,  // the MCL line DOES connect (it's a reference line)
    order:       -1,    // draw behind the data
  };
}


// ============================================================
//  CHART COMPONENT
//  Renders one Chart.js chart for one contaminant.
// ============================================================

function ContaminantChart({ contaminant, entryPointMap }) {
  const canvasRef  = useRef(null);
  const chartRef   = useRef(null);

  const mcl        = MCL_LIMITS[contaminant] ?? null;
  const allValues  = Object.values(entryPointMap).flatMap(pts => pts.map(p => p.value));
  const maxValue   = allValues.length ? Math.max(...allValues) : 0;
  const exceedsMCL = mcl && allValues.some(v => v > mcl);

  useEffect(() => {
    if (!canvasRef.current) return;

    // destroy previous chart instance before creating a new one
    if (chartRef.current) chartRef.current.destroy();

    const { labels, datasets } = buildChartData(entryPointMap);
    const mclDataset           = buildMCLDataset(contaminant, labels.length);

    // Y axis ceiling: a bit above the highest value or 1.5× MCL, whichever is bigger
    const yMax = mcl
      ? Math.max(mcl * 1.5, maxValue * 1.15)
      : maxValue * 1.3 || 10;

    chartRef.current = new window.Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          ...(mclDataset ? [mclDataset] : []), // MCL line first (drawn behind)
          ...datasets,                          // then the data points
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend:  { display: false }, // we draw our own legend below
          tooltip: {
            callbacks: {
              label: item => {
                if (item.raw === null) return null; // hide null gaps in tooltip
                return ` ${item.dataset.label}: ${item.raw} ng/L`;
              },
            },
            filter: item => item.raw !== null,
          },
        },
        scales: {
          x: {
            ticks: { font: { size: 9 }, maxRotation: 45, autoSkip: false },
            grid:  { color: "rgba(0,0,0,0.05)" },
          },
          y: {
            min:   0,
            max:   parseFloat(yMax.toFixed(1)),
            title: { display: true, text: "ng/L", font: { size: 10 } },
            ticks: { font: { size: 9 } },
            grid:  { color: "rgba(0,0,0,0.05)" },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [contaminant, entryPointMap]);

  // --- border color: red if exceeds MCL, orange if has MCL but OK, blue if no MCL ---
  const borderColor = exceedsMCL ? "#ef4444" : mcl ? "#f97316" : "#3b82f6";

  return (
    <div style={{
      background:  "#fff",
      borderRadius: 10,
      padding:     "12px 14px",
      border:      `1px solid ${exceedsMCL ? "#fecaca" : "#e5e7eb"}`,
      borderTop:   `3px solid ${borderColor}`,
      boxShadow:   "0 1px 4px rgba(0,0,0,.07)",
    }}>

      {/* ── Title row ── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
        <span style={{ fontWeight:700, fontSize:12, color:"#0f172a" }}>{contaminant}</span>

        {mcl ? (
          <span style={{
            fontSize:9.5, fontWeight:700, padding:"1px 7px", borderRadius:4,
            background: exceedsMCL ? "#fef2f2" : "#fffbeb",
            color:      exceedsMCL ? "#b91c1c" : "#92400e",
          }}>
            {exceedsMCL
              ? `⚠ Exceeds MCL (${mcl} ng/L) — max ${maxValue.toFixed(1)}`
              : `MCL = ${mcl} ng/L`
            }
          </span>
        ) : (
          <span style={{ fontSize:9.5, background:"#f1f5f9", color:"#64748b", padding:"1px 7px", borderRadius:4 }}>
            No MCL
          </span>
        )}

        <span style={{ fontSize:9, color:"#94a3b8", marginLeft:"auto" }}>
          {Object.keys(entryPointMap).length} entry point{Object.keys(entryPointMap).length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Chart canvas ── */}
      <div style={{ position:"relative", height:190 }}>
        <canvas ref={canvasRef} />
      </div>

      {/* ── Legend: one colored square per entry point ── */}
      <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:"4px 10px" }}>
        {mcl && (
          <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color:"#64748b" }}>
            <span style={{ width:16, height:0, borderTop:"2px dashed #991b1b", display:"inline-block" }} />
            MCL = {mcl}
          </span>
        )}
        {Object.keys(entryPointMap).map((epName, i) => (
          <span key={epName} style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color:"#374151" }}>
            <span style={{
              width:9, height:9, borderRadius:2,
              background: ENTRY_POINT_COLORS[i % ENTRY_POINT_COLORS.length],
              display:"inline-block", flexShrink:0,
            }} />
            {epName}
          </span>
        ))}
      </div>
    </div>
  );
}


// ============================================================
//  MAIN APP
// ============================================================

export default function App() {
  const [allData,    setAllData]    = useState(null);   // grouped data for all utilities
  const [utilities,  setUtilities]  = useState([]);     // list of {id, name} for the dropdown
  const [selectedId, setSelectedId] = useState(null);   // currently selected PWSID
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [chartReady, setChartReady] = useState(false);

  // --- Load Chart.js from CDN once ---
  useEffect(() => {
    if (window.Chart) { setChartReady(true); return; }
    const script    = document.createElement("script");
    script.src      = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    script.onload   = () => setChartReady(true);
    script.onerror  = () => setError("Failed to load Chart.js");
    document.head.appendChild(script);
  }, []);

  // --- Read + parse CSV on mount ---
  useEffect(() => {
    async function load() {
      try {
        const rows    = await readCSV();               // Step 1
        const grouped = groupData(rows);               // Steps 2 + 3

        // build sorted utility list from the data itself
        const utilityMap = {};
        rows.forEach(r => {
          if (r.PWSID && r.PWSName) utilityMap[r.PWSID.trim()] = r.PWSName.trim();
        });
        const utilityList = Object.entries(utilityMap)
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setAllData(grouped);
        setUtilities(utilityList);
        if (utilityList.length) setSelectedId(utilityList[0].id);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // --- data for the currently selected utility ---
  const utilityData    = (selectedId && allData?.[selectedId]) ?? {};
  const selectedName   = utilities.find(u => u.id === selectedId)?.name ?? "";

  // --- sort contaminants: those WITH an MCL first (by max value), then no-MCL ---
  const sortedContaminants = Object.keys(utilityData).sort((a, b) => {
    const aHasMCL = MCL_LIMITS[a] ? 1 : 0;
    const bHasMCL = MCL_LIMITS[b] ? 1 : 0;
    if (aHasMCL !== bHasMCL) return bHasMCL - aHasMCL;
    const maxOf = name => Math.max(
      ...Object.values(utilityData[name]).flatMap(pts => pts.map(p => p.value))
    );
    return maxOf(b) - maxOf(a);
  });

  const noDetections = sortedContaminants.length === 0;

  return (
    <div style={{ fontFamily:"'Segoe UI',Arial,sans-serif", background:"#f0f4f8", minHeight:"100vh", padding:16 }}>

      {/* ── Header ── */}
      <div style={{
        background:"#14213d", color:"#60a5fa",
        padding:"10px 16px", borderRadius:8, marginBottom:14,
        display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
      }}>
        <div>
          <div style={{ fontWeight:700, fontSize:13 }}>⚗ PFAS Charts — EPA UCMR5</div>
          <div style={{ fontSize:10, color:"#4a6898", marginTop:2 }}>
            Non-detects excluded · µg/L → ng/L (×1000) · Dots only — no connecting lines
          </div>
        </div>

        {/* Utility selector */}
        <select
          value={selectedId ?? ""}
          onChange={e => setSelectedId(e.target.value)}
          style={{
            marginLeft:"auto", padding:"5px 10px", borderRadius:6,
            border:"1px solid #1e3058", background:"#1e3058",
            color:"#b8c8e8", fontSize:11, cursor:"pointer", maxWidth:360,
          }}
        >
          {utilities.map(u => (
            <option key={u.id} value={u.id}>{u.name} — {u.id}</option>
          ))}
        </select>
      </div>

      {/* ── Status messages ── */}
      {loading && (
        <div style={{ textAlign:"center", padding:60, color:"#64748b" }}>⏳ Reading CSV...</div>
      )}
      {error && (
        <div style={{ background:"#fef2f2", borderRadius:8, padding:16, color:"#b91c1c" }}>
          ❌ Error: {error}
        </div>
      )}

      {/* ── Utility summary bar ── */}
      {!loading && !error && selectedId && (
        <div style={{
          background:"#fff", borderRadius:8, padding:"9px 14px",
          marginBottom:12, boxShadow:"0 1px 3px rgba(0,0,0,.07)",
          display:"flex", alignItems:"center", gap:10, flexWrap:"wrap",
        }}>
          <strong style={{ fontSize:12 }}>{selectedName}</strong>
          <span style={{ fontFamily:"monospace", fontSize:10, color:"#64748b" }}>{selectedId}</span>
          <span style={{ background:"#dbeafe", color:"#1d4ed8", padding:"1px 7px", borderRadius:3, fontSize:9, fontWeight:700 }}>
            UCMR5
          </span>
          {noDetections
            ? <span style={{ color:"#15803d", fontWeight:600, fontSize:11 }}>✅ No detected PFAS</span>
            : <span style={{ fontSize:11, color:"#64748b" }}>{sortedContaminants.length} contaminants detected</span>
          }
        </div>
      )}

      {/* ── No detections box ── */}
      {!loading && !error && noDetections && (
        <div style={{
          background:"#f0fdf4", border:"2px solid #86efac",
          borderRadius:10, padding:24, textAlign:"center", maxWidth:440, margin:"20px auto",
        }}>
          <div style={{ fontWeight:800, fontSize:15, color:"#15803d" }}>✅ No PFAS Detected</div>
          <div style={{ fontSize:11, color:"#16a34a", marginTop:5 }}>All samples below MRL for this utility.</div>
        </div>
      )}

      {/* ── Charts grid ── */}
      {!loading && !error && chartReady && !noDetections && (
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(360px, 1fr))",
          gap:12,
        }}>
          {sortedContaminants.map(contam => (
            <ContaminantChart
              key={selectedId + contam}
              contaminant={contam}
              entryPointMap={utilityData[contam]}
            />
          ))}
        </div>
      )}

      {!loading && !error && !chartReady && (
        <div style={{ textAlign:"center", padding:40, color:"#64748b" }}>⏳ Loading chart library...</div>
      )}
    </div>
  );
}
