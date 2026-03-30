// ============================================================
//  pfas_charts.js
//  Reads the UCMR5 CSV and renders Chart.js charts into
//  utility panels when the user clicks them in the sidebar.
//
//  Depends on:
//    - pfas_data.js  (MCL_LIMITS, CSV_PATH)
//    - PapaParse     (loaded in pfas_watch.html)
//    - Chart.js      (loaded in pfas_watch.html)
// ============================================================


// ── Maps sidebar panel ID → PWSID in the CSV ──────────────
const PANEL_TO_PWSID = {
  camden:       'NJ0408001',
  atlantic:     'NJ0119002',
  shorthills:   'NJ0712001',
  coastalnorth: 'NJ1345001',
  raritan:      'NJ2004002',
  itc:          'NJ1427017',
  washox:       'NJ2121001',
  shorelands:   'NJ1339001',
  unionbeach:   'NJ1350001',
  mountholly:   'NJ0323001',
  liberty:      'NJ2004001',
  littlefalls:  'NJ1605001',
  logan:        'NJ0809002',
  western:      'NJ0327001',
  // no-detect panels — no charts needed
  // harrison, capemay, oceancity, pennsgrove, roxbury
};

// Colors for entry points inside each chart
const EP_COLORS = [
  '#2563eb','#ec4899','#16a34a','#d97706','#7c3aed',
  '#0d9488','#ef4444','#92400e','#0ea5e9','#84cc16',
];

// ── State ─────────────────────────────────────────────────
let csvData       = null;    // parsed + grouped data (filled after CSV loads)
let csvLoadState  = 'idle';  // idle | loading | ready | error
let pendingPanel  = null;    // panel waiting while CSV loads
const chartInstances = {};   // panelId → [Chart, ...] for cleanup on re-open


// ============================================================
//  STEP 1 — FETCH + PARSE CSV
//  Called automatically when the script loads.
// ============================================================

function loadCSV() {
  if (csvLoadState === 'loading' || csvLoadState === 'ready') return;
  csvLoadState = 'loading';

  fetch(CSV_PATH)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(raw => {
      csvData      = parseAndGroupCSV(raw);
      csvLoadState = 'ready';
      // Debug: show how many utilities were parsed
      console.log('[pfas_charts] Parsed utilities:', Object.keys(csvData));
      console.log('[pfas_charts] Atlantic County data:', csvData['NJ0119002'] ? Object.keys(csvData['NJ0119002']) : 'NOT FOUND');
      // if user clicked a panel while loading — render it now
      if (pendingPanel) {
        renderChartsForPanel(pendingPanel);
        pendingPanel = null;
      }
    })
    .catch(err => {
      csvLoadState = 'error';
      console.error('[pfas_charts] CSV load failed:', err);
      if (pendingPanel) {
        showError(pendingPanel, err.message);
        pendingPanel = null;
      }
    });
}


// ============================================================
//  STEP 2 — PARSE CSV + GROUP DATA
//
//  Builds:
//  grouped[PWSID][Contaminant][EntryPointLabel] = [
//    { date, value }
//  ]
//
//  - Skips non-detects (sign = "<")
//  - Converts µg/L → ng/L (× 1000)
//  - Uses FacilityName when SamplePointName is generic
//    (e.g. "Entry Point to Dist. System" appears for many facilities)
// ============================================================

