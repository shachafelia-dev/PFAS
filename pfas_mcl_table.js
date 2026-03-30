// ============================================================
//  pfas_mcl_table.js
//  Builds the MCL Exceedances panel — 19 utilities table.
//  Reads from UTILITIES and MCL_LIMITS defined in pfas_data.js.
//  Writes directly into <div id="panel-mcltable"> in the HTML.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

  const panel = document.getElementById('panel-mcltable');
  if (!panel) return;

  // ── Get only the 19 exceeding utilities, sorted by max val ──
  const rows = getExceedingUtilities(); // from pfas_data.js

  panel.innerHTML = `

    <!-- Title -->
    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:10px">
      19 NJ American Water Utilities — Exceeding EPA MCL ·
      Sorted by Max Concentration
    </div>

    <!-- Source note -->
    <div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:10px;
                padding:12px 16px;margin-bottom:14px;font-size:11px;
                color:#78350f;line-height:1.7">
      ⚠ <strong>Mixed sources:</strong>
      <strong>UCMR5</strong> = EPA federally mandated, lab-verified, single-point measurements.
      <strong>CCR 2024</strong> = utility self-reported annual report, values shown as
      max of reported range. CCR values are <em>not directly comparable</em> to UCMR5.
    </div>

    <!-- Table -->
    <div style="overflow-x:auto;background:#fff;border-radius:8px;
                box-shadow:0 1px 4px rgba(0,0,0,.08)">
      <table style="width:100%;border-collapse:collapse;font-size:10.5px">
        <thead>
          <tr>
            ${['#','Utility','PWSID','Contaminant','Max Conc. (ng/L)',
               '× MCL','Est. Pop.','County','Source']
              .map(h => `<th style="background:#14213d;color:#b8c8e8;padding:8px 10px;
                                    text-align:left;font-weight:600;font-size:9.5px;
                                    white-space:nowrap">${h}</th>`)
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((u, i) => buildMCLRow(u, i)).join('')}
        </tbody>
      </table>
    </div>

    <!-- Footer note -->
    <div style="margin-top:8px;font-size:9.5px;color:#94a3b8">
      † Population estimated from CCR daily usage or census. ~ = approximate.
      MCL: PFOA = 4 ng/L · PFOS = 4 ng/L · PFNA = 10 ng/L.
      CCR values = max of reported range across all 2024 sampling points.
    </div>
  `;

  // ── Make rows clickable ───────────────────────────────────
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
//  HELPER — build one table row
// ============================================================
function buildMCLRow(u, index) {

  // ── Resolve contaminant + max value ──
  let contam, mx, mcl;

  if (u.source === 'UCMR5') {
    contam = u.ch;
    mx     = u.mx;
    mcl    = MCL_LIMITS[u.ch] ?? 4;
  } else {
    // CCR — use PFOA as primary unless only PFNA exceeds
    contam = u.ccrPFOA ? 'PFOA (max range)' : 'PFNA (max range)';
    mx     = u.ccrMaxVal;
    mcl    = 4;
  }

  const ratio = (mx / mcl).toFixed(1) + '×';

  // ── 3-color scale ──
  const color = mx >= 8 ? '#dc2626' : mx >= 6 ? '#eab308' : '#16a34a';

  // ── Bar width scaled to Camden max (12.9) ──
  const pct = Math.min(100, (mx / 12.9) * 100).toFixed(0);

  // ── Source badge ──
  const isUCMR5 = u.source === 'UCMR5';
  const srcBadge = isUCMR5
    ? `<span style="background:#dbeafe;color:#1d4ed8;padding:1px 7px;
                    border-radius:3px;font-size:9px;font-weight:700">UCMR5</span>`
    : `<span style="background:#fef9c3;color:#92400e;padding:1px 7px;
                    border-radius:3px;font-size:9px;font-weight:700">CCR 2024</span>`;

  const td = s => `<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;
                               vertical-align:middle">${s}</td>`;

  return `
    <tr data-panel="${u.panelId}">
      ${td(`<span style="color:#94a3b8;font-size:9px">${index + 1}</span>`)}
      ${td(`<strong style="font-size:10.5px">${u.name}</strong>`)}
      ${td(`<span style="font-family:monospace;font-size:9.5px;color:#64748b">${u.id}</span>`)}
      ${td(`<b style="color:#185FA5;font-size:10.5px">${contam}</b>`)}
      ${td(`
        <div style="display:flex;align-items:center;gap:6px">
          <span style="min-width:34px;font-weight:700;font-size:10.5px;color:${color}">${mx}</span>
          <div style="width:70px;height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:3px"></div>
          </div>
          <span style="font-size:8.5px;color:#94a3b8">MCL=${mcl}</span>
        </div>
      `)}
      ${td(`<span style="font-weight:700;font-size:10.5px;color:${color}">${ratio}</span>`)}
      ${td(`<span style="font-size:10.5px">${formatPop(u)}</span>`)}
      ${td(`<span style="font-size:10.5px">${u.county}</span>`)}
      ${td(srcBadge)}
    </tr>`;
}
