<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PFAS Watch — Interactive Map</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #f0f4f8;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Top bar ── */
  #topbar {
    background: #14213d;
    color: #60a5fa;
    padding: 10px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  #topbar h1 { font-size: 13px; font-weight: 700; color: #60a5fa; }
  #topbar p  { font-size: 10px; color: #4a6898; margin-top: 1px; }
  #topbar .badge {
    margin-left: auto;
    background: #fef2f2; color: #b91c1c;
    border: 1px solid #fecaca;
    border-radius: 5px; padding: 3px 10px;
    font-size: 10px; font-weight: 700;
  }

  /* ── Map container ── */
  #map { flex: 1; }
</style>
</head>
<body>

<div id="topbar">
  <div>
    <h1>⚗ PFAS Watch — NJ American Water · Interactive Map</h1>
    <p>19 utilities exceeding EPA MCL · Color = concentration · Circle size = population served</p>
  </div>
  <div class="badge">⚠ 13 UCMR5 + 6 CCR = 19 utilities exceed MCL</div>
</div>

<div id="map"></div>

<script>
// ============================================================
//  DATA — 19 utilities that exceed MCL
//  Fields: name, PWSID, worst contaminant, max ng/L,
//          population served, coordinates, data source
// ============================================================
const UTILITIES = [
  { n:'Camden City',            id:'NJ0408001', ch:'PFOS', mx:12.9, pop:71000,  lat:39.934,  lng:-75.1278, src:'UCMR5' },
  { n:'Atlantic County',        id:'NJ0119002', ch:'PFOA', mx:10.9, pop:112076, lat:39.3814, lng:-74.5760, src:'UCMR5' },
  { n:'Short Hills',            id:'NJ0712001', ch:'PFOA', mx:9.1,  pop:217230, lat:40.7429, lng:-74.3538, src:'UCMR5' },
  { n:'Four Seasons at Chester',id:'NJ1407001', ch:'PFOA', mx:9.0,  pop:500,    lat:40.7785, lng:-74.6879, src:'CCR'   },
  { n:'West Jersey',            id:'NJ1427009', ch:'PFOA', mx:9.0,  pop:2000,   lat:40.8650, lng:-74.7300, src:'CCR'   },
  { n:'Coastal North',          id:'NJ1345001', ch:'PFOA', mx:7.5,  pop:375857, lat:40.3258, lng:-74.0714, src:'UCMR5' },
  { n:'Raritan',                id:'NJ2004002', ch:'PFOA', mx:7.5,  pop:736791, lat:40.5479, lng:-74.5634, src:'UCMR5' },
  { n:'ITC / Mt. Olive',        id:'NJ1427017', ch:'PFOA', mx:7.3,  pop:1750,   lat:40.8773, lng:-74.7222, src:'UCMR5' },
  { n:'Washington / Oxford',    id:'NJ2121001', ch:'PFOS', mx:7.1,  pop:10133,  lat:40.7568, lng:-74.9829, src:'UCMR5' },
  { n:'Shrewsbury - AVMA',      id:'NJ1346001', ch:'PFOA', mx:6.8,  pop:1000,   lat:40.3274, lng:-74.0643, src:'CCR'   },
  { n:'Shorelands',             id:'NJ1339001', ch:'PFOA', mx:6.5,  pop:31908,  lat:40.1749, lng:-74.1652, src:'UCMR5' },
  { n:'Union Beach',            id:'NJ1350001', ch:'PFOA', mx:6.2,  pop:5380,   lat:40.4394, lng:-74.1793, src:'UCMR5' },
  { n:'South Orange Village',   id:'NJ0719001', ch:'PFOA', mx:6.0,  pop:16587,  lat:40.7501, lng:-74.2607, src:'CCR'   },
  { n:'Twin Lakes',             id:'NJ1803002', ch:'PFOA', mx:6.0,  pop:120,    lat:41.0750, lng:-74.5700, src:'CCR'   },
  { n:'Salem',                  id:'NJ1712001', ch:'PFOA', mx:5.6,  pop:5000,   lat:39.5718, lng:-75.4688, src:'CCR'   },
  { n:'Mount Holly',            id:'NJ0323001', ch:'PFOA', mx:4.8,  pop:34733,  lat:39.9932, lng:-74.7856, src:'UCMR5' },
  { n:'Liberty (Elizabeth)',    id:'NJ2004001', ch:'PFOA', mx:4.5,  pop:128124, lat:40.6640, lng:-74.2107, src:'UCMR5' },
  { n:'Little Falls',           id:'NJ1605001', ch:'PFOA', mx:4.5,  pop:16675,  lat:40.8787, lng:-74.2126, src:'UCMR5' },
  { n:'Logan',                  id:'NJ0809002', ch:'PFOA', mx:4.2,  pop:3762,   lat:39.7373, lng:-75.2732, src:'UCMR5' },
];