function parseAndGroupCSV(raw) {
  const { data } = Papa.parse(raw, {
    header: true, dynamicTyping: true, skipEmptyLines: true,
  });

  // Pass 1 — detect generic SamplePointNames per utility
  // (same name shared by multiple SamplePointIDs = generic)
  const spToIds = {};
  data.forEach(row => {
    const pwsid  = (row.PWSID           || '').trim();
    const spName = (row.SamplePointName  || '').trim();
    const spId   = (row.SamplePointID    || '').trim();
    if (!pwsid || !spName) return;
    if (!spToIds[pwsid])          spToIds[pwsid] = {};
    if (!spToIds[pwsid][spName])  spToIds[pwsid][spName] = new Set();
    spToIds[pwsid][spName].add(spId);
  });

  const GENERIC_NAMES = new Set([
    'entry point to dist. system',
    'entry point to distribution system',
    'ep', 'representative intertie',
  ]);

  function getLabel(pwsid, row) {
    const spName  = (row.SamplePointName || '').trim();
    const facName = (row.FacilityName    || '').trim();
    const idCount = spToIds[pwsid]?.[spName]?.size ?? 1;
    if (GENERIC_NAMES.has(spName.toLowerCase()) || idCount > 1) return facName || spName;
    return spName;
  }

  // Pass 2 — accumulate detected values
  // temp[pwsid][contam][label][date] = [val, val, ...]
  const temp = {};
  data.forEach(row => {
    const pwsid  = (row.PWSID                 || '').trim();
    const contam = (row.Contaminant            || '').trim();
    const date   = (row.CollectionDate         || '').trim();
    const sign   = (row.AnalyticalResultsSign  || '').trim();

    // Try pre-converted ng/L column first, fall back to µg/L × 1000
    const valNgL  = parseFloat(row['ng/l']);
    const valUgL  = parseFloat(row.AnalyticalResultValue);
    const valRaw  = !isNaN(valNgL) && valNgL > 0 ? valNgL : valUgL * 1000;

    if (!pwsid || !contam || !date)              return;
    if (sign === '<' || isNaN(valRaw) || valRaw <= 0) return;

    const val = parseFloat(valRaw.toFixed(3));
    const label = getLabel(pwsid, row);

    if (!temp[pwsid])                       temp[pwsid] = {};
    if (!temp[pwsid][contam])               temp[pwsid][contam] = {};
    if (!temp[pwsid][contam][label])        temp[pwsid][contam][label] = {};
    if (!temp[pwsid][contam][label][date])  temp[pwsid][contam][label][date] = [];
    temp[pwsid][contam][label][date].push(val);
  });

  // Pass 3 — resolve duplicates
  // Same values on same date = exact duplicate row → keep one
  // Different values on same date = accuracy replicates → average
  const grouped = {};
  Object.entries(temp).forEach(([pwsid, cMap]) => {
    grouped[pwsid] = {};
    Object.entries(cMap).forEach(([contam, lMap]) => {
      grouped[pwsid][contam] = {};
      Object.entries(lMap).forEach(([label, dMap]) => {
        grouped[pwsid][contam][label] = Object.entries(dMap).map(([date, vals]) => {
          const unique  = [...new Set(vals)];
          const isExact = unique.length === 1;
          const value   = isExact
            ? unique[0]
            : parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
          return { date, value, n: isExact ? 1 : vals.length };
        });
      });
    });
  });

  return grouped;
}


// ============================================================
//  PUBLIC FUNCTION — called by nav() in pfas_watch.html
//  When user clicks a utility panel in the sidebar.
// ============================================================

function renderChartsForPanel(panelId) {
  const pwsid = PANEL_TO_PWSID[panelId];
  if (!pwsid) return; // not a UCMR5 chart panel — skip

  if (csvLoadState === 'ready') {
    buildCharts(panelId, pwsid);
    return;
  }

  // CSV still loading — show spinner and queue
  const container = document.getElementById('ch-' + panelId);
  if (container && container.children.length === 0) {
    container.innerHTML = `
      <div style="padding:20px;text-align:center;color:#64748b;font-size:11px">
        ⏳ Loading PFAS data from CSV...
      </div>`;
  }
  pendingPanel = panelId;
  if (csvLoadState === 'idle') loadCSV();
}


// ============================================================
//  BUILD CHARTS — one chart card per contaminant
// ============================================================

