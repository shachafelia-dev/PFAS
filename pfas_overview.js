// ============================================================
//  pfas_overview.js
//  Builds the Overview panel — summary cards + full table.
//  Reads from UTILITIES and MCL_LIMITS defined in pfas_data.js.
//  Writes directly into <div id="panel-overview"> in the HTML.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

  const panel = document.getElementById('panel-overview');
  if (!panel) return;

  // ── Compute summary numbers ──────────────────────────────
  const total    = UTILITIES.length;
  const exceeding = UTILITIES.filter(u =>
    u.status === 'exceeds' || u.ccrStatus === 'exceeds'
  ).length;
  const rest = total - exceeding;

  // ── Sort all utilities by max value descending ───────────
  const sorted = [...UTILITIES].sort((a, b) => getMaxVal(b) - getMaxVal(a));

  // ── Build HTML ───────────────────────────────────────────
  panel.innerHTML = `

    <!-- Source note -->
    <div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:10px;
                padding:14px 18px;margin-bottom:14px;font-size:11px;
                color:#78350f;line-height:1.7">
      ⚠ <strong>Two data sources used in this dashboard:</strong>
      (1) <strong>EPA UCMR5</strong> (2023–2025) — federally mandated, standardized,
      lab-verified, applies to 19 of 36 utilities.
      (2) <strong>CCR 2024 Water Quality Reports</strong> — self-reported by utility,
      applies to 17 utilities not in UCMR5. CCR values are ranges across all sampling
      points and are <em>not directly comparable</em> to UCMR5 measurements.
    </div>

    <!-- Summary cards -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      ${summaryCard(total,    'Total NJAW utilities',             '#3b82f6')}
      ${summaryCard(exceeding,'Exceed MCL (13 UCMR5 + 6 CCR)',   '#ef4444')}
      ${summaryCard(rest,     'Below MCL / ND / No data',         '#22c55e')}
    </div>

    <!-- Table title -->
    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:8px">
      All 36 NJ American Water Utilities — Sorted by Max Concentration (Highest → Lowest)
    </div>

    <!-- Table -->
    <div style="overflow-x:auto;background:#fff;border-radius:8px;
                box-shadow:0 1px 3px rgba(0,0,0,.07)">
      <table style="width:100%;border-collapse:collapse;font-size:10.5px">
        <thead>
          <tr>
            ${['#','Utility','PWSID','County','Highest PFAS Detected',
               'Max (ng/L)','× MCL','Est. Pop.','Status','Source']
              .map(h => `<th style="background:#14213d;color:#b8c8e8;padding:7px 9px;
                                    text-align:left;font-weight:600;font-size:9.5px;
                                    white-space:nowrap">${h}</th>`)
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${sorted.map((u, i) => buildRow(u, i)).join('')}
        </tbody>
      </table>
    </div>

    <!-- Footer note -->
    <div style="margin-top:8px;font-size:9.5px;color:#94a3b8">
      † Population estimated from CCR daily usage or census. ~ = approximate.
      ND = Non-Detect. NA = Not Applicable.
      CCR ranges = min–max across all 2024 sampling points.
      MCL: PFOA = 4 ng/L · PFOS = 4 ng/L · PFNA = 10 ng/L.
    </div>
  `;

  // ── Make rows clickable → navigate to utility panel ──────
  panel.querySelectorAll('tr[data-panel]').forEach(row => {
    row.addEventListener('click', () => nav(row.dataset.panel));
    row.style.cursor = 'pointer';
    row.addEventListener('mouseenter', () =>
      row.querySelectorAll('td').forEach(td => td.style.background = '#f8faff')
    );
    row.addEventListener('mouseleave', () =>
      row.querySelectorAll('td').forEach(td => td.style.background = '')
    );
  });

});


// ============================================================
//  HELPER — summary card HTML
// ============================================================
function summaryCard(value, label, color) {
  return `
    <div style="background:#fff;border-radius:8px;padding:10px 13px;
                border-top:3px solid ${color};
                box-shadow:0 1px 3px rgba(0,0,0,.07)">
      <div style="font-size:22px;font-weight:800;color:#0f172a">${value}</div>
      <div style="font-size:9.5px;color:#64748b;margin-top:3px">${label}</div>
    </div>`;
}


// ============================================================
//  HELPER — build one table row for a utility
// ============================================================
function buildRow(u, index) {
  const isUCMR5 = u.source === 'UCMR5';

  // ── Highest detected contaminant ──
  let contaminant, maxConc, ratio;

  if (isUCMR5) {
    if (u.status === 'none') {
      contaminant = '<span style="color:#15803d">None detected</span>';
      maxConc     = '<span style="color:#15803d">ND</span>';
      ratio       = '—';
    } else {
      const mcl   = MCL_LIMITS[u.ch] ?? null;
      const color = u.mx >= 8 ? '#dc2626' : u.mx >= 6 ? '#eab308' : '#16a34a';
      contaminant = `<b style="color:#185FA5">${u.ch}</b>`;
      maxConc     = `<span style="background:${color}22;color:${color};
                                  padding:1px 6px;border-radius:4px;
                                  font-weight:700;font-size:9.5px">${u.mx}</span>`;
      ratio = mcl
        ? `<span style="font-weight:700;color:${color}">${(u.mx / mcl).toFixed(1)}×</span>`
        : '<span style="color:#64748b">No MCL</span>';
    }
  } else {
    // CCR utility
    if (u.ccrStatus === 'nodata') {
      contaminant = '<span style="color:#94a3b8;font-size:9px">No data</span>';
      maxConc     = '<span style="color:#94a3b8">—</span>';
      ratio       = '—';
    } else if (u.ccrStatus === 'nd') {
      contaminant = '<span style="color:#475569">NA / ND</span>';
      maxConc     = '<span style="color:#94a3b8">—</span>';
      ratio       = '—';
    } else {
      const mv    = u.ccrMaxVal;
      const color = mv >= 8 ? '#dc2626' : mv >= 6 ? '#eab308' : '#16a34a';
      contaminant = '<b style="color:#185FA5">PFOA</b>';
      maxConc     = `<span style="background:${color}22;color:${color};
                                  padding:1px 6px;border-radius:4px;
                                  font-weight:700;font-size:9.5px">${mv}</span>`;
      ratio       = `<span style="font-weight:700;color:${color}">${(mv / 4).toFixed(1)}×</span>`;
    }
  }

  // ── Status badge ──
  const status = statusBadge(u);

  // ── Source badge ──
  const source = isUCMR5
    ? `<span style="background:#dbeafe;color:#1d4ed8;padding:1px 6px;
                    border-radius:3px;font-size:9px;font-weight:700">UCMR5</span>`
    : `<span style="background:#fef9c3;color:#92400e;padding:1px 6px;
                    border-radius:3px;font-size:9px;font-weight:700">CCR 2024</span>`;

  const td = s => `<td style="padding:5px 9px;border-bottom:1px solid #f1f5f9;
                               vertical-align:middle">${s}</td>`;

  return `
    <tr data-panel="${u.panelId}">
      ${td(`<span style="color:#94a3b8;font-size:9px">${index + 1}</span>`)}
      ${td(`<strong style="font-size:10px">${u.name}</strong>`)}
      ${td(`<span style="font-family:monospace;font-size:9.5px;color:#64748b">${u.id}</span>`)}
      ${td(`<span style="font-size:10px">${u.county ?? '—'}</span>`)}
      ${td(contaminant)}
      ${td(maxConc)}
      ${td(ratio)}
      ${td(`<span style="font-size:10px">${formatPop(u)}</span>`)}
      ${td(status)}
      ${td(source)}
    </tr>`;
}


// ============================================================
//  HELPER — status badge HTML
// ============================================================
function statusBadge(u) {
  const s = (str, bg, color) =>
    `<span style="background:${bg};color:${color};padding:1px 6px;
                  border-radius:5px;font-size:9.5px;font-weight:700">${str}</span>`;

  if (u.source === 'UCMR5') {
    if (u.status === 'none')     return s('✓ No PFAS',       '#f1f5f9', '#475569');
    if (u.status === 'detected') return s('✓ Below MCL',     '#f0fdf4', '#15803d');
    const high = u.mx >= 8;
    return s('⚠ Exceeds MCL', high ? '#fef2f2' : '#fff7ed', high ? '#b91c1c' : '#c2410c');
  }

  // CCR
  if (u.ccrStatus === 'nodata')   return s('No CCR Data',    '#f9fafb', '#374151');
  if (u.ccrStatus === 'nd')       return s('✓ ND / NA',      '#f1f5f9', '#475569');
  if (u.ccrStatus === 'detected') return s('✓ Below MCL',    '#f0fdf4', '#15803d');
  const high = u.ccrMaxVal >= 8;
  return s('⚠ Exceeds MCL', high ? '#fef2f2' : '#fff7ed', high ? '#b91c1c' : '#c2410c');
}