// ============================================================
//  COLOR — concentration (ng/L) → color
//  Gradient: deep red (highest) → yellow-amber (just over MCL)
// ============================================================
function concentrationColor(mx) {
  if (mx >= 12)  return '#7f1d1d'; // deep red
  if (mx >= 10)  return '#b91c1c'; // red
  if (mx >= 8)   return '#dc2626'; // medium red
  if (mx >= 6)   return '#ea580c'; // orange-red
  if (mx >= 5)   return '#d97706'; // amber
  return         '#ca8a04';        // yellow-amber  (4–5 ng/L)
}


// ============================================================
//  RADIUS — population → circle size using log scale
//  Log scale prevents large utilities from dwarfing small ones.
//  Range: MIN_R (smallest) → MAX_R (largest) in pixels.
// ============================================================
const MIN_R  = 6;
const MAX_R  = 26;
const allPops = UTILITIES.map(u => u.pop);
const logMin  = Math.log(Math.min(...allPops));
const logMax  = Math.log(Math.max(...allPops));

function populationRadius(pop) {
  const t = (Math.log(pop) - logMin) / (logMax - logMin); // 0 → 1
  return MIN_R + t * (MAX_R - MIN_R);
}


// ============================================================
//  BUILD MAP
// ============================================================
const map = L.map('map').setView([40.15, -74.55], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 18,
}).addTo(map);


// ── Plot each utility ──
UTILITIES.forEach(u => {
  const color  = concentrationColor(u.mx);
  const radius = populationRadius(u.pop);
  const isCCR  = u.src === 'CCR';
  const mcl    = 4; // all worst contaminants here are PFOA/PFOS (MCL = 4 ng/L)
  const ratio  = (u.mx / mcl).toFixed(1);

  const marker = L.circleMarker([u.lat, u.lng], {
    radius,
    fillColor:   color,
    color:       isCCR ? '#92400e' : '#fff',  // border: brown for CCR, white for UCMR5
    weight:      isCCR ? 2.5 : 1.5,
    dashArray:   isCCR ? '5,3' : null,        // dashed border for CCR
    opacity:     1,
    fillOpacity: 0.85,
  });

  // ── Popup content ──
  const srcStyle = isCCR
    ? 'background:#fef9c3;color:#92400e'
    : 'background:#dbeafe;color:#1d4ed8';

  marker.bindPopup(`
    <div style="font-family:'Segoe UI',Arial,sans-serif;min-width:180px">
      <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:6px">
        NJAW — ${u.n}
      </div>
      <table style="font-size:10.5px;color:#374151;border-collapse:collapse;width:100%">
        <tr><td style="color:#64748b;padding:2px 0">PWSID</td>        <td style="padding:2px 0;text-align:right;font-family:monospace">${u.id}</td></tr>
        <tr><td style="color:#64748b;padding:2px 0">Population</td>   <td style="padding:2px 0;text-align:right">${u.pop.toLocaleString()}</td></tr>
        <tr><td style="color:#64748b;padding:2px 0">Contaminant</td>  <td style="padding:2px 0;text-align:right"><b>${u.ch}</b></td></tr>
        <tr><td style="color:#64748b;padding:2px 0">Max detected</td> <td style="padding:2px 0;text-align:right"><b>${u.mx} ng/L</b></td></tr>
        <tr><td style="color:#64748b;padding:2px 0">× MCL</td>
            <td style="padding:2px 0;text-align:right">
              <span style="background:#fef2f2;color:#b91c1c;padding:1px 6px;border-radius:4px;font-weight:700;font-size:10px">${ratio}×</span>
            </td></tr>
      </table>
      <div style="margin-top:7px">
        <span style="${srcStyle};padding:1px 7px;border-radius:3px;font-size:9px;font-weight:700">${u.src}</span>
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
    'border:0.5px solid #ccc', 'font-family:Segoe UI,Arial,sans-serif',
    'font-size:10.5px', 'line-height:1.9', 'min-width:170px',
    'box-shadow:0 2px 8px rgba(0,0,0,.12)',
  ].join(';');

  function dot(color, label) {
    return `<div style="display:flex;align-items:center;gap:7px">
      <span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${color};flex-shrink:0"></span>
      <span>${label}</span>
    </div>`;
  }

  div.innerHTML = `
    <b style="display:block;margin-bottom:4px;font-size:11px">Concentration (ng/L)</b>
    ${dot('#7f1d1d', '≥ 12')}
    ${dot('#b91c1c', '10 – 12')}
    ${dot('#dc2626', '8 – 10')}
    ${dot('#ea580c', '6 – 8')}
    ${dot('#d97706', '5 – 6')}
    ${dot('#ca8a04', '4 – 5  (just over MCL)')}
    <hr style="margin:7px 0;border:none;border-top:1px solid #e5e7eb">
    <b style="display:block;margin-bottom:4px;font-size:11px">Circle size = Population</b>
    <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
      <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:#94a3b8;flex-shrink:0"></span>
      <span>Large (700k+)</span>
    </div>
    <div style="display:flex;align-items:center;gap:7px">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#94a3b8;flex-shrink:0;margin-left:7px"></span>
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
</script>
</body>
</html>
