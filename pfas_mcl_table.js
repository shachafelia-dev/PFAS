// ============================================================
//  CONFIGURATION
// ============================================================

// EPA MCL limits in ng/L
const MCL_LIMITS = { PFOA: 4, PFOS: 4, PFNA: 10, PFHxS: 10 };

// ============================================================
//  DATA — 19 utilities exceeding MCL, sorted by max value desc
// ============================================================
const UTILITIES = [
  { name:"Camden City Water Dept (NJAW)", id:"NJ0408001", contam:"PFOS",             mx:12.9, pop:71000,  approx:true,  county:"Camden",           src:"UCMR5"   },
  { name:"NJAW — Atlantic County",        id:"NJ0119002", contam:"PFOA",             mx:10.9, pop:112076, approx:false, county:"Atlantic",          src:"UCMR5"   },
  { name:"NJAW — Short Hills",            id:"NJ0712001", contam:"PFOA",             mx:9.1,  pop:217230, approx:false, county:"Essex",             src:"UCMR5"   },
  { name:"NJAW — Four Seasons at Chester",id:"NJ1407001", contam:"PFOA (max range)", mx:9.0,  pop:500,    approx:true,  county:"Morris",            src:"CCR 2024"},
  { name:"NJAW — West Jersey",            id:"NJ1427009", contam:"PFOA (max range)", mx:9.0,  pop:2000,   approx:true,  county:"Morris",            src:"CCR 2024"},
  { name:"NJAW — Coastal North",          id:"NJ1345001", contam:"PFOA",             mx:7.5,  pop:375857, approx:false, county:"Monmouth/Ocean",    src:"UCMR5"   },
  { name:"NJAW — Raritan",                id:"NJ2004002", contam:"PFOA",             mx:7.5,  pop:736791, approx:false, county:"Somerset/Middlesex",src:"UCMR5"   },
  { name:"NJAW — ITC (Mt. Olive)",        id:"NJ1427017", contam:"PFOA",             mx:7.3,  pop:1750,   approx:true,  county:"Morris",            src:"UCMR5"   },
  { name:"NJAW — Washington / Oxford",    id:"NJ2121001", contam:"PFOS",             mx:7.1,  pop:10133,  approx:false, county:"Warren",            src:"UCMR5"   },
  { name:"NJAW — Shrewsbury - AVMA",      id:"NJ1346001", contam:"PFOA (max range)", mx:6.8,  pop:1000,   approx:true,  county:"Monmouth",          src:"CCR 2024"},
  { name:"NJAW — Shorelands",             id:"NJ1339001", contam:"PFOA",             mx:6.5,  pop:31908,  approx:false, county:"Monmouth",          src:"UCMR5"   },
  { name:"NJAW — Union Beach",            id:"NJ1350001", contam:"PFOA",             mx:6.2,  pop:5380,   approx:false, county:"Monmouth",          src:"UCMR5"   },
  { name:"NJAW — South Orange Village",   id:"NJ0719001", contam:"PFOA (max range)", mx:6.0,  pop:16587,  approx:false, county:"Essex",             src:"CCR 2024"},
  { name:"NJAW — Twin Lakes",             id:"NJ1803002", contam:"PFOA (max range)", mx:6.0,  pop:120,    approx:false, county:"Somerset",          src:"CCR 2024"},
  { name:"NJAW — Salem",                  id:"NJ1712001", contam:"PFOA (max range)", mx:5.6,  pop:5000,   approx:true,  county:"Salem",             src:"CCR 2024"},
  { name:"NJAW — Mount Holly",            id:"NJ0323001", contam:"PFOA",             mx:4.8,  pop:34733,  approx:false, county:"Burlington",        src:"UCMR5"   },
  { name:"NJAW — Liberty (Elizabeth)",    id:"NJ2004001", contam:"PFOA",             mx:4.5,  pop:128124, approx:false, county:"Union",             src:"UCMR5"   },
  { name:"NJAW — Little Falls",           id:"NJ1605001", contam:"PFOA",             mx:4.5,  pop:16675,  approx:false, county:"Passaic",           src:"UCMR5"   },
  { name:"NJAW — Logan",                  id:"NJ0809002", contam:"PFOA",             mx:4.2,  pop:3762,   approx:false, county:"Gloucester",        src:"UCMR5"   },
];


// ============================================================
//  HELPERS
// ============================================================

// Bar color based on severity — 3 levels only
// Red:    ≥ 2× MCL  (mx ≥ 8)
// Yellow: 1.5–2× MCL (mx 6–8)
// Green:  just over MCL (mx 4–6)
function barColor(mx) {
  if (mx >= 8) return "#dc2626"; // red
  if (mx >= 6) return "#eab308"; // yellow
  return "#16a34a";              // green
}

function ratioColor(mx) {
  if (mx >= 8) return "#dc2626";
  if (mx >= 6) return "#eab308";
  return "#16a34a";
}

// Source badge
function SourceBadge({ src }) {
  const isUCMR5 = src === "UCMR5";
  return (
    <span style={{
      background: isUCMR5 ? "#dbeafe" : "#fef9c3",
      color:      isUCMR5 ? "#1d4ed8" : "#92400e",
      padding: "1px 7px", borderRadius: 3,
      fontSize: 9, fontWeight: 700, display:"inline-block",
    }}>
      {src}
    </span>
  );
}

