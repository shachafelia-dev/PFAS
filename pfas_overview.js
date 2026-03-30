import { useState, useEffect } from "react";
import Papa from "papaparse";

// ============================================================
//  CONFIGURATION
// ============================================================

const MCL_LIMITS = {
  PFOA:      4,
  PFOS:      4,
  PFNA:     10,
  PFHxS:    10,
  "HFPO-DA": 10,
};

// CCR-only utilities (not in UCMR5 CSV) — data entered manually from CCR 2024 reports
const CCR_UTILITIES = [
  { name:"Four Seasons at Chester", id:"NJ1407001", county:"Morris",    pop:500,   approx:true,  pfoa:"ND – 9.0", pfos:"ND – 8.0", maxVal:9.0,  status:"exceeds" },
  { name:"West Jersey",             id:"NJ1427009", county:"Morris",    pop:2000,  approx:true,  pfoa:"ND – 9.0", pfos:"ND – 8.0", maxVal:9.0,  status:"exceeds" },
  { name:"Shrewsbury - AVMA",       id:"NJ1346001", county:"Monmouth",  pop:1000,  approx:true,  pfoa:"4.5–6.8",  pfos:"2.5–2.7",  maxVal:6.8,  status:"exceeds" },
  { name:"South Orange Village",    id:"NJ0719001", county:"Essex",     pop:16587, approx:false, pfoa:"ND – 6.0", pfos:"ND – 3.0", maxVal:6.0,  status:"exceeds" },
  { name:"Twin Lakes",              id:"NJ1803002", county:"Somerset",  pop:120,   approx:false, pfoa:"ND – 6.0", pfos:"ND – 5.0", maxVal:6.0,  status:"exceeds" },
  { name:"Salem",                   id:"NJ1712001", county:"Salem",     pop:5000,  approx:true,  pfoa:"4.1–5.6",  pfna:"2.9–5.1",  maxVal:5.6,  status:"exceeds" },
  { name:"Bridgeport",              id:"NJ0809001", county:"Gloucester",pop:500,   approx:true,  pfoa:"ND – 3.9",                   maxVal:3.9,  status:"detected" },
  { name:"Frenchtown",              id:"NJ1011001", county:"Hunterdon", pop:1500,  approx:true,  pfoa:"ND – 3.0", pfos:"ND – 2.0", maxVal:3.0,  status:"detected" },
  { name:"Belvidere",               id:"NJ2103001", county:"Warren",    pop:2644,  approx:false, pfoa:"NA",                         maxVal:0,    status:"nd" },
  { name:"Crossroads at Oldwick",   id:"NJ1024001", county:"Hunterdon", pop:200,   approx:true,  pfoa:"NA",                         maxVal:0,    status:"nd" },
  { name:"Deep Run",                id:"NJ1523002", county:"Ocean",     pop:300,   approx:true,                                    maxVal:0,    status:"nodata" },
  { name:"Egg Harbor City",         id:"NJ0107001", county:"Atlantic",  pop:3180,  approx:false,                                   maxVal:0,    status:"nodata" },
  { name:"Homestead",               id:"NJ0318002", county:"Burlington",pop:1765,  approx:false,                                   maxVal:0,    status:"nodata" },
  { name:"New Egypt",               id:"NJ1523003", county:"Ocean",     pop:704,   approx:false,                                   maxVal:0,    status:"nodata" },
  { name:"Strathmere",              id:"NJ0511001", county:"Cape May",  pop:400,   approx:true,                                    maxVal:0,    status:"nodata" },
  { name:"Sunbury",                 id:"NJ0329006", county:"Burlington",pop:200,   approx:true,                                    maxVal:0,    status:"nodata" },
  { name:"Vincentown",              id:"NJ0333004", county:"Burlington",pop:132,   approx:false,                                   maxVal:0,    status:"nodata" },
];


// ============================================================
//  STEP 1 — READ + PARSE THE CSV
//  Returns raw rows as array of objects
// ============================================================

async function readCSV() {
  const raw = await window.fs.readFile(
    "NJ_American_Water_utilities_UCMR5_all.csv",
    { encoding: "utf8" }
  );
  const { data } = Papa.parse(raw, {
    header: true, dynamicTyping: true, skipEmptyLines: true,
  });
  return data;
}