function buildCharts(panelId, pwsid) {
  const container = document.getElementById('ch-' + panelId);
  if (!container) return;

  // destroy previous Chart.js instances before re-rendering
  (chartInstances[panelId] || []).forEach(c => c.destroy());
  chartInstances[panelId] = [];
  container.innerHTML     = '';

  const utilData = csvData[pwsid];
  if (!utilData || Object.keys(utilData).length === 0) {
    container.innerHTML = `
      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:10px;
                  padding:20px;text-align:center;max-width:440px;margin:20px auto">
        <h3 style="color:#15803d;font-weight:800">✅ No PFAS Detected</h3>
        <p style="font-size:11px;color:#16a34a;margin-top:5px">
          All samples below minimum reporting level.
        </p>
      </div>`;
    return;
  }

  // Sort: contaminants WITH MCL first (by max value), then no-MCL
  const contaminants = Object.keys(utilData).sort((a, b) => {
    const aHas = MCL_LIMITS[a] ? 1 : 0;
    const bHas = MCL_LIMITS[b] ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    const maxOf = n => Math.max(
      ...Object.values(utilData[n]).flatMap(pts => pts.map(p => p.value))
    );
    return maxOf(b) - maxOf(a);
  });

  contaminants.forEach(contam => {
    const epMap  = utilData[contam];
    const mcl    = MCL_LIMITS[contam] ?? null;
    const allVals = Object.values(epMap).flatMap(pts => pts.map(p => p.value));
    const maxVal  = allVals.length ? Math.max(...allVals) : 0;
    const exceeds = mcl && allVals.some(v => v > mcl);
    const epNames = Object.keys(epMap);

    // ── Collect all unique dates, sorted chronologically ──
    const dateSet = new Set();
    Object.values(epMap).forEach(pts => pts.forEach(p => dateSet.add(p.date)));
    const allDates = [...dateSet].sort((a, b) => new Date(a) - new Date(b));
    const labels   = allDates.map(d =>
      new Date(d).toLocaleDateString('en-US', { month:'short', year:'2-digit' })
    );

    // ── Build one dataset per entry point ──
    const pointMeta = {};
    const datasets  = epNames.map((epName, i) => {
      const byDate = {};
      epMap[epName].forEach(p => { byDate[p.date] = p; });
      pointMeta[epName] = allDates.map(d => byDate[d] ?? null);
      return {
        label:            epName,
        data:             allDates.map(d => byDate[d]?.value ?? null),
        borderColor:      EP_COLORS[i % EP_COLORS.length],
        backgroundColor:  EP_COLORS[i % EP_COLORS.length] + '22',
        pointRadius:      allDates.map(d => byDate[d] ? (byDate[d].n > 1 ? 7 : 5) : 0),
        pointStyle:       allDates.map(d => byDate[d]?.n > 1 ? 'star' : 'circle'),
        pointHoverRadius: 8,
        borderWidth:      2,
        showLine:         false, // dots only — no connecting lines
        spanGaps:         false,
      };
    });

    // ── MCL reference line ──
    const mclDataset = mcl ? [{
      label:       `MCL = ${mcl} ng/L`,
      data:        labels.map(() => mcl),
      borderColor: '#991b1b',
      borderDash:  [6, 3],
      borderWidth: 1.5,
      pointRadius: 0,
      fill:        false,
      tension:     0,
      showLine:    true,
      order:       -1,
    }] : [];

    const yMax = mcl
      ? Math.max(mcl * 1.5, maxVal * 1.15)
      : maxVal * 1.3 || 10;

    // ── Build card HTML ──
    const borderColor = exceeds ? '#ef4444' : mcl ? '#f97316' : '#3b82f6';
    const card        = document.createElement('div');
    card.style.cssText = `
      background:#fff; border-radius:10px; padding:12px 14px;
      border:1px solid ${exceeds ? '#fecaca' : '#e5e7eb'};
      border-top:3px solid ${borderColor};
      box-shadow:0 1px 4px rgba(0,0,0,.07);`;

    // title row
    const mclBadge = mcl
      ? `<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;
                      background:${exceeds?'#fef2f2':'#fffbeb'};
                      color:${exceeds?'#b91c1c':'#92400e'}">
          ${exceeds ? `⚠ Exceeds MCL (${mcl} ng/L) — max ${maxVal.toFixed(1)}` : `MCL = ${mcl} ng/L`}
        </span>`
      : `<span style="font-size:9px;background:#f1f5f9;color:#64748b;
                      padding:1px 6px;border-radius:4px">No MCL</span>`;

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:12px;color:#0f172a">${contam}</span>
        ${mclBadge}
        <span style="font-size:8.5px;color:#94a3b8;margin-left:auto">
          ${epNames.length} entry point${epNames.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style="position:relative;height:185px">
        <canvas id="canvas-${panelId}-${contam.replace(/[^a-z0-9]/gi,'')}"></canvas>
      </div>
      <div style="margin-top:7px;display:flex;flex-wrap:wrap;gap:3px 9px" id="legend-${panelId}-${contam.replace(/[^a-z0-9]/gi,'')}">
      </div>`;

    container.appendChild(card);

    // ── Legend ──
    const legendDiv = card.querySelector(`[id^="legend-"]`);
    if (mcl) {
      legendDiv.innerHTML += `
        <span style="display:flex;align-items:center;gap:3px;font-size:8.5px;color:#64748b">
          <span style="width:14px;height:0;border-top:2px dashed #991b1b;display:inline-block"></span>
          MCL=${mcl}
        </span>`;
    }
    epNames.forEach((ep, i) => {
      legendDiv.innerHTML += `
        <span style="display:flex;align-items:center;gap:3px;font-size:8.5px;color:#374151">
          <span style="width:8px;height:8px;border-radius:2px;
                       background:${EP_COLORS[i % EP_COLORS.length]};
                       display:inline-block;flex-shrink:0"></span>
          ${ep}
        </span>`;
    });
    legendDiv.innerHTML += `
      <span style="font-size:8px;color:#94a3b8;margin-left:auto;align-self:center">
        ★ = avg of replicates
      </span>`;

    // ── Render Chart.js ──
    const canvasId = `canvas-${panelId}-${contam.replace(/[^a-z0-9]/gi,'')}`;
    const canvas   = document.getElementById(canvasId);

    const chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [...mclDataset, ...datasets] },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: item => {
                if (item.raw === null) return null;
                if ((item.dataset.label || '').startsWith('MCL')) return ` ${item.dataset.label}`;
                const pt  = pointMeta[item.dataset.label]?.[item.dataIndex];
                let txt   = ` ${item.dataset.label}: ${item.raw} ng/L`;
                if (pt?.n > 1) txt += ` (avg of ${pt.n})`;
                return txt;
              },
            },
            filter: item => item.raw !== null,
          },
        },
        scales: {
          x: {
            ticks: { font:{size:9}, maxRotation:45, autoSkip:false },
            grid:  { color:'rgba(0,0,0,0.05)' },
          },
          y: {
            min: 0, max: parseFloat(yMax.toFixed(1)),
            title: { display:true, text:'ng/L', font:{size:9} },
            ticks: { font:{size:9} },
            grid:  { color:'rgba(0,0,0,0.05)' },
          },
        },
      },
    });

    chartInstances[panelId].push(chart);
  });
}


// ============================================================
//  HELPER — show error message in a panel
// ============================================================
function showError(panelId, message) {
  const container = document.getElementById('ch-' + panelId);
  if (container) {
    container.innerHTML = `
      <div style="background:#fef2f2;border-radius:8px;padding:16px;
                  color:#b91c1c;font-size:11px">
        ❌ Could not load PFAS data: ${message}
      </div>`;
  }
}


// ============================================================
//  AUTO-START — fetch CSV as soon as the page loads
//  so data is ready by the time user clicks a utility
// ============================================================
document.addEventListener('DOMContentLoaded', loadCSV);