// Concentration cell with mini bar
function ConcCell({ mx }) {
  const mcl   = 4; // all entries here are PFOA/PFOS
  const pct   = Math.min(100, (mx / 13) * 100); // scale to Camden (12.9) as max
  const color = barColor(mx);

  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <span style={{
        minWidth: 34, fontWeight: 700, fontSize: 10.5,
        color: color,
      }}>{mx}</span>
      <div style={{ width:70, height:5, background:"#e5e7eb", borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:3 }}/>
      </div>
      <span style={{ fontSize:8.5, color:"#94a3b8", whiteSpace:"nowrap" }}>MCL={mcl}</span>
    </div>
  );
}


// ============================================================
//  TABLE COMPONENT
// ============================================================
function MCLTable() {
  const headers = ["#","Utility","PWSID","Contaminant","Max Conc. (ng/L)","× MCL","Est. Pop.","County","Source"];

  return (
    <div style={{ overflowX:"auto", background:"#fff", borderRadius:8, boxShadow:"0 1px 4px rgba(0,0,0,.08)" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10.5 }}>

        {/* ── Header ── */}
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{
                background:"#14213d", color:"#b8c8e8",
                padding:"8px 10px", textAlign:"left",
                fontWeight:600, fontSize:9.5, whiteSpace:"nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>

        {/* ── Rows ── */}
        <tbody>
          {UTILITIES.map((u, i) => {
            const mcl   = MCL_LIMITS[u.contam.replace(" (max range)","")] ?? 4;
            const ratio = (u.mx / mcl).toFixed(1) + "×";
            const pop   = (u.approx ? "~" : "") + u.pop.toLocaleString();

            return (
              <tr key={u.id} style={{ borderBottom:"1px solid #f1f5f9" }}
                onMouseEnter={e => e.currentTarget.style.background="#f8faff"}
                onMouseLeave={e => e.currentTarget.style.background=""}>

                {/* # */}
                <td style={{ padding:"7px 10px", color:"#94a3b8", fontSize:9 }}>{i + 1}</td>

                {/* Utility name */}
                <td style={{ padding:"7px 10px" }}>
                  <strong style={{ fontSize:10.5 }}>{u.name}</strong>
                </td>

                {/* PWSID */}
                <td style={{ padding:"7px 10px", fontFamily:"monospace", fontSize:9.5, color:"#64748b" }}>
                  {u.id}
                </td>

                {/* Contaminant */}
                <td style={{ padding:"7px 10px" }}>
                  <b style={{ color:"#185FA5", fontSize:10.5 }}>{u.contam}</b>
                </td>

                {/* Max concentration + bar */}
                <td style={{ padding:"7px 10px" }}>
                  <ConcCell mx={u.mx}/>
                </td>

                {/* × MCL ratio */}
                <td style={{ padding:"7px 10px", fontWeight:700, fontSize:10.5, color:ratioColor(u.mx) }}>
                  {ratio}
                </td>

                {/* Population */}
                <td style={{ padding:"7px 10px", fontSize:10.5 }}>{pop}</td>

                {/* County */}
                <td style={{ padding:"7px 10px", fontSize:10.5 }}>{u.county}</td>

                {/* Source */}
                <td style={{ padding:"7px 10px" }}>
                  <SourceBadge src={u.src}/>
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
  const ucmr5Count = UTILITIES.filter(u => u.src === "UCMR5").length;
  const ccrCount   = UTILITIES.filter(u => u.src === "CCR 2024").length;

  return (
    <div style={{ fontFamily:"'Segoe UI',Arial,sans-serif", background:"#f0f4f8", minHeight:"100vh", padding:16 }}>

      {/* ── Header ── */}
      <div style={{
        background:"#14213d", color:"#60a5fa",
        padding:"10px 16px", borderRadius:8, marginBottom:14,
        display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
      }}>
        <div>
          <div style={{ fontWeight:700, fontSize:13 }}>⚗ PFAS Watch — NJ American Water</div>
          <div style={{ fontSize:10, color:"#4a6898", marginTop:2 }}>
            MCL Exceedances · {ucmr5Count} UCMR5 utilities + {ccrCount} CCR 2024 utilities
          </div>
        </div>
        <span style={{
          marginLeft:"auto",
          background:"#fef2f2", color:"#b91c1c",
          border:"1px solid #fecaca", borderRadius:5,
          padding:"3px 10px", fontSize:10, fontWeight:700,
        }}>
          ⚠ {UTILITIES.length} utilities exceed EPA MCL
        </span>
      </div>

      {/* ── Source note ── */}
      <div style={{
        background:"#fffbeb", border:"2px solid #fcd34d", borderRadius:10,
        padding:"12px 16px", marginBottom:14, fontSize:11, color:"#78350f", lineHeight:1.7,
      }}>
        ⚠ <strong>Mixed sources:</strong>&nbsp;
        <strong>UCMR5</strong> = EPA federally mandated, lab-verified, single-point measurements.&nbsp;
        <strong>CCR 2024</strong> = utility self-reported annual report, values shown as max of reported range.
        CCR values are <em>not directly comparable</em> to UCMR5 measurements.
      </div>

      {/* ── Table title ── */}
      <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:8 }}>
        19 NJ American Water Utilities — Exceeding EPA MCL · Sorted by Max Concentration
      </div>

      {/* ── Table ── */}
      <MCLTable/>

      {/* ── Footer note ── */}
      <div style={{ marginTop:8, fontSize:9.5, color:"#94a3b8" }}>
        † Population estimated from CCR daily usage or census. ~ = approximate.
        MCL: PFOA = 4 ng/L · PFOS = 4 ng/L · PFNA = 10 ng/L.
        CCR values = max of reported range across all 2024 sampling points.
      </div>

    </div>
  );
}