// ============================================================
//  STEP 2 — SUMMARIZE UCMR5 UTILITIES FROM CSV
//
//  For each PWSID in the CSV we want to know:
//  - Utility name
//  - County (not in CSV — we'll leave blank, can add later)
//  - Population (not in CSV — same)
//  - For each contaminant: was it detected? what was the max value?
//
//  We skip non-detects (sign = "<") just like in the charts code.
// ============================================================

function summarizeUCMR5(rows) {
  const utilities = {}; // keyed by PWSID

  rows.forEach(row => {
    const pwsid  = (row.PWSID    || "").trim();
    const name   = (row.PWSName  || "").trim();
    const contam = (row.Contaminant || "").trim();
    const sign   = (row.AnalyticalResultsSign || "").trim();
    const valRaw = parseFloat(row.AnalyticalResultValue);

    if (!pwsid || !contam) return;

    // initialise utility record if first time we see this PWSID
    if (!utilities[pwsid]) {
      utilities[pwsid] = {
        id:           pwsid,
        name:         name,
        source:       "UCMR5",
        contaminants: {}, // contam → { maxVal, detected }
      };
    }

    // track every contaminant we've seen (even non-detects)
    if (!utilities[pwsid].contaminants[contam]) {
      utilities[pwsid].contaminants[contam] = { maxVal: 0, detected: false };
    }

    // only process detected values
    if (sign === "<" || isNaN(valRaw) || valRaw <= 0) return;

    const valNgL = parseFloat((valRaw * 1000).toFixed(2)); // µg/L → ng/L
    const entry  = utilities[pwsid].contaminants[contam];

    entry.detected = true;
    if (valNgL > entry.maxVal) entry.maxVal = valNgL;
  });

  return utilities;
}


// ============================================================
//  STEP 3 — COMPUTE DISPLAY FIELDS FOR EACH UCMR5 UTILITY
//
//  From the raw summary we derive what to show in the table:
//  - worstContaminant: the detected contaminant with the highest max value
//  - maxVal: that contaminant's max value
//  - exceedsMCL: true if maxVal > MCL for that contaminant
//  - overallStatus: "exceeds" | "detected" | "none"
// ============================================================

function computeDisplayFields(utilitySummary) {
  return Object.values(utilitySummary).map(u => {
    const detected = Object.entries(u.contaminants)
      .filter(([contam, v]) => v.detected && MCL_LIMITS[contam]) // only MCL contaminants
      .map(([contam, v]) => ({
        contam,
        maxVal: v.maxVal,
        mcl:    MCL_LIMITS[contam] ?? null,
      }))
      .sort((a, b) => b.maxVal - a.maxVal); // highest first

    if (detected.length === 0) {
      // nothing detected above MRL
      return { ...u, worstContam:"—", maxVal:0, exceedsMCL:false, status:"none" };
    }

    const worst     = detected[0];
    const exceedsMCL = worst.mcl !== null && worst.maxVal > worst.mcl;

    return {
      ...u,
      worstContam: worst.contam,
      maxVal:      worst.maxVal,
      exceedsMCL,
      status: exceedsMCL ? "exceeds" : "detected",
    };
  });
}


// ============================================================
//  HELPER — STATUS BADGE
// ============================================================

function StatusBadge({ status, exceedsMCL, maxVal }) {
  if (status === "none")
    return <span style={badge("#f1f5f9","#475569")}>✓ No PFAS</span>;
  if (status === "nodata")
    return <span style={badge("#f9fafb","#374151")}>No CCR Data</span>;
  if (status === "nd")
    return <span style={badge("#f1f5f9","#475569")}>✓ ND / NA</span>;
  if (status === "detected" && !exceedsMCL)
    return <span style={badge("#f0fdf4","#15803d")}>✓ Below MCL</span>;
  if (status === "exceeds" || exceedsMCL)
    return <span style={badge(maxVal>=7?"#fef2f2":"#fff7ed", maxVal>=7?"#b91c1c":"#c2410c")}>
      ⚠ Exceeds MCL
    </span>;
  return <span style={badge("#f0fdf4","#15803d")}>✓ Detected</span>;
}

function badge(bg, color) {
  return { background:bg, color, padding:"1px 6px", borderRadius:5,
           fontSize:9.5, fontWeight:700, display:"inline-block" };
}

