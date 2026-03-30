// pfas_charts.js
// Loads UCMR5 CSV and renders Chart.js charts into the dashboard panels.
// Loaded by pfas_full_dashboard.html — do not edit the dashboard for chart logic.

(function () {

  const CSV_PATH = './NJ_American_Water_utilities_UCMR5_all.csv';

  const MCL = { PFOA:4, PFOS:4, PFNA:10, PFHxS:10, 'HFPO-DA':10 };

  const EP_COLORS = [
    '#ec4899','#2563eb','#d97706','#16a34a','#7c3aed',
    '#0d9488','#ef4444','#92400e','#0ea5e9','#84cc16',
    '#f43f5e','#8b5cf6','#06b6d4','#a16207','#15803d',
    '#e11d48','#0284c7','#b45309','#4d7c0f','#6d28d9',
  ];

  // Maps dashboard panel id → PWSID in the CSV
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
    harrison:     'NJ0808001',
    capemay:      'NJ0506010',
    oceancity:    'NJ0508001',
    pennsgrove:   'NJ1707001',
    roxbury:      'NJ1436002',
  };

  // SamplePointNames that are generic across facilities
  // → use FacilityName instead
  const GENERIC_SP_NAMES = new Set([
    'entry point to dist. system',
    'entry point to distribution system',
    'ep',
    'representative intertie',
  ]);

  // ── State ───────────────────────────────────────────────────
  let PFAS_DATA    = null;    // parsed grouped data
  let loadState    = 'idle';  // idle | loading | ready | error
  let pendingPanel = null;    // panel requested before data was ready
  const chartInstances = {};  // panelId → [Chart, ...] for cleanup

  // ── Helpers ─────────────────────────────────────────────────

  function isGeneric(name) {
    return GENERIC_SP_NAMES.has((name || '').toLowerCase().trim());
  }

  function fmtDate(str) {
    const d = new Date(str);
    return isNaN(d) ? str : d.toLocaleDateString('en-US', { month:'short', year:'2-digit' });
  }

  // ── CSV Parsing ──────────────────────────────────────────────
  // Returns grouped[pwsid][contaminant][epLabel] = [{date,value,n,replicates}]

  function parseCSV(raw) {
    const { data } = Papa.parse(raw, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
    });

    // Pass 1 — detect generic SamplePointNames per utility
    // (same name shared by multiple SamplePointIDs → generic)
    const spToIds = {};
    data.forEach(row => {
      const pwsid  = (row.PWSID          || '').trim();
      const spName = (row.SamplePointName || '').trim();
      const spId   = (row.SamplePointID   || '').trim();
      if (!pwsid || !spName) return;
      if (!spToIds[pwsid])         spToIds[pwsid] = {};
      if (!spToIds[pwsid][spName]) spToIds[pwsid][spName] = new Set();
      spToIds[pwsid][spName].add(spId);
    });

    function getLabel(pwsid, row) {
      const spName  = (row.SamplePointName || '').trim();
      const facName = (row.FacilityName    || '').trim();
      const idCount = spToIds[pwsid]?.[spName]?.size ?? 1;
      // Use FacilityName when SamplePointName is generic or ambiguous
      if (isGeneric(spName) || idCount > 1) return facName || spName;
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
      const valRaw = parseFloat(row.AnalyticalResultValue);

      if (!pwsid || !contam || !date)          return;
      if (sign === '<' || isNaN(valRaw) || valRaw <= 0) return; // skip non-detects

      // Unit conversion: µg/L → ng/L
      const val   = parseFloat((valRaw * 1000).toFixed(3));
      const label = getLabel(pwsid, row);

      if (!temp[pwsid])                      temp[pwsid] = {};
      if (!temp[pwsid][contam])              temp[pwsid][contam] = {};
      if (!temp[pwsid][contam][label])       temp[pwsid][contam][label] = {};
      if (!temp[pwsid][contam][label][date]) temp[pwsid][contam][label][date] = [];
      temp[pwsid][contam][label][date].push(val);
    });

    // Pass 3 — resolve duplicates per (pwsid, contam, label, date)
    //   All values identical → exact duplicate row → keep one, n=1
    //   Values differ        → accuracy replicates  → average,  n=count
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
              : parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2));
            return { date, value, n: isExact ? 1 : vals.length, replicates: isExact ? null : vals };
          });
        });
      });
    });

    return grouped;
  }

  // ── Fetch + Parse ────────────────────────────────────────────

  function loadCSV() {
    if (loadState === 'loading' || loadState === 'ready') return;
    loadState = 'loading';

    fetch(CSV_PATH)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(raw => {
        PFAS_DATA = parseCSV(raw);
        loadState = 'ready';
        console.log('[pfas_charts] CSV ready —', Object.keys(PFAS_DATA).length, 'utilities');
        if (pendingPanel) {
          renderPFASCharts(pendingPanel);
          pendingPanel = null;
        }
      })
      .catch(err => {
        loadState = 'error';
        console.error('[pfas_charts] Load failed:', err);
        if (pendingPanel) {
          const el = document.getElementById('ch-' + pendingPanel);
          if (el) el.innerHTML = '<div style="color:#b91c1c;padding:10px;font-size:11px">⚠ Could not load PFAS data: ' + err.message + '</div>';
          pendingPanel = null;
        }
      });
  }

  // ── Chart.js Dataset Builder ─────────────────────────────────

  function buildChartData(epMap) {
    const dateSet = new Set();
    Object.values(epMap).forEach(pts => pts.forEach(p => dateSet.add(p.date)));
    const allDates = [...dateSet].sort((a,b) => new Date(a) - new Date(b));
    const labels   = allDates.map(fmtDate);

    const pointMeta = {};
    const datasets  = Object.entries(epMap).map(([epName, pts], i) => {
      const byDate = {};
      pts.forEach(p => { byDate[p.date] = p; });
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
        tension:          0.3,
        spanGaps:         false, // gaps where entry point was not sampled
      };
    });

    return { labels, datasets, pointMeta };
  }

  // ── Render Charts Into Panel ─────────────────────────────────

  function renderChartsForPanel(panelId, pwsid) {
    const container = document.getElementById('ch-' + panelId);
    if (!container) return;

    // Destroy previous Chart.js instances to free memory
    (chartInstances[panelId] || []).forEach(c => c.destroy());
    chartInstances[panelId] = [];

    const utilData = PFAS_DATA[pwsid];

    // No detections → show green "all clear" box
    if (!utilData || Object.keys(utilData).length === 0) {
      container.innerHTML = '<div class="npbox"><h3>✅ No PFAS Detected</h3><p>All samples below MRL (non-detect).</p></div>';
      return;
    }

    container.innerHTML = '';

    // Sort: MCL contaminants first by max value desc, then no-MCL by max value desc
    const contaminants = Object.keys(utilData).sort((a, b) => {
      const aM = MCL[a] ? 1 : 0, bM = MCL[b] ? 1 : 0;
      if (aM !== bM) return bM - aM;
      const maxOf = n => Math.max(...Object.values(utilData[n]).flatMap(p => p.map(x => x.value)));
      return maxOf(b) - maxOf(a);
    });

    contaminants.forEach(contam => {
      const epMap   = utilData[contam];
      const mcl     = MCL[contam] ?? null;
      const allVals = Object.values(epMap).flatMap(pts => pts.map(p => p.value));
      const maxVal  = allVals.length ? Math.max(...allVals) : 0;
      const exceeds = mcl && allVals.some(v => v > mcl);
      const epNames = Object.keys(epMap);

      // ── Card
      const card = document.createElement('div');
      card.className = 'cc';
      card.style.cssText =
        'background:#fff;border-radius:8px;padding:10px 12px;' +
        'box-shadow:0 1px 3px rgba(0,0,0,.07);' +
        'border:1px solid ' + (exceeds ? '#fecaca' : '#e5e7eb') + ';' +
        'border-top:3px solid ' + (exceeds ? '#ef4444' : mcl ? '#f97316' : '#3b82f6');

      // ── Title row
      const titleRow = document.createElement('div');
      titleRow.style.cssText = 'display:flex;align-items:center;gap:7px;margin-bottom:7px;flex-wrap:wrap';

      const title = document.createElement('span');
      title.style.cssText = 'font-weight:700;font-size:11px;color:#0f172a';
      title.textContent = contam;

      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;' +
        (mcl
          ? (exceeds ? 'background:#fef2f2;color:#b91c1c' : 'background:#fffbeb;color:#92400e')
          : 'background:#f1f5f9;color:#64748b');
      badge.textContent = mcl
        ? (exceeds ? '⚠ Exceeds MCL (' + mcl + ' ng/L) — max ' + maxVal.toFixed(1) : 'MCL = ' + mcl + ' ng/L')
        : 'No MCL';

      const epCount = document.createElement('span');
      epCount.style.cssText = 'font-size:8.5px;color:#94a3b8;margin-left:auto';
      epCount.textContent = epNames.length + ' entry point' + (epNames.length !== 1 ? 's' : '');

      titleRow.append(title, badge, epCount);
      card.appendChild(titleRow);

      // ── Canvas wrapper
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;height:175px';
      const canvas = document.createElement('canvas');
      wrap.appendChild(canvas);
      card.appendChild(wrap);

      // ── Legend
      const legend = document.createElement('div');
      legend.style.cssText = 'margin-top:7px;display:flex;flex-wrap:wrap;gap:3px 9px';

      if (mcl) {
        const mclLeg = document.createElement('span');
        mclLeg.style.cssText = 'display:flex;align-items:center;gap:3px;font-size:8.5px;color:#64748b';
        mclLeg.innerHTML = '<span style="width:14px;height:0;border-top:2px dashed #991b1b;display:inline-block"></span>MCL=' + mcl;
        legend.appendChild(mclLeg);
      }
      epNames.forEach((name, i) => {
        const dot = document.createElement('span');
        dot.style.cssText = 'display:flex;align-items:center;gap:3px;font-size:8.5px;color:#374151';
        dot.innerHTML = '<span style="width:8px;height:8px;border-radius:2px;background:' +
          EP_COLORS[i % EP_COLORS.length] + ';display:inline-block;flex-shrink:0"></span>' + name;
        legend.appendChild(dot);
      });
      const repNote = document.createElement('span');
      repNote.style.cssText = 'font-size:8px;color:#94a3b8;margin-left:auto;align-self:center';
      repNote.textContent = '★ = avg of replicates';
      legend.appendChild(repNote);

      card.appendChild(legend);
      container.appendChild(card);

      // ── Build + render Chart.js
      const { labels, datasets, pointMeta } = buildChartData(epMap);

      const mclDataset = mcl ? [{
        label: 'MCL = ' + mcl + ' ng/L',
        data: labels.map(() => mcl),
        borderColor: '#991b1b', borderDash: [6,3], borderWidth: 1.5,
        pointRadius: 0, fill: false, tension: 0, order: -1,
      }] : [];

      const yMax = mcl
        ? Math.max(mcl * 1.5, maxVal * 1.15)
        : maxVal * 1.3 || 10;

      const chart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets: [...mclDataset, ...datasets] },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode:'index', intersect:false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: item => {
                  if (item.raw === null) return null;
                  if ((item.dataset.label || '').startsWith('MCL')) return ' ' + item.dataset.label;
                  const pt  = pointMeta[item.dataset.label]?.[item.dataIndex];
                  let txt = ' ' + item.dataset.label + ': ' + item.raw + ' ng/L';
                  if (pt?.n > 1) txt += ' (avg of ' + pt.n + ': ' + pt.replicates.join(', ') + ')';
                  return txt;
                },
              },
              filter: item => item.raw !== null,
            },
          },
          scales: {
            x: { ticks:{font:{size:9},maxRotation:45,autoSkip:false}, grid:{color:'rgba(0,0,0,0.05)'} },
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

  // ── Public API ───────────────────────────────────────────────
  // Called by nav() in the dashboard when a panel is opened

  window.renderPFASCharts = function (panelId) {
    const pwsid = PANEL_TO_PWSID[panelId];
    if (!pwsid) return; // not a UCMR5 panel — skip silently

    if (loadState === 'ready') {
      renderChartsForPanel(panelId, pwsid);
      return;
    }

    // Data still loading — show spinner and queue request
    const container = document.getElementById('ch-' + panelId);
    if (container && container.children.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;font-size:11px">⏳ Loading PFAS data...</div>';
    }
    pendingPanel = panelId;
    if (loadState === 'idle') loadCSV();
  };

  // Start fetching CSV immediately when script loads
  loadCSV();

})();
