// ============================================================
//  pfas_map.js
//  Builds the interactive Leaflet map.
//  Only shows the 19 utilities that exceed MCL.
//  Color = concentration level · Circle size = population.
//  Called by nav() in pfas_watch.html when map panel opens.
// ============================================================

let mapInitialized = false;

function initMap() {

  // only initialize once — Leaflet breaks if called twice on same div
  if (mapInitialized) return;
  mapInitialized = true;

  // ── Create map centered on New Jersey ──
  const map = L.map('leaflet-map').setView([40.15, -74.55], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);

  // ── Get the 19 exceeding utilities (from pfas_data.js) ──
  const utilities = getExceedingUtilities();

  // ── Radius scale: population → circle size (log scale) ──
  // Log scale prevents Raritan (736k) from dwarfing Twin Lakes (120)
  const allPops = utilities.map(u => u.pop);
  const logMin  = Math.log(Math.min(...allPops));
  const logMax  = Math.log(Math.max(...allPops));
  const MIN_R   = 6;
  const MAX_R   = 26;

  function populationRadius(pop) {
    const t = (Math.log(pop) - logMin) / (logMax - logMin); // 0 → 1
    return MIN_R + t * (MAX_R - MIN_R);
  }

  // ── Color scale: 3 levels matching the MCL table colors ──
  // Red:    ≥ 8 ng/L  (2× MCL or more)
  // Yellow: 6–8 ng/L  (1.5–2× MCL)
  // Green:  4–6 ng/L  (just over MCL)
  function concentrationColor(mx) {
    if (mx >= 8) return '#dc2626'; // red
    if (mx >= 6) return '#eab308'; // yellow
    return        '#16a34a';       // green
  }

  // ── Plot each utility ──
  utilities.forEach(u => {
    // skip utilities without coordinates
    if (!u.lat || !u.lng) return;

    const mx      = getMaxVal(u);
    const color   = concentrationColor(mx);
    const radius  = populationRadius(u.pop);
    const isCCR   = u.source === 'CCR 2024';
    const mcl     = 4; // all worst contaminants here are PFOA/PFOS
    const ratio   = (mx / mcl).toFixed(1);

    const marker = L.circleMarker([u.lat, u.lng], {
      radius,
      fillColor:   color,
      color:       isCCR ? '#92400e' : '#fff', // border: brown=CCR, white=UCMR5
      weight:      isCCR ? 2.5 : 1.5,
      dashArray:   isCCR ? '5,3' : null,       // dashed border for CCR
      opacity:     1,
      fillOpacity: 0.85,
    });

    // ── Popup ──
    const srcStyle = isCCR
      ? 'background:#fef9c3;color:#92400e'
      : 'background:#dbeafe;color:#1d4ed8';

    const contam = u.source === 'UCMR5' ? u.ch : 'PFOA';

    marker.bindPopup(`
      <div style="font-family:'Segoe UI',Arial,sans-serif;min-width:185px">
        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:7px">
          ${u.name}
        </div>
        <table style="font-size:10.5px;color:#374151;border-collapse:collapse;width:100%">
          <tr>
            <td style="color:#64748b;padding:2px 0">PWSID</td>
            <td style="padding:2px 0;text-align:right;font-family:monospace">${u.id}</td>
          </tr>
          <tr>
            <td style="color:#64748b;padding:2px 0">Population</td>
            <td style="padding:2px 0;text-align:right">${u.pop.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="color:#64748b;padding:2px 0">Contaminant</td>
            <td style="padding:2px 0;text-align:right"><b>${contam}</b></td>
          </tr>
          <tr>
            <td style="color:#64748b;padding:2px 0">Max detected</td>
            <td style="padding:2px 0;text-align:right"><b>${mx} ng/L</b></td>
          </tr>
          <tr>
            <td style="color:#64748b;padding:2px 0">× MCL</td>
            <td style="padding:2px 0;text-align:right">
              <span style="background:#fef2f2;color:#b91c1c;padding:1px 6px;
                           border-radius:4px;font-weight:700;font-size:10px">
                ${ratio}×
              </span>
            </td>
          </tr>
        </table>
        <div style="margin-top:7px">
          <span style="${srcStyle};padding:1px 7px;border-radius:3px;
                       font-size:9px;font-weight:700">${u.source}</span>
        </div>
      </div>
    `, { maxWidth: 220 });

    marker.addTo(map);
  });

  // ── Legend ──
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = () => {
    const div = L.DomUtil.create('div');
    div.style.cssText = [
      'background:white', 'padding:11px 14px', 'border-radius:8px',
      'border:0.5px solid #ccc',
      'font-family:Segoe UI,Arial,sans-serif',
      'font-size:10.5px', 'line-height:1.9', 'min-width:175px',
      'box-shadow:0 2px 8px rgba(0,0,0,.12)',
    ].join(';');

    function dot(color, label) {
      return `<div style="display:flex;align-items:center;gap:7px">
        <span style="display:inline-block;width:11px;height:11px;
                     border-radius:50%;background:${color};flex-shrink:0"></span>
        <span>${label}</span>
      </div>`;
    }

    div.innerHTML = `
      <b style="display:block;margin-bottom:4px;font-size:11px">Exceedance Level</b>
      ${dot('#dc2626', '≥ 8 ng/L &nbsp; (2× MCL or more)')}
      ${dot('#eab308', '6–8 ng/L &nbsp; (1.5–2× MCL)')}
      ${dot('#16a34a', '4–6 ng/L &nbsp; (just over MCL)')}
      <hr style="margin:7px 0;border:none;border-top:1px solid #e5e7eb">
      <b style="display:block;margin-bottom:4px;font-size:11px">Circle size = Population</b>
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
        <span style="display:inline-block;width:22px;height:22px;border-radius:50%;
                     background:#94a3b8;flex-shrink:0"></span>
        <span>Large (700k+)</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;
                     background:#94a3b8;flex-shrink:0;margin-left:7px"></span>
        <span>Small (&lt; 500)</span>
      </div>
      <hr style="margin:7px 0;border:none;border-top:1px solid #e5e7eb">
      <div style="font-size:10px;color:#374151">
        Solid border = UCMR5<br>
        <span style="border-bottom:2px dashed #92400e">Dashed border</span> = CCR 2024
      </div>`;

    return div;
  };

  legend.addTo(map);
}
