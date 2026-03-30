// ============================================================
//  pfas_methodology.js
//  Builds the Methodology panel.
//  Writes directly into <div id="panel-methodology"> in the HTML.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

  const panel = document.getElementById('panel-methodology');
  if (!panel) return;

  panel.innerHTML = `

    <!-- ── Page title ── -->
    <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:16px">
      🔬 Methodology & Data Sources
    </div>


    <!-- ══════════════════════════════════════════════════════
         SECTION 1 — Full Scope Stats
         ════════════════════════════════════════════════════ -->
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:10px;
                  display:flex;align-items:center;gap:8px">
        📊 Full Scope
        <span style="flex:1;height:1px;background:#e2e8f0;display:block"></span>
      </div>

      <div style="background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.07);overflow:hidden">
        ${scopeRow('Total NJAW utilities NJ',    '36',           false)}
        ${scopeRow('In UCMR5',                   '19 of 36',     false)}
        ${scopeRow('UCMR5 exceed MCL',           '13 (68%)',     true)}
        ${scopeRow('CCR 2024 exceed MCL',        '6 of 17 not-UCMR5', true)}
        ${scopeRow('CCR detected, below MCL',    '2',            false)}
        ${scopeRow('CCR not detected / NA',      '2',            false)}
        ${scopeRow('CCR no data available',      '7',            false, true)}
      </div>
    </div>


    <!-- ══════════════════════════════════════════════════════
         SECTION 2 — EPA MCL Reference
         ════════════════════════════════════════════════════ -->
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:10px;
                  display:flex;align-items:center;gap:8px">
        ⚗ EPA MCL Reference (2024)
        <span style="flex:1;height:1px;background:#e2e8f0;display:block"></span>
      </div>

      <div style="background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.07);
                  padding:14px 18px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:11px">
          ${mclRow('PFOA',                        '4 ng/L',   true)}
          ${mclRow('PFOS',                        '4 ng/L',   true)}
          ${mclRow('PFHxS',                       '10 ng/L',  true)}
          ${mclRow('PFNA',                        '10 ng/L',  true)}
          ${mclRow('HFPO-DA (GenX)',              '10 ng/L',  true)}
          ${mclRow('PFBA, PFBS, PFHpA, PFHxA, PFPeA', 'No MCL', false)}
        </div>
        <div style="margin-top:10px;font-size:10px;color:#64748b;
                    border-top:1px solid #f1f5f9;padding-top:8px">
          MCL = Maximum Contaminant Level. These are legally enforceable limits
          under the EPA Safe Drinking Water Act, finalized April 2024.
          Utilities must comply by 2026.
        </div>
      </div>
    </div>


    <!-- ══════════════════════════════════════════════════════
         SECTION 3 — Data Sources Explanation
         ════════════════════════════════════════════════════ -->
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:10px;
                  display:flex;align-items:center;gap:8px">
        📋 Understanding the Two Data Sources
        <span style="flex:1;height:1px;background:#e2e8f0;display:block"></span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">

        <!-- UCMR5 card -->
        <div style="background:#fff;border-radius:8px;padding:16px 18px;
                    box-shadow:0 1px 3px rgba(0,0,0,.07);
                    border-top:3px solid #1d4ed8">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;
                         border-radius:4px;font-size:10px;font-weight:700">UCMR5</span>
            <span style="font-size:12px;font-weight:700;color:#0f172a">
              EPA Unregulated Contaminant Monitoring Rule
            </span>
          </div>
          <div style="font-size:11px;color:#374151;line-height:1.8">
            <p style="margin-bottom:8px">
              The UCMR5 is a <strong>federally mandated program</strong> run by the U.S.
              Environmental Protection Agency. It requires public water systems to test
              for specific contaminants that do not yet have regulatory standards or
              that need more data.
            </p>
            <p style="margin-bottom:8px">
              <strong>Who must test:</strong> All systems serving more than 10,000 people.
              Systems serving 3,300–10,000 people if notified by EPA. A random selection
              of 800 small systems.
            </p>
            <p style="margin-bottom:8px">
              <strong>How samples are collected:</strong> Samples are taken at specific
              <em>entry points to the distribution system</em> (EPTDS) — the exact point
              where treated water enters the pipes going to customers. Each entry point
              is tested independently, giving a precise picture of where contamination
              enters.
            </p>
            <p style="margin-bottom:8px">
              <strong>Timing:</strong> Two sampling events per year (SE1 and SE2),
              spaced roughly 6 months apart. The exact collection date is recorded
              for each sample — this is why the charts show individual dated data points
              rather than a yearly range.
            </p>
            <p>
              <strong>Reliability:</strong> Highest available. Samples are analyzed
              by EPA-certified laboratories only, using standardized methods (EPA 533
              or EPA 537.1). Results are independently verified and publicly reported
              through the EPA UCMR5 Data Finder.
            </p>
          </div>
        </div>

        <!-- CCR card -->
        <div style="background:#fff;border-radius:8px;padding:16px 18px;
                    box-shadow:0 1px 3px rgba(0,0,0,.07);
                    border-top:3px solid #92400e">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <span style="background:#fef9c3;color:#92400e;padding:2px 8px;
                         border-radius:4px;font-size:10px;font-weight:700">CCR 2024</span>
            <span style="font-size:12px;font-weight:700;color:#0f172a">
              Consumer Confidence Report
            </span>
          </div>
          <div style="font-size:11px;color:#374151;line-height:1.8">
            <p style="margin-bottom:8px">
              The Consumer Confidence Report (CCR), also known as the
              <strong>Annual Water Quality Report</strong>, is a document that every
              community water system in the U.S. is required to send to its customers
              once a year. It summarizes what was detected in the water supply during
              the previous calendar year.
            </p>
            <p style="margin-bottom:8px">
              <strong>Who produces it:</strong> The utility itself — self-reported.
              NJ American Water publishes CCR PDFs at amwater.com/ccr for each system.
            </p>
            <p style="margin-bottom:8px">
              <strong>How values are presented:</strong> Unlike UCMR5 which shows each
              individual sample with its date, the CCR reports a
              <em>single range for the entire year</em> — the minimum and maximum
              detected across all sampling points and all dates combined.
              For example: "PFOA: ND – 9.0 ng/L" means that across all tests
              throughout 2024, the lowest result was non-detect and the highest
              was 9.0 ng/L.
            </p>
            <p style="margin-bottom:8px">
              <strong>What ND and NA mean:</strong>
              <em>ND (Non-Detect)</em> = the contaminant was tested but not found
              above the lab's reporting limit. It does not necessarily mean zero —
              just below the threshold the lab can measure.
              <em>NA (Not Applicable)</em> = the utility was not required to test
              for that contaminant, or testing was not performed.
            </p>
            <p>
              <strong>Reliability:</strong> Moderate. Because the CCR is self-reported
              and shows ranges rather than individual measurements, its values
              <strong>cannot be directly compared</strong> to UCMR5 point measurements.
              A CCR max value is the worst reading across the whole year and all
              locations — it may reflect a single outlier event rather than a
              sustained contamination level.
            </p>
          </div>
        </div>
      </div>

      <!-- Comparison box -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                  padding:14px 18px;font-size:11px;color:#374151">
        <div style="font-weight:700;font-size:12px;color:#0f172a;margin-bottom:10px">
          🔄 Key Differences at a Glance
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:10.5px">
            <thead>
              <tr>
                ${['',
                   '<span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700">UCMR5</span>',
                   '<span style="background:#fef9c3;color:#92400e;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700">CCR 2024</span>'
                  ].map(h => `<th style="padding:7px 10px;text-align:left;background:#f1f5f9;
                                         font-weight:600;font-size:10px;color:#374151;
                                         border-bottom:1px solid #e2e8f0">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${compareRow('Who collects',   'EPA (federal)',                   'Utility (self-reported)')}
              ${compareRow('Time period',    '2023–2025 (multi-year)',          'Single calendar year (2024)')}
              ${compareRow('Values shown',   'Individual sample + exact date',  'Min–max range for full year')}
              ${compareRow('Sample points',  'Specific EPTDS locations',        'All locations combined')}
              ${compareRow('Lab standards',  'EPA-certified labs only',         'Utility-run or contracted')}
              ${compareRow('Applies to',     '19 of 36 NJAW utilities',         '17 of 36 NJAW utilities')}
              ${compareRow('Reliability',    '⭐⭐⭐ Highest',                '⭐⭐ Moderate')}
              ${compareRow('Comparable?',    '—',                               '⚠ Not directly comparable to UCMR5')}
            </tbody>
          </table>
        </div>
      </div>
    </div>


    <!-- ══════════════════════════════════════════════════════
         SECTION 4 — Sources
         ════════════════════════════════════════════════════ -->
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;
                padding:12px 16px;font-size:10.5px;color:#0c4a6e;line-height:1.9">
      <strong>Primary data sources used in this dashboard:</strong><br>
      EPA UCMR5 Data Finder — epa.gov/dwucmr &nbsp;·&nbsp;
      NJ WaterCheck — njwatercheck.com &nbsp;·&nbsp;
      NJ American Water CCR PDFs — amwater.com/ccr &nbsp;·&nbsp;
      NJDEP Drinking Water Watch — dep.nj.gov/watersupply &nbsp;·&nbsp;
      NJ BPU Water Utility Registry
    </div>

  `;
});


// ── Helpers ───────────────────────────────────────────────────

function scopeRow(label, value, isRed, isOrange) {
  const color = isRed ? '#b91c1c' : isOrange ? '#92400e' : '#0f172a';
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:8px 14px;border-bottom:1px solid #f1f5f9;font-size:11px">
      <span style="color:#64748b">${label}</span>
      <span style="font-weight:700;color:${color}">${value}</span>
    </div>`;
}

function mclRow(name, limit, hasMCL) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:4px 0;border-bottom:1px solid #f8fafc">
      <span style="color:#374151;font-weight:600">${name}</span>
      <span style="font-weight:700;color:${hasMCL ? '#b91c1c' : '#64748b'};
                   background:${hasMCL ? '#fef2f2' : '#f1f5f9'};
                   padding:1px 8px;border-radius:4px;font-size:10px">
        ${limit}
      </span>
    </div>`;
}

function compareRow(label, ucmr5, ccr) {
  return `
    <tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:6px 10px;font-weight:600;color:#374151;white-space:nowrap">${label}</td>
      <td style="padding:6px 10px;color:#1d4ed8">${ucmr5}</td>
      <td style="padding:6px 10px;color:#92400e">${ccr}</td>
    </tr>`;
}
