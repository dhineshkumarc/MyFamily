import { useState, useRef, useEffect, useCallback } from 'react';
import './GardenMap.css';
import { loadGardenMap, saveGardenMap } from '../services/gardenData';
// ─── Leaflet lazy loader ─────────────────────────────────────────────────────
let _leaflet = null;
async function getLeaflet() {
  if (_leaflet) return _leaflet;
  const mod = await import('leaflet');
  await import('leaflet/dist/leaflet.css');
  _leaflet = mod.default ?? mod;
  return _leaflet;
}

const HOME_LAT =  39.48693;
const HOME_LNG = -104.83457;

const MAP_LAYERS = [
  { id: 'satellite', label: '🛰 Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles &copy; Esri &mdash; Source: Esri, DigitalGlobe' },
  { id: 'street', label: '🗺 Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
  { id: 'hybrid', label: '🏘 Hybrid',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles &copy; Esri',
    labels: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { id: 'topo', label: '🏔 USGS Topo',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    attr: 'USGS The National Map: National Boundaries Dataset, 3DEP, Geographic Names, NHD, NLCD, NWI, and NTD' },
];

// Colorado Governor's OIT — official statewide public parcel FeatureServer
const CO_PARCEL_FS =
  'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0';

async function fetchParcelsAroundHome() {
  const params = new URLSearchParams({
    geometry:      `${HOME_LNG},${HOME_LAT}`,
    geometryType:  'esriGeometryPoint',
    inSR:          '4326',
    spatialRel:    'esriSpatialRelIntersects',
    distance:      '300',
    units:         'esriSRUnit_Meter',
    outFields:     '*',
    returnGeometry:'true',
    f:             'geojson',
  });
  const res = await fetch(`${CO_PARCEL_FS}/query?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const PIN_TYPES = [
  { id: 'bed',    emoji: '🌱', label: 'Raised Bed',   color: '#16a34a' },
  { id: 'veggie', emoji: '🍅', label: 'Veggie Patch', color: '#dc2626' },
  { id: 'herbs',  emoji: '🌿', label: 'Herbs',        color: '#0d9488' },
  { id: 'fruit',  emoji: '🍎', label: 'Fruit Tree',   color: '#92400e' },
  { id: 'flower', emoji: '🌸', label: 'Flowers',      color: '#db2777' },
  { id: 'sunny',  emoji: '🌞', label: 'Sunny Spot',   color: '#d97706' },
  { id: 'shady',  emoji: '🌥', label: 'Shady Area',   color: '#6b7280' },
  { id: 'note',   emoji: '📝', label: 'Note',         color: '#7c3aed' },
];

const PINS_KEY  = 'sat-planting-pins';
const ZONES_KEY = 'sat-property-zones';
function loadPins()  { try { return JSON.parse(localStorage.getItem(PINS_KEY))  || []; } catch { return []; } }
function savePins(p) { localStorage.setItem(PINS_KEY,  JSON.stringify(p)); }
function loadZones()  { try { return JSON.parse(localStorage.getItem(ZONES_KEY)) || []; } catch { return []; } }
function saveZones(z) { localStorage.setItem(ZONES_KEY, JSON.stringify(z)); }

const ZONE_PRESETS = [
  { label: 'Backyard',   color: '#16a34a' },
  { label: 'Front Yard', color: '#2563eb' },
  { label: 'Lawn',       color: '#65a30d' },
  { label: 'Patio',      color: '#92400e' },
  { label: 'Side Yard',  color: '#7c3aed' },
  { label: 'Garden Bed', color: '#dc2626' },
  { label: 'Driveway',   color: '#6b7280' },
  { label: 'Custom…',    color: '#d97706' },
];

function makePinHtml(pt, label) {
  return `<div style="background:${pt.color};color:#fff;padding:4px 10px 4px 7px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.42);border:2px solid #fff;display:flex;align-items:center;gap:5px;">`
    + `<span>${pt.emoji}</span><span>${label}</span></div>`;
}

function SatelliteMap() {
  const mapRef         = useRef(null);
  const divRef         = useRef(null);
  const tileRef        = useRef(null);
  const lblRef         = useRef(null);
  const markersRef     = useRef({});   // pinId  → L.Marker
  const polygonsRef    = useRef({});   // zoneId → L.Polygon
  const drawDotsRef    = useRef([]);   // temp L.CircleMarker while drawing
  const previewPolyRef = useRef(null); // L.Polyline preview while drawing
  const parcelLayerRef = useRef(null); // GeoJSON parcel overlay
  const addModeRef     = useRef(false);
  const drawModeRef    = useRef(false);
  const drawPtsRef     = useRef([]);   // live points while drawing

  const [activeId,       setActiveId]      = useState('satellite');
  const [loading,        setLoading]       = useState(true);
  const [parcelStatus,   setParcelStatus]  = useState(null); // null|'loading'|'loaded'|'error'
  const [parcelCount,    setParcelCount]   = useState(0);
  // pin mode
  const [addMode,        setAddMode]       = useState(false);
  const [pins,           setPins]          = useState(loadPins);
  const [pendingPin,     setPendingPin]    = useState(null);
  const [pinLabel,       setPinLabel]      = useState('');
  const [pinType,        setPinType]       = useState('bed');
  const [showPinList,    setShowPinList]   = useState(false);
  // zone draw mode
  const [drawMode,       setDrawMode]      = useState(false);
  const [drawPts,        setDrawPts]       = useState([]);
  const [pendingZone,    setPendingZone]   = useState(null); // points array awaiting form
  const [zoneLabel,      setZoneLabel]     = useState('Backyard');
  const [zoneColor,      setZoneColor]     = useState('#16a34a');
  const [customLabel,    setCustomLabel]   = useState('');
  const [zones,          setZones]         = useState(loadZones);
  const [showZoneList,   setShowZoneList]  = useState(false);

  // keep refs in sync
  useEffect(() => { addModeRef.current  = addMode;  }, [addMode]);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { drawPtsRef.current  = drawPts;  }, [drawPts]);

  useEffect(() => { savePins(pins);   }, [pins]);
  useEffect(() => { saveZones(zones); }, [zones]);

  // ── Sync pin markers ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    getLeaflet().then(L => {
      Object.keys(markersRef.current).forEach(id => {
        if (!pins.find(p => p.id === id)) {
          map.removeLayer(markersRef.current[id]);
          delete markersRef.current[id];
        }
      });
      pins.forEach(pin => {
        if (markersRef.current[pin.id]) return;
        const pt   = PIN_TYPES.find(t => t.id === pin.type) || PIN_TYPES[0];
        const icon = L.divIcon({ className: '', html: makePinHtml(pt, pin.label), iconAnchor: [0, 8] });
        const m = L.marker([pin.lat, pin.lng], { icon }).addTo(map)
          .bindPopup(`<strong>${pt.emoji} ${pin.label}</strong><br><em>${pt.label}</em><br><small>${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}</small><br><br><button onclick="window.__deleteSatPin('${pin.id}')" style="background:#dc2626;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;">🗑 Remove</button>`);
        markersRef.current[pin.id] = m;
      });
    });
  }, [pins]);

  // ── Sync zone polygons ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    getLeaflet().then(L => {
      Object.keys(polygonsRef.current).forEach(id => {
        if (!zones.find(z => z.id === id)) {
          map.removeLayer(polygonsRef.current[id]);
          delete polygonsRef.current[id];
        }
      });
      zones.forEach(zone => {
        if (polygonsRef.current[zone.id]) return;
        const latlngs = zone.points.map(p => [p.lat, p.lng]);
        const poly = L.polygon(latlngs, {
          color:       zone.color,
          fillColor:   zone.color,
          fillOpacity: 0.22,
          weight:      2.5,
          dashArray:   '6 4',
        }).addTo(map);
        poly.bindPopup(
          `<strong>${zone.label}</strong><br>`+
          `<button onclick="window.__deleteZone('${zone.id}')" style="margin-top:6px;background:#dc2626;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;">🗑 Remove zone</button>`
        );
        polygonsRef.current[zone.id] = poly;
      });
    });
  }, [zones]);

  // Global helpers for popup buttons
  useEffect(() => {
    window.__deleteSatPin = (id) => {
      setPins(prev => prev.filter(p => p.id !== id));
      const map = mapRef.current;
      if (map && markersRef.current[id]) { map.removeLayer(markersRef.current[id]); delete markersRef.current[id]; }
      if (mapRef.current) mapRef.current.closePopup();
    };
    window.__deleteZone = (id) => {
      setZones(prev => prev.filter(z => z.id !== id));
      const map = mapRef.current;
      if (map && polygonsRef.current[id]) { map.removeLayer(polygonsRef.current[id]); delete polygonsRef.current[id]; }
      if (mapRef.current) mapRef.current.closePopup();
    };
    return () => { delete window.__deleteSatPin; delete window.__deleteZone; };
  }, []);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    getLeaflet().then(L => {
      if (cancelled || !divRef.current || mapRef.current) return;
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      // Zoom 18 = full property visible, backyard + front yard both in view
      const map = L.map(divRef.current, { zoomControl: true }).setView([HOME_LAT, HOME_LNG], 18);
      mapRef.current = map;
      const tile = L.tileLayer(MAP_LAYERS[0].url, { maxZoom: 21, attribution: MAP_LAYERS[0].attr });
      tile.addTo(map);
      tileRef.current = tile;
      tile.on('load', () => { if (!cancelled) setLoading(false); });
      setTimeout(() => { if (!cancelled) setLoading(false); }, 5000);

      // Home marker
      const homeIcon = L.divIcon({
        className: '',
        html: '<div style="background:#16a34a;color:#fff;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.45);border:2px solid #fff;">🏡 My Garden</div>',
        iconAnchor: [52, 16],
      });
      L.marker([HOME_LAT, HOME_LNG], { icon: homeIcon })
        .addTo(map)
        .bindPopup('<strong>11627 Laurel Ln</strong><br>Parker, CO 80138<br>Zone 6a &bull; 5,869 ft elevation')
        .openPopup();

      // Click: place pin OR add draw point
      map.on('click', (e) => {
        if (addModeRef.current) {
          setPendingPin({ lat: e.latlng.lat, lng: e.latlng.lng });
          setPinLabel('');
          setPinType('bed');
          return;
        }
        if (drawModeRef.current) {
          const pt = { lat: e.latlng.lat, lng: e.latlng.lng };
          const next = [...drawPtsRef.current, pt];
          setDrawPts(next);
          // draw dot
          const dot = L.circleMarker([pt.lat, pt.lng], { radius: 5, color: '#fff', fillColor: '#2d6a4f', fillOpacity: 1, weight: 2 }).addTo(map);
          drawDotsRef.current.push(dot);
          // update preview polyline
          if (previewPolyRef.current) map.removeLayer(previewPolyRef.current);
          if (next.length >= 2) {
            const line = L.polyline(next.map(p => [p.lat, p.lng]), { color: '#2d6a4f', weight: 2, dashArray: '6 4' }).addTo(map);
            previewPolyRef.current = line;
          }
        }
      });

      // Double-click: close polygon
      map.on('dblclick', (e) => {
        L.DomEvent.stopPropagation(e);
        if (!drawModeRef.current) return;
        const pts = drawPtsRef.current;
        if (pts.length < 3) return;
        // Clear preview
        drawDotsRef.current.forEach(d => map.removeLayer(d));
        drawDotsRef.current = [];
        if (previewPolyRef.current) { map.removeLayer(previewPolyRef.current); previewPolyRef.current = null; }
        setPendingZone([...pts]);
        setDrawPts([]);
        setDrawMode(false);
        drawModeRef.current = false;
      });
    });
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  const flyHome = () => {
    if (mapRef.current) mapRef.current.flyTo([HOME_LAT, HOME_LNG], 18, { duration: 1.2 });
  };

  const switchLayer = async (id) => {
    const L   = await getLeaflet();
    const map = mapRef.current;
    if (!map) return;
    const layer = MAP_LAYERS.find(l => l.id === id);
    if (tileRef.current)  map.removeLayer(tileRef.current);
    if (lblRef.current)  { map.removeLayer(lblRef.current); lblRef.current = null; }
    const t = L.tileLayer(layer.url, { maxZoom: 21, attribution: layer.attr });
    t.addTo(map);
    tileRef.current = t;
    if (layer.labels) {
      const lbl = L.tileLayer(layer.labels, { maxZoom: 21, opacity: 0.7 });
      lbl.addTo(map);
      lblRef.current = lbl;
    }
    setActiveId(id);
  };

  // ── Official parcel data from Colorado Governor's OIT ────────────────────
  const loadParcels = async () => {
    const map = mapRef.current;
    if (!map) return;
    // Toggle off if already loaded
    if (parcelLayerRef.current) {
      map.removeLayer(parcelLayerRef.current);
      parcelLayerRef.current = null;
      setParcelStatus(null);
      setParcelCount(0);
      return;
    }
    setParcelStatus('loading');
    try {
      const L    = await getLeaflet();
      const data = await fetchParcelsAroundHome();
      if (!data.features || data.features.length === 0) {
        setParcelStatus('error');
        return;
      }
      const layer = L.geoJSON(data, {
        style: {
          color:       '#f59e0b',
          fillColor:   '#fef3c7',
          fillOpacity: 0.25,
          weight:      2.5,
        },
        onEachFeature(feat, lyr) {
          const p = feat.properties || {};
          const rows = [
            ['Parcel ID',    p.PARCEL_ID || p.APN || p.ParcelId || p.OBJECTID || '—'],
            ['Owner',        p.OWNER_NAME || p.OwnerName || p.OWNER1 || '—'],
            ['Address',      p.SITUS_ADDR || p.SitusAddress || p.ADDRESS || '—'],
            ['Acreage',      p.LAND_ACRES != null ? `${Number(p.LAND_ACRES).toFixed(4)} ac` : (p.LandAcres != null ? `${Number(p.LandAcres).toFixed(4)} ac` : '—')],
            ['Sq Ft',        p.LAND_SQFT  != null ? `${Number(p.LAND_SQFT).toLocaleString()} sq ft`  : '—'],
            ['County',       p.COUNTY_NAME || p.CountyName || 'Douglas'],
          ].filter(([, v]) => v && v !== '—');
          const table = rows.map(([k, v]) => `<tr><td style="padding:1px 8px 1px 0;color:#6b7280;font-size:11px;">${k}</td><td style="font-size:11px;font-weight:600;">${v}</td></tr>`).join('');
          lyr.bindPopup(
            `<div style="min-width:220px"><strong style="color:#92400e;">📋 Official Parcel Record</strong><br>`+
            `<small style="color:#9ca3af;">Source: Colorado Governor's OIT</small><br><br>`+
            `<table>${table}</table></div>`
          );
        },
      }).addTo(map);
      parcelLayerRef.current = layer;
      // zoom to fit parcels
      try { map.flyToBounds(layer.getBounds(), { padding: [40, 40], duration: 1 }); } catch (_) {}
      setParcelStatus('loaded');
      setParcelCount(data.features.length);
    } catch (err) {
      console.warn('Parcel fetch failed:', err);
      setParcelStatus('error');
    }
  };

  // ── Pin commit ────────────────────────────────────────────────────────────
  const commitPin = () => {
    if (!pendingPin || !pinLabel.trim()) return;
    setPins(prev => [...prev, { id: Date.now().toString(), lat: pendingPin.lat, lng: pendingPin.lng, label: pinLabel.trim(), type: pinType }]);
    setPendingPin(null);
    setAddMode(false);
    addModeRef.current = false;
  };
  const cancelPin = () => { setPendingPin(null); };
  const removePinFromList = (id) => {
    setPins(prev => prev.filter(p => p.id !== id));
    const map = mapRef.current;
    if (map && markersRef.current[id]) { map.removeLayer(markersRef.current[id]); delete markersRef.current[id]; }
  };
  const flyToPin = (pin) => { if (mapRef.current) mapRef.current.flyTo([pin.lat, pin.lng], 20, { duration: 0.9 }); setShowPinList(false); };

  // ── Zone commit ───────────────────────────────────────────────────────────
  const commitZone = () => {
    if (!pendingZone) return;
    const finalLabel = zoneLabel === 'Custom…' ? (customLabel.trim() || 'My Zone') : zoneLabel;
    setZones(prev => [...prev, { id: Date.now().toString(), label: finalLabel, color: zoneColor, points: pendingZone }]);
    setPendingZone(null);
    setCustomLabel('');
  };
  const cancelZone = () => { setPendingZone(null); };
  const cancelDraw = () => {
    const map = mapRef.current;
    if (map) {
      drawDotsRef.current.forEach(d => map.removeLayer(d));
      drawDotsRef.current = [];
      if (previewPolyRef.current) { map.removeLayer(previewPolyRef.current); previewPolyRef.current = null; }
    }
    setDrawPts([]);
    setDrawMode(false);
    drawModeRef.current = false;
  };
  const removeZoneFromList = (id) => {
    setZones(prev => prev.filter(z => z.id !== id));
    const map = mapRef.current;
    if (map && polygonsRef.current[id]) { map.removeLayer(polygonsRef.current[id]); delete polygonsRef.current[id]; }
  };
  const flyToZone = (zone) => {
    if (!mapRef.current || !polygonsRef.current[zone.id]) return;
    mapRef.current.flyToBounds(polygonsRef.current[zone.id].getBounds(), { padding: [30, 30], duration: 0.9 });
    setShowZoneList(false);
  };

  const selectedPt = PIN_TYPES.find(t => t.id === pinType) || PIN_TYPES[0];
  const cursorClass = addMode || drawMode ? ' satmap-crosshair' : '';

  return (
    <div className="satmap-wrap">
      {/* Controls row */}
      <div className="satmap-controls">
        <div className="satmap-layers">
          {MAP_LAYERS.map(l => (
            <button key={l.id}
              className={'satlayer-btn' + (activeId === l.id ? ' active' : '')}
              onClick={() => switchLayer(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        <div className="satmap-actions">
          {/* Draw zone button */}
          <button
            className={'satmap-zone-btn' + (drawMode ? ' active' : '')}
            title="Trace your backyard, lawn, patio etc. as a coloured overlay"
            onClick={() => {
              if (drawMode) { cancelDraw(); } else { setDrawMode(true); setAddMode(false); addModeRef.current = false; }
            }}>
            {drawMode ? `✕ Cancel (${drawPts.length} pts)` : '📐 Draw Zone'}
          </button>
          {/* Pin button */}
          <button
            className={'satmap-pin-btn' + (addMode ? ' active' : '')}
            title="Drop a planting pin"
            onClick={() => { setAddMode(m => !m); setPendingPin(null); if (drawMode) cancelDraw(); }}>
            {addMode ? '✕ Cancel Pin' : '📌 Plan Planting'}
          </button>
          {/* Official parcel data */}
          <button
            className={'satmap-parcel-btn' + (parcelStatus === 'loaded' ? ' active' : '') + (parcelStatus === 'error' ? ' error' : '')}
            title="Load official property parcel boundaries from Colorado Governor's OIT"
            disabled={parcelStatus === 'loading'}
            onClick={loadParcels}>
            {parcelStatus === 'loading' && '⏳ Loading…'}
            {parcelStatus === 'loaded'  && `✕ ${parcelCount} Parcel${parcelCount !== 1 ? 's' : ''}`}
            {parcelStatus === 'error'   && '⚠ Retry Parcel'}
            {!parcelStatus              && '🏛 Official Parcel'}
          </button>
          {zones.length > 0 && (
            <button className="satmap-list-btn satmap-zonelist-btn" onClick={() => { setShowZoneList(s => !s); setShowPinList(false); }}>
              🗺 {zones.length} Zone{zones.length !== 1 ? 's' : ''}
            </button>
          )}
          {pins.length > 0 && (
            <button className="satmap-list-btn" onClick={() => { setShowPinList(s => !s); setShowZoneList(false); }}>
              🌱 {pins.length} Pin{pins.length !== 1 ? 's' : ''}
            </button>
          )}
          <button className="satmap-home-btn" onClick={flyHome}>📍 My House</button>
        </div>
      </div>

      {/* Draw-mode hint */}
      {drawMode && !pendingZone && (
        <div className="satmap-add-hint satmap-draw-hint">
          📐 <strong>Click</strong> to trace your zone boundary &nbsp;·&nbsp; <strong>Double-click</strong> to finish
          {drawPts.length > 0 && <span className="satmap-pts-count"> ({drawPts.length} point{drawPts.length !== 1 ? 's' : ''} — need {Math.max(0, 3 - drawPts.length)} more)</span>}
        </div>
      )}

      {/* Pin add-mode hint */}
      {addMode && !pendingPin && (
        <div className="satmap-add-hint">
          📌 Click anywhere on your property to drop a planting pin
        </div>
      )}

      {/* Zone name form */}
      {pendingZone && (
        <div className="satpin-form">
          <div className="satpin-form-title">📐 Name this zone ({pendingZone.length} points)</div>
          <div className="satpin-type-row">
            {ZONE_PRESETS.map(zp => (
              <button key={zp.label}
                className={'satpin-type-btn' + (zoneLabel === zp.label ? ' active' : '')}
                style={zoneLabel === zp.label ? { borderColor: zp.color, background: zp.color + '22' } : {}}
                onClick={() => { setZoneLabel(zp.label); setZoneColor(zp.color); }}>
                {zp.label}
              </button>
            ))}
          </div>
          {zoneLabel === 'Custom…' && (
            <div className="satpin-form-row">
              <input className="satpin-input" placeholder="Enter zone name…" autoFocus
                value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitZone(); if (e.key === 'Escape') cancelZone(); }} />
            </div>
          )}
          <div className="satzone-color-row">
            <span className="satzone-color-label">Color:</span>
            {['#16a34a','#2563eb','#65a30d','#dc2626','#7c3aed','#d97706','#0d9488','#6b7280'].map(c => (
              <button key={c} className={'satzone-color-btn' + (zoneColor === c ? ' active' : '')}
                style={{ background: c, outline: zoneColor === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
                onClick={() => setZoneColor(c)} />
            ))}
            <input type="color" value={zoneColor} onChange={e => setZoneColor(e.target.value)}
              title="Pick custom color" className="satzone-color-picker" />
          </div>
          <div className="satpin-form-actions">
            <button className="satpin-save-btn" style={{ background: zoneColor }} onClick={commitZone}>
              ✓ Save Zone
            </button>
            <button className="satpin-cancel-btn" onClick={cancelZone}>Cancel</button>
          </div>
        </div>
      )}

      {/* Pending-pin form */}
      {pendingPin && (
        <div className="satpin-form">
          <div className="satpin-form-title">📌 Name this planting spot</div>
          <div className="satpin-form-row">
            <input className="satpin-input" placeholder="e.g. South raised bed, Tomato corner…"
              value={pinLabel} autoFocus onChange={e => setPinLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitPin(); if (e.key === 'Escape') cancelPin(); }} />
          </div>
          <div className="satpin-type-row">
            {PIN_TYPES.map(pt => (
              <button key={pt.id}
                className={'satpin-type-btn' + (pinType === pt.id ? ' active' : '')}
                style={pinType === pt.id ? { borderColor: pt.color, background: pt.color + '22' } : {}}
                onClick={() => setPinType(pt.id)}>
                {pt.emoji} {pt.label}
              </button>
            ))}
          </div>
          <div className="satpin-form-actions">
            <button className="satpin-save-btn" style={{ background: selectedPt.color }}
              disabled={!pinLabel.trim()} onClick={commitPin}>
              {selectedPt.emoji} Add Pin
            </button>
            <button className="satpin-cancel-btn" onClick={cancelPin}>Cancel</button>
          </div>
        </div>
      )}

      {/* Zone list */}
      {showZoneList && zones.length > 0 && (
        <div className="satpin-list">
          <div className="satpin-list-header">
            <span>🗺 Property Zones ({zones.length})</span>
            <button className="satpin-list-close" onClick={() => setShowZoneList(false)}>✕</button>
          </div>
          {zones.map(z => (
            <div key={z.id} className="satpin-list-item">
              <span className="satpin-list-emoji" style={{ color: z.color }}>⬡</span>
              <span className="satpin-list-label">{z.label}</span>
              <span className="satpin-list-type">{z.points.length} pts</span>
              <button className="satpin-list-fly" onClick={() => flyToZone(z)} title="Zoom to zone">🎯</button>
              <button className="satpin-list-del" onClick={() => removeZoneFromList(z.id)} title="Remove">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Pin list */}
      {showPinList && pins.length > 0 && (
        <div className="satpin-list">
          <div className="satpin-list-header">
            <span>🌱 Planting Pins ({pins.length})</span>
            <button className="satpin-list-close" onClick={() => setShowPinList(false)}>✕</button>
          </div>
          {pins.map(pin => {
            const pt = PIN_TYPES.find(t => t.id === pin.type) || PIN_TYPES[0];
            return (
              <div key={pin.id} className="satpin-list-item">
                <span className="satpin-list-emoji" style={{ color: pt.color }}>{pt.emoji}</span>
                <span className="satpin-list-label">{pin.label}</span>
                <span className="satpin-list-type">{pt.label}</span>
                <button className="satpin-list-fly" onClick={() => flyToPin(pin)} title="Fly to pin">🎯</button>
                <button className="satpin-list-del" onClick={() => removePinFromList(pin.id)} title="Remove">✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Map canvas */}
      <div style={{ position: 'relative' }}>
        {loading && (
          <div className="satmap-loading">
            <div className="satmap-spinner" />
            Loading satellite imagery for Parker, CO…
          </div>
        )}
        <div ref={divRef} className={'satmap-leaflet' + cursorClass} />
      </div>

      <div className="satmap-footer">
        📍 <strong>11627 Laurel Ln, Parker, CO 80138</strong>
        &nbsp;·&nbsp; Zone 6a &nbsp;·&nbsp; 5,869 ft elevation
        {drawMode && <>&nbsp;·&nbsp; <strong style={{color:'#2d6a4f'}}>Double-click to close polygon</strong></>}
        {!drawMode && !addMode && <>&nbsp;·&nbsp; Scroll to zoom &nbsp;·&nbsp; Drag to pan</>}
      </div>

      {/* Official government sources */}
      <div className="satmap-gov-panel">
        <div className="satmap-gov-title">🏛 Official Government Property Records</div>
        <div className="satmap-gov-links">
          <a className="satmap-gov-link" href="https://www.douglas.co.us/assessor/property-information/property-search/" target="_blank" rel="noopener noreferrer">
            <span className="satmap-gov-icon">📋</span>
            <span>
              <strong>Douglas County Assessor</strong><br/>
              <small>Property search, valuation &amp; ownership records</small>
            </span>
          </a>
          <a className="satmap-gov-link" href="https://gis.douglas.co.us/" target="_blank" rel="noopener noreferrer">
            <span className="satmap-gov-icon">🗺</span>
            <span>
              <strong>Douglas County GIS Portal</strong><br/>
              <small>Interactive parcel &amp; zoning map viewer</small>
            </span>
          </a>
          <a className="satmap-gov-link" href="https://geodata.colorado.gov/datasets/COOIT::colorado-public-parcels" target="_blank" rel="noopener noreferrer">
            <span className="satmap-gov-icon">🏔</span>
            <span>
              <strong>Colorado State Parcel Data</strong><br/>
              <small>Statewide parcel boundaries · Governor's OIT</small>
            </span>
          </a>
          <a className="satmap-gov-link" href={`https://apps.nationalmap.gov/viewer/#/|zoom=18&lat=${HOME_LAT}&lng=${HOME_LNG}`} target="_blank" rel="noopener noreferrer">
            <span className="satmap-gov-icon">🇺🇸</span>
            <span>
              <strong>USGS National Map</strong><br/>
              <small>Federal topo, imagery &amp; elevation data</small>
            </span>
          </a>
          <a className="satmap-gov-link" href="https://www.parkerco.gov/" target="_blank" rel="noopener noreferrer">
            <span className="satmap-gov-icon">🏘</span>
            <span>
              <strong>Town of Parker</strong><br/>
              <small>Local permits, codes &amp; zoning ordinances</small>
            </span>
          </a>
        </div>
        {parcelStatus === 'loaded' && (
          <div className="satmap-gov-note">
            ✅ Parcel overlay loaded from Colorado state GIS — amber outlines show official parcel boundaries. Click any parcel for its record.
          </div>
        )}
        {parcelStatus === 'error' && (
          <div className="satmap-gov-note satmap-gov-note-warn">
            ⚠ Could not reach the Colorado parcel service. You may be offline, or the state GIS server is temporarily down. Use the links above to look up your parcel directly.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Constants ──────────────────────────────────────────────────────────────
const GRID = 20;                // px per grid cell
const FEET = 2;                 // real feet per grid cell
const CW   = 820;               // canvas width
const CH   = 620;               // canvas height
const COLS = Math.floor(CW / GRID);
const ROWS = Math.floor(CH / GRID);

const CROPS = [
  'Tomatoes','Peppers','Cucumbers','Zucchini','Beans','Peas','Lettuce',
  'Spinach','Kale','Broccoli','Cabbage','Carrots','Beets','Radishes',
  'Onions','Garlic','Herbs','Basil','Corn','Winter Squash','Strawberries',
  'Sunflowers','Flowers','Fruit Tree','Shrub','Other',
];

const CROP_EMOJI = {
  Tomatoes:'🍅', Peppers:'🌶️', Cucumbers:'🥒', Zucchini:'🥒', Beans:'🫘', Peas:'🫛',
  Lettuce:'🥬', Spinach:'🥬', Kale:'🥬', Broccoli:'🥦', Cabbage:'🥦', Carrots:'🥕',
  Beets:'🩷', Radishes:'🌸', Onions:'🧅', Garlic:'🧄', Herbs:'🌿', Basil:'🌿',
  Corn:'🌽', 'Winter Squash':'🎃', Strawberries:'🍓', Sunflowers:'🌻', Flowers:'🌸',
  'Fruit Tree':'🍎', Shrub:'🌳', Other:'🌱',
};

const SUN_OPTIONS = ['Full Sun (6+ hrs)', 'Partial Shade (3–6 hrs)', 'Full Shade (<3 hrs)'];

const ZONE_DEFAULTS = {
  rect:    { label:'Raised Bed',   color:'#c8a96e', sunExposure:'Full Sun (6+ hrs)' },
  polygon: { label:'Zone',         color:'#86efac', sunExposure:'Full Sun (6+ hrs)' },
  marker:  { label:'Plant',        color:'#fbbf24', crop:'Tomatoes' },
  shade:   { label:'Shade Zone',   color:'#94a3b8', sunExposure:'Full Shade (<3 hrs)', opacity:0.45 },
};

const PRESET_COLORS = ['#c8a96e','#86efac','#fbbf24','#94a3b8','#f9a8d4','#a5f3fc','#fde68a','#c4b5fd','#fdba74','#6ee7b7'];

const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const snap = v  => Math.round(v / GRID) * GRID;
const ptStr = pts => pts.map(p => p.join(',')).join(' ');

function getSvgXY(e, svgEl) {
  const r = svgEl.getBoundingClientRect();
  return [
    Math.max(0, Math.min(CW, snap(e.clientX - r.left))),
    Math.max(0, Math.min(CH, snap(e.clientY - r.top))),
  ];
}

// ─── Shape renderers ────────────────────────────────────────────────────────
function RaisedBed({ s, selected, onClick }) {
  const w = s.w || 0, h = s.h || 0;
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect x={s.x} y={s.y} width={w} height={h}
        fill={s.color} fillOpacity={0.55}
        stroke={selected ? '#1d4ed8' : '#92400e'}
        strokeWidth={selected ? 2.5 : 1.5} rx={3} />
      {Math.abs(w) > 36 && Math.abs(h) > 16 && (
        <text x={s.x + w / 2} y={s.y + h / 2 + 4}
          textAnchor="middle" fontSize={11} fill="#3b1f00" fontWeight="700"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {s.label}
        </text>
      )}
    </g>
  );
}

function ZoneShape({ s, selected, onClick }) {
  if (!s.points || s.points.length < 3) return null;
  const cx = s.points.reduce((a, p) => a + p[0], 0) / s.points.length;
  const cy = s.points.reduce((a, p) => a + p[1], 0) / s.points.length;
  const isShade = s.type === 'shade';
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <polygon points={ptStr(s.points)}
        fill={s.color} fillOpacity={isShade ? (s.opacity ?? 0.4) : 0.4}
        stroke={selected ? '#1d4ed8' : s.color}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={isShade ? '6,4' : undefined} />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={11}
        fill="#1b4332" fontWeight="700"
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {s.label}
      </text>
    </g>
  );
}

function PlantMarker({ s, selected, onClick }) {
  const emoji = CROP_EMOJI[s.crop] || '🌱';
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <circle cx={s.x} cy={s.y} r={15}
        fill={selected ? '#1d4ed8' : s.color}
        stroke={selected ? '#1e40af' : '#fff'} strokeWidth={2} />
      <text x={s.x} y={s.y + 5} textAnchor="middle" fontSize={14}
        style={{ pointerEvents: 'none', userSelect: 'none' }}>{emoji}</text>
      <text x={s.x} y={s.y + 28} textAnchor="middle" fontSize={9}
        fill="#374151" fontWeight="600"
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {s.label || s.crop}
      </text>
    </g>
  );
}

function ShapeEl({ s, selectedId, onSelect }) {
  const selected = s.id === selectedId;
  const click = (e) => { e.stopPropagation(); onSelect(s.id); };
  if (s.type === 'rect')   return <RaisedBed s={s} selected={selected} onClick={click} />;
  if (s.type === 'marker') return <PlantMarker s={s} selected={selected} onClick={click} />;
  return <ZoneShape s={s} selected={selected} onClick={click} />;
}

// ─── Page tabs ───────────────────────────────────────────────────────────────
const PAGE_TABS = ['🛰 Satellite Map', '📐 Sketch Planner'];

// ─── Sketch planner ──────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'select',  icon: '↖',  label: 'Select',       hint: 'Click any shape to view and edit its properties' },
  { id: 'rect',    icon: '▭',  label: 'Raised Bed',    hint: 'Click and drag to draw a raised bed rectangle' },
  { id: 'polygon', icon: '⬡',  label: 'Zone',          hint: 'Click to place corners, double-click to close (lawn, path, border...)' },
  { id: 'shade',   icon: '🌥', label: 'Shade Zone',    hint: 'Click to trace the shaded area, double-click to close' },
  { id: 'marker',  icon: '📍', label: 'Plant Marker',  hint: 'Click anywhere to drop a crop marker pin' },
];

function SketchPlanner() {
  const [shapes,     setShapes]    = useState(() => loadGardenMap().shapes || []);
  const [tool,       setTool]      = useState('select');
  const [selectedId, setSelectedId]= useState(null);
  const [rectStart,  setRectStart] = useState(null);
  const [rectPrev,   setRectPrev]  = useState(null);
  const [polyPts,    setPolyPts]   = useState([]);
  const [mousePos,   setMousePos]  = useState(null);
  const svgRef = useRef(null);

  const persist = useCallback((next) => {
    setShapes(next);
    saveGardenMap({ shapes: next });
  }, []);

  const selected = shapes.find(s => s.id === selectedId) || null;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        persist(shapes.filter(s => s.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === 'Escape') { setPolyPts([]); setRectStart(null); setRectPrev(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, shapes, persist]);

  const xy = (e) => getSvgXY(e, svgRef.current);

  const switchTool = (id) => {
    setTool(id);
    setPolyPts([]);
    setRectStart(null);
    setRectPrev(null);
  };

  // ── Drawing events ──────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    if (tool === 'rect') {
      const pt = xy(e);
      setRectStart(pt);
      setRectPrev(null);
    }
  };

  const onMouseMove = (e) => {
    const [x, y] = xy(e);
    setMousePos([x, y]);
    if (tool === 'rect' && rectStart) {
      const [sx, sy] = rectStart;
      setRectPrev({ x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) });
    }
  };

  const onMouseUp = (e) => {
    if (tool === 'rect' && rectStart) {
      const [x, y] = xy(e);
      const [sx, sy] = rectStart;
      const rx = Math.min(sx, x), ry = Math.min(sy, y);
      const rw = Math.abs(x - sx), rh = Math.abs(y - sy);
      if (rw >= GRID && rh >= GRID) {
        const count = shapes.filter(s => s.type === 'rect').length + 1;
        const ns = {
          id: uid(), type: 'rect',
          label: `Raised Bed ${count}`,
          x: rx, y: ry, w: rw, h: rh,
          color: ZONE_DEFAULTS.rect.color,
          sunExposure: ZONE_DEFAULTS.rect.sunExposure,
          notes: '',
        };
        const next = [...shapes, ns];
        persist(next);
        setSelectedId(ns.id);
        setTool('select');
      }
      setRectStart(null);
      setRectPrev(null);
    }
  };

  const onSvgClick = (e) => {
    // Only fire if the click was directly on the SVG background (not a child shape)
    if (e.target !== svgRef.current) return;
    const [x, y] = xy(e);

    if (tool === 'polygon' || tool === 'shade') {
      setPolyPts(prev => [...prev, [x, y]]);
      return;
    }
    if (tool === 'marker') {
      const count = shapes.filter(s => s.type === 'marker').length + 1;
      const ns = {
        id: uid(), type: 'marker',
        label: `Plant ${count}`, x, y,
        crop: 'Tomatoes', color: ZONE_DEFAULTS.marker.color, notes: '',
      };
      const next = [...shapes, ns];
      persist(next);
      setSelectedId(ns.id);
      setTool('select');
      return;
    }
    if (tool === 'select') {
      setSelectedId(null);
    }
  };

  const onDblClick = (e) => {
    if ((tool === 'polygon' || tool === 'shade') && polyPts.length >= 3) {
      const isShade = tool === 'shade';
      const count = shapes.filter(s => s.type === tool).length + 1;
      const ns = {
        id: uid(), type: tool,
        label: isShade ? `Shade Zone ${count}` : `Zone ${count}`,
        points: [...polyPts],
        color: isShade ? ZONE_DEFAULTS.shade.color : ZONE_DEFAULTS.polygon.color,
        sunExposure: isShade ? ZONE_DEFAULTS.shade.sunExposure : ZONE_DEFAULTS.polygon.sunExposure,
        opacity: isShade ? 0.45 : 0.4,
        notes: '',
      };
      const next = [...shapes, ns];
      persist(next);
      setSelectedId(ns.id);
      setPolyPts([]);
      setTool('select');
    }
  };

  // ── Properties panel ────────────────────────────────────────────────────
  const updateSelected = (patch) => {
    persist(shapes.map(s => s.id === selectedId ? { ...s, ...patch } : s));
  };

  const deleteSelected = () => {
    persist(shapes.filter(s => s.id !== selectedId));
    setSelectedId(null);
  };

  const rectFt = s => s.type === 'rect'
    ? `${((s.w / GRID) * FEET).toFixed(0)} × ${((s.h / GRID) * FEET).toFixed(0)} ft (${(((s.w / GRID) * FEET) * ((s.h / GRID) * FEET)).toFixed(0)} sq ft)`
    : null;

  return (
    <div>
      <div className="gmap-outer" style={{ paddingTop: 0 }}>

        {/* Toolbar */}
        <div className="gmap-toolbar">
          <div className="gmap-tools">
            {TOOLS.map(t => (
              <button key={t.id}
                className={'gtool-btn' + (tool === t.id ? ' active' : '')}
                title={t.hint}
                onClick={() => switchTool(t.id)}>
                <span className="gtool-icon">{t.icon}</span>
                <span className="gtool-label">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="gmap-toolbar-right">
            <span className="gmap-hint">{TOOLS.find(t => t.id === tool)?.hint}</span>
            <button className="gmap-action-btn undo-btn" title="Remove last added shape"
              onClick={() => { const n = [...shapes]; n.pop(); persist(n); setSelectedId(null); }}>
              ↩ Undo
            </button>
            <button className="gmap-action-btn clear-btn"
              onClick={() => { if (confirm('Clear the entire map?')) { persist([]); setSelectedId(null); } }}>
              🗑 Clear All
            </button>
          </div>
        </div>

        {/* Polygon in-progress hint bar */}
        {(tool === 'polygon' || tool === 'shade') && polyPts.length > 0 && (
          <div className="gmap-poly-hint">
            ✏️ {polyPts.length} point{polyPts.length > 1 ? 's' : ''} placed.
            {polyPts.length >= 3 ? ' Double-click to close and save the shape.' : ' Click to add more corners.'}
            <button onClick={() => setPolyPts([])}>Cancel</button>
          </div>
        )}

        <div className="gmap-body">
          {/* SVG Canvas */}
          <div className="gmap-canvas-wrap">
            <div className="gmap-canvas-scroll">
              <svg
                ref={svgRef}
                width={CW} height={CH}
                className="gmap-svg"
                style={{ cursor: tool === 'select' ? 'default' : tool === 'marker' ? 'copy' : 'crosshair' }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onClick={onSvgClick}
                onDoubleClick={onDblClick}
              >
                <defs>
                  <pattern id="smallGrid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                    <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#d1fae5" strokeWidth="0.5" />
                  </pattern>
                  <pattern id="bigGrid" width={GRID * 5} height={GRID * 5} patternUnits="userSpaceOnUse">
                    <rect width={GRID * 5} height={GRID * 5} fill="url(#smallGrid)" />
                    <path d={`M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}`} fill="none" stroke="#86efac" strokeWidth="1" />
                  </pattern>
                </defs>
                {/* Background */}
                <rect width={CW} height={CH} fill="#f0fdf4" />
                <rect width={CW} height={CH} fill="url(#bigGrid)" />

                {/* Ruler labels */}
                {Array.from({ length: Math.floor(CW / (GRID * 5)) + 1 }, (_, i) => i * GRID * 5).map(x => (
                  <text key={'rx' + x} x={x + 3} y={11} fontSize={9} fill="#9ca3af">{(x / GRID * FEET)}′</text>
                ))}
                {Array.from({ length: Math.floor(CH / (GRID * 5)) + 1 }, (_, i) => i * GRID * 5).map(y => (
                  y > 0 && <text key={'ry' + y} x={3} y={y + 10} fontSize={9} fill="#9ca3af">{(y / GRID * FEET)}′</text>
                ))}

                {/* Shapes */}
                {shapes.map(s => (
                  <ShapeEl key={s.id} s={s} selectedId={selectedId}
                    onSelect={(id) => { setSelectedId(id); setTool('select'); }} />
                ))}

                {/* Rect draw preview */}
                {rectPrev && rectPrev.w > 0 && rectPrev.h > 0 && (
                  <rect x={rectPrev.x} y={rectPrev.y} width={rectPrev.w} height={rectPrev.h}
                    fill="#c8a96e" fillOpacity={0.3} stroke="#92400e"
                    strokeWidth={2} strokeDasharray="6,3" rx={2} />
                )}

                {/* Polygon in-progress */}
                {polyPts.length > 0 && mousePos && (
                  <>
                    <polyline
                      points={ptStr([...polyPts, mousePos])}
                      fill="none"
                      stroke={tool === 'shade' ? '#64748b' : '#16a34a'}
                      strokeWidth={1.5} strokeDasharray="5,3" />
                    {polyPts.map((p, i) => (
                      <circle key={i} cx={p[0]} cy={p[1]} r={4}
                        fill={tool === 'shade' ? '#64748b' : '#16a34a'} />
                    ))}
                  </>
                )}
              </svg>
            </div>

            {/* Scale bar */}
            <div className="gmap-scale">
              <span>1 small square = {FEET} ft &nbsp;·&nbsp; 1 large square = {FEET * 5} ft</span>
              <span>Canvas = {COLS * FEET} ft × {ROWS * FEET} ft</span>
              <span>{shapes.filter(s => s.type === 'rect').length} beds &nbsp;·&nbsp; {shapes.filter(s => s.type === 'marker').length} plant markers &nbsp;·&nbsp; {shapes.filter(s => s.type === 'polygon' || s.type === 'shade').length} zones</span>
            </div>
          </div>

          {/* Properties / Guide Panel */}
          {selected ? (
            <div className="gmap-props">
              <h3 className="gmap-props-title">✏️ Edit Shape</h3>

              <label className="prop-label">Name
                <input type="text" className="prop-input" value={selected.label}
                  onChange={e => updateSelected({ label: e.target.value })} />
              </label>

              {selected.type === 'marker' && (
                <label className="prop-label">Crop
                  <select className="prop-input" value={selected.crop || 'Tomatoes'}
                    onChange={e => updateSelected({ crop: e.target.value })}>
                    {CROPS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
              )}

              {selected.type !== 'marker' && (
                <label className="prop-label">Sun Exposure
                  <select className="prop-input" value={selected.sunExposure || SUN_OPTIONS[0]}
                    onChange={e => updateSelected({ sunExposure: e.target.value })}>
                    {SUN_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </label>
              )}

              <label className="prop-label">Color
                <div className="prop-color-row">
                  <input type="color" className="prop-color-picker" value={selected.color}
                    onChange={e => updateSelected({ color: e.target.value })} />
                  <span className="prop-color-hint">or pick a preset:</span>
                </div>
                <div className="color-presets">
                  {PRESET_COLORS.map(c => (
                    <button key={c} className={'color-dot' + (c === selected.color ? ' active' : '')}
                      style={{ background: c }} title={c}
                      onClick={() => updateSelected({ color: c })} />
                  ))}
                </div>
              </label>

              {selected.type === 'rect' && (
                <div className="prop-info">
                  📐 {rectFt(selected)}
                </div>
              )}

              <label className="prop-label">Notes
                <textarea className="prop-textarea" value={selected.notes || ''} rows={3}
                  placeholder="Soil mix, crops planned, year added, irrigation notes..."
                  onChange={e => updateSelected({ notes: e.target.value })} />
              </label>

              <button className="gmap-delete-btn" onClick={deleteSelected}>🗑️ Delete Shape</button>
              <p className="gmap-kbd-hint">Tip: Delete key also removes the selected shape</p>
            </div>
          ) : (
            <div className="gmap-props">
              <div className="gmap-legend">
                <h3>🗺️ Legend</h3>
                <div className="legend-row"><span className="legend-swatch" style={{ background: '#c8a96e' }} />Raised Bed</div>
                <div className="legend-row"><span className="legend-swatch" style={{ background: '#86efac' }} />Lawn / Zone</div>
                <div className="legend-row"><span className="legend-swatch" style={{ background: '#94a3b8' }} />Shade Zone</div>
                <div className="legend-row"><span className="legend-swatch" style={{ background: '#fbbf24' }} />Plant Marker</div>
              </div>
              <div className="gmap-guide">
                <h3>💡 How to Use</h3>
                <ul>
                  <li><strong>Raised Bed</strong> — click + drag a rectangle</li>
                  <li><strong>Zone</strong> — click corners, double-click to finish</li>
                  <li><strong>Shade Zone</strong> — same as zone, marks shaded areas</li>
                  <li><strong>Plant Marker</strong> — single click to drop a marker</li>
                  <li><strong>Select ↖</strong> — click shape → edit name, crop, color, notes</li>
                  <li>Press <kbd>Delete</kbd> to remove selected shape</li>
                  <li>Press <kbd>Esc</kbd> to cancel current drawing</li>
                  <li>All changes save automatically to cloud ☁️</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Exported page with satellite + sketch tabs ───────────────────────────────
export default function GardenMap() {
  const [tab, setTab] = useState('🛰 Satellite Map');
  return (
    <main className="gmap-page">
      <div className="page-hero gmap-hero">
        <h1>🗺️ Garden Map Planner</h1>
        <p>View your property via satellite · Sketch beds, zones &amp; plants · Auto-saved ☁️</p>
      </div>
      <div className="gmap-outer">
        <div className="gmap-page-tabs">
          {PAGE_TABS.map(t => (
            <button key={t}
              className={'gmap-page-tab' + (tab === t ? ' active' : '')}
              onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        {tab === '🛰 Satellite Map' && <SatelliteMap />}
        {tab === '📐 Sketch Planner' && <SketchPlanner />}
      </div>
    </main>
  );
}