function SourceBadge({ source }) {
  return source === "UCMR5"
    ? <span style={{ background:"#dbeafe",color:"#1d4ed8",padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700 }}>UCMR5</span>
    : <span style={{ background:"#fef9c3",color:"#92400e",padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700 }}>CCR 2024</span>;
}


// ============================================================
//  SUMMARY CARDS — top 3 numbers
// ============================================================

function SummaryCards({ rows }) {
  const exceed  = rows.filter(r => r.status==="exceeds" || r.exceedsMCL).length;
  const rest    = rows.length - exceed;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
      {[
        { value:rows.length, label:"Total NJAW utilities",              color:"#3b82f6" },
        { value:exceed,      label:"Exceed MCL (13 UCMR5 + 6 CCR)",    color:"#ef4444" },
        { value:rest,        label:"Below MCL / ND / No data",          color:"#22c55e" },
      ].map(c => (
        <div key={c.label} style={{
          background:"#fff", borderRadius:8, padding:"10px 13px",
          borderTop:`3px solid ${c.color}`, boxShadow:"0 1px 3px rgba(0,0,0,.07)",
        }}>
          <div style={{ fontSize:22, fontWeight:800, color:"#0f172a" }}>{c.value}</div>
          <div style={{ fontSize:9.5, color:"#64748b", marginTop:3 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}


// ============================================================
//  OVERVIEW TABLE
// ============================================================

function OverviewTable({ rows }) {
  const headers = ["#","Utility","PWSID","County","Highest PFAS Detected","Max (ng/L)","× MCL","Pop.","Status","Source"];

  return (
    <div style={{ overflowX:"auto", background:"#fff", borderRadius:8, boxShadow:"0 1px 3px rgba(0,0,0,.07)" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10.5 }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{
                background:"#14213d", color:"#b8c8e8",
                padding:"7px 9px", textAlign:"left",
                fontWeight:600, fontSize:9.5, whiteSpace:"nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const mcl    = row.worstContam ? (MCL_LIMITS[row.worstContam] ?? null) : null;
            const ratio  = (mcl && row.maxVal > 0) ? (row.maxVal / mcl).toFixed(1) + "×" : "—";
            const popTxt = (row.approx ? "~" : "") + (row.pop ?? "—").toLocaleString();

            return (
              <tr key={row.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                <td style={{ padding:"5px 9px", color:"#94a3b8", fontSize:9 }}>{i+1}</td>
                <td style={{ padding:"5px 9px" }}><strong style={{ fontSize:10 }}>{row.name}</strong></td>
                <td style={{ padding:"5px 9px", fontFamily:"monospace", fontSize:9.5, color:"#64748b" }}>{row.id}</td>
                <td style={{ padding:"5px 9px", fontSize:10 }}>{row.county ?? "—"}</td>
                <td style={{ padding:"5px 9px" }}>
                  {row.worstContam && row.worstContam !== "—"
                    ? <b style={{ color:"#185FA5" }}>{row.worstContam}</b>
                    : <span style={{ color:"#94a3b8" }}>—</span>
                  }
                  {/* CCR: show range in small text */}
                  {row.source === "CCR 2024" && row.pfoa &&
                    <span style={{ fontSize:8.5, color:"#64748b", marginLeft:4 }}>({row.pfoa})</span>
                  }
                </td>
                <td style={{ padding:"5px 9px" }}>
                  {row.maxVal > 0
                    ? <span style={{
                        background: row.maxVal>=9?"#fef2f2":row.maxVal>=6?"#fff7ed":"#f0fdf4",
                        color:      row.maxVal>=9?"#b91c1c":row.maxVal>=6?"#c2410c":"#15803d",
                        padding:"1px 6px", borderRadius:4, fontWeight:700, fontSize:9.5,
                      }}>{row.maxVal}</span>
                    : <span style={{ color:"#94a3b8" }}>—</span>
                  }
                </td>
                <td style={{ padding:"5px 9px", fontWeight:700, fontSize:10,
                  color: row.maxVal>=9?"#b91c1c":row.maxVal>=6?"#c2410c":row.maxVal>0?"#15803d":"#94a3b8" }}>
                  {ratio}
                </td>
                <td style={{ padding:"5px 9px", fontSize:10 }}>{popTxt}</td>
                <td style={{ padding:"5px 9px" }}>
                  <StatusBadge status={row.status} exceedsMCL={row.exceedsMCL} maxVal={row.maxVal}/>
                </td>
                <td style={{ padding:"5px 9px" }}>
                  <SourceBadge source={row.source}/>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


// ============================================================
//  MAIN APP
// ============================================================

export default function App() {
  const [tableRows, setTableRows] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    async function load() {
      try {
        // 1. read CSV
        const rows = await readCSV();

        // 2+3. summarize UCMR5 utilities from CSV
        const summary  = summarizeUCMR5(rows);
        const ucmr5    = computeDisplayFields(summary);

        // 4. build CCR rows from the hardcoded config above
        const ccrRows = CCR_UTILITIES.map(u => ({
          id:          u.id,
          name:        "NJAW — " + u.name,
          source:      "CCR 2024",
          county:      u.county,
          pop:         u.pop,
          approx:      u.approx,
          worstContam: u.pfoa ? "PFOA" : u.pfna ? "PFNA" : "—",
          maxVal:      u.maxVal,
          exceedsMCL:  u.status === "exceeds",
          status:      u.status,
          pfoa:        u.pfoa,
          pfna:        u.pfna,
        }));

        // 5. merge + sort by maxVal descending
        const allRows = [...ucmr5, ...ccrRows]
          .sort((a, b) => b.maxVal - a.maxVal);

        setTableRows(allRows);
      } catch(e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ fontFamily:"'Segoe UI',Arial,sans-serif", background:"#f0f4f8", minHeight:"100vh", padding:16 }}>

      {/* Header */}
      <div style={{
        background:"#14213d", color:"#60a5fa",
        padding:"10px 16px", borderRadius:8, marginBottom:14,
        display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
      }}>
        <div>
          <div style={{ fontWeight:700, fontSize:13 }}>⚗ PFAS Watch — NJ American Water</div>
          <div style={{ fontSize:10, color:"#4a6898", marginTop:2 }}>
            UCMR5 data from CSV · CCR 2024 data from annual reports · Sorted by max concentration
          </div>
        </div>
        <span style={{
          marginLeft:"auto", background:"#fef2f2", color:"#b91c1c",
          border:"1px solid #fecaca", borderRadius:5, padding:"2px 8px", fontSize:9.5, fontWeight:700,
        }}>
          ⚠ 13 UCMR5 + 6 CCR = 19 utilities exceed MCL
        </span>
      </div>

      {loading && <div style={{ textAlign:"center", padding:60, color:"#64748b" }}>⏳ Reading CSV...</div>}
      {error   && <div style={{ background:"#fef2f2", borderRadius:8, padding:16, color:"#b91c1c" }}>❌ {error}</div>}

      {!loading && !error && (
        <>
          {/* source note */}
          <div style={{
            background:"#fffbeb", border:"2px solid #fcd34d", borderRadius:10,
            padding:"12px 16px", marginBottom:14, fontSize:11, color:"#78350f", lineHeight:1.7,
          }}>
            ⚠ <strong>Two data sources:</strong>&nbsp;
            (1) <strong>EPA UCMR5</strong> — federally mandated, lab-verified, values read directly from CSV.&nbsp;
            (2) <strong>CCR 2024</strong> — utility self-reported annual reports, values entered manually (ranges, not single points).
            CCR values are <em>not directly comparable</em> to UCMR5 measurements.
          </div>

          {/* summary cards */}
          <SummaryCards rows={tableRows}/>

          {/* table */}
          <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:8 }}>
            All 36 NJ American Water Utilities — Sorted by Max Concentration (Highest → Lowest)
          </div>
          <OverviewTable rows={tableRows}/>

          <div style={{ marginTop:8, fontSize:9.5, color:"#94a3b8" }}>
            † Population estimated from CCR daily usage or census. ~ = approximate.
            ND = Non-Detect. NA = Not Applicable. CCR ranges = min–max across all 2024 sampling points.
            MCL: PFOA = 4 ng/L · PFOS = 4 ng/L · PFNA = 10 ng/L.
          </div>
        </>
      )}
    </div>
  );
}
