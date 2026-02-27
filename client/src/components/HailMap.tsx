import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { loadHailEvents, type HailEvent } from '../lib/hailData';

// Fix Leaflet default icon issue in Vite
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function getMarkerColor(size: number): string {
  if (size >= 2.0) return '#ef4444';  // XL red — giant hail
  if (size >= 1.5) return '#dc2626';  // large red
  if (size >= 1.0) return '#f97316';  // orange — significant
  return '#eab308';                   // yellow — 0.75"–0.99"
}

function getMarkerRadius(size: number): number {
  if (size >= 2.0) return 11;
  if (size >= 1.5) return 8;
  if (size >= 1.0) return 6;
  return 4;  // 0.75"–0.99"
}

function getMarkerWeight(size: number): number {
  return size >= 2.0 ? 2.5 : 1.5;
}

// Map county names from IEM format (e.g. "TREMPEALEAU") to display format
const COUNTY_DISPLAY: Record<string, string> = {
  TREMPEALEAU: 'Trempealeau WI',
  BUFFALO: 'Buffalo WI',
  JACKSON: 'Jackson WI',
  HOUSTON: 'Houston MN',
};

const DISPLAY_COUNTIES = ['Trempealeau WI', 'Buffalo WI', 'Jackson WI', 'Houston MN'];

interface Props {
  selectedCounty: string;
}

export default function HailMap({ selectedCounty }: Props) {
  const [hailEvents, setHailEvents] = useState<HailEvent[]>([]);
  const [loadingHail, setLoadingHail] = useState(false);
  const [loadPct, setLoadPct] = useState(0);
  const [showProbLayer, setShowProbLayer] = useState(false);
  const [showProbNote, setShowProbNote] = useState(false);

  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [playback, setPlayback] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<HailEvent | null>(null);

  // Load IEM data on mount
  useEffect(() => {
    setLoadingHail(true);
    loadHailEvents((pct) => setLoadPct(pct)).then(events => {
      setHailEvents(events);
      setLoadingHail(false);
    });
  }, []);

  const allYears = [...new Set(hailEvents.map(e => e.year))].sort();
  const minYear = allYears.length > 0 ? Math.min(...allYears) : 2005;
  const maxYear = allYears.length > 0 ? Math.max(...allYears) : new Date().getFullYear();

  // Filter events — match county by IEM uppercase name or display name
  const filtered = hailEvents.filter(e => {
    const displayCounty = COUNTY_DISPLAY[e.county] ?? e.county;
    const countyMatch = selectedCounty === 'all' || displayCounty === selectedCounty;
    const yearMatch = selectedYear === 'all' || e.year <= (selectedYear as number);
    return countyMatch && yearMatch;
  });

  // Playback animation
  useEffect(() => {
    if (!playback) return;
    const interval = setInterval(() => {
      setSelectedYear(prev => {
        const yr = typeof prev === 'number' ? prev : minYear;
        if (yr >= maxYear) { setPlayback(false); return maxYear; }
        return yr + 1;
      });
    }, 600);
    return () => clearInterval(interval);
  }, [playback, maxYear, minYear]);

  // Map center — center of the 4-county region
  const center: [number, number] = [44.15, -91.45];

  // County event counts (display format)
  const countyCounts = filtered.reduce((acc, e) => {
    const display = COUNTY_DISPLAY[e.county] ?? e.county;
    acc[display] = (acc[display] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-white font-bold text-lg mb-1">🌩️ Hail Event Map</h3>
        <p className="text-xs text-slate-400">
          {loadingHail
            ? `Loading IEM/SPC data... ${loadPct}%`
            : <>{hailEvents.length} events loaded (IEM/SPC data, ≥0.75") · {filtered.length} shown{selectedYear !== 'all' ? ` through ${selectedYear}` : ' (all years)'}</>
          }
          <span className="ml-2 text-slate-500">· Click any pin for details</span>
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Year selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Year:</label>
          <select
            className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600"
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          >
            <option value="all">All Years</option>
            {allYears.map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>

        {/* Playback */}
        <button
          onClick={() => {
            if (!playback) { setSelectedYear(minYear); }
            setPlayback(!playback);
          }}
          className={`text-xs px-3 py-1 rounded font-semibold ${playback ? 'bg-red-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
        >
          {playback ? '⏹ Stop' : '▶ Play Through Years'}
        </button>

        {/* Show all */}
        <button
          onClick={() => { setSelectedYear('all'); setPlayback(false); }}
          className="text-xs px-3 py-1 rounded bg-slate-600 text-white hover:bg-slate-500"
        >
          Show All
        </button>

        {/* Hail Risk Overlay toggle */}
        <button
          onClick={() => { setShowProbLayer(p => !p); setShowProbNote(true); }}
          className={`px-2 py-1 text-xs rounded ${showProbLayer ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          🗺️ Hail Risk Overlay
        </button>

        {/* Playing indicator */}
        {playback && (
          <span className="text-xs text-yellow-300 font-bold animate-pulse">
            ▶ {typeof selectedYear === 'number' ? selectedYear : ''}
          </span>
        )}
      </div>

      {/* Hail overlay notice */}
      {showProbNote && showProbLayer && (
        <div className="text-xs text-orange-300 bg-slate-700 rounded px-3 py-2">
          {/* TODO: Wire up MRMS hail probability tile layer once source is confirmed.
              Candidate: NOAA MRMS MaxHailSize composite via RIDGE2 or Iowa State WMS.
              For now showing placeholder — tile URL pending validation. */}
          🗺️ Hail probability overlay coming soon — MRMS tile source pending.
        </div>
      )}

      {/* Year range slider */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">{minYear}</span>
        <input
          type="range"
          min={minYear}
          max={maxYear}
          value={typeof selectedYear === 'number' ? selectedYear : maxYear}
          onChange={e => { setSelectedYear(parseInt(e.target.value)); setPlayback(false); }}
          className="flex-1 accent-blue-500"
        />
        <span className="text-xs text-slate-500">{maxYear}</span>
        <span className="text-xs text-blue-300 font-bold w-10 text-right">
          {typeof selectedYear === 'number' ? selectedYear : 'All'}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="text-slate-400">Hail size:</span>
        {[
          { color: '#eab308', label: '0.75"–0.99"', r: 4 },
          { color: '#f97316', label: '1.0"–1.49"', r: 6 },
          { color: '#dc2626', label: '1.5"–1.99"', r: 8 },
          { color: '#ef4444', label: '≥ 2.0" (golf ball+)', r: 11 },
        ].map(({ color, label, r }) => (
          <span key={label} className="flex items-center gap-1">
            <span style={{ background: color, width: r, height: r, borderRadius: '50%', display: 'inline-block', border: r >= 11 ? '2px solid #fff' : undefined }} />
            {label}
          </span>
        ))}
      </div>

      {/* Map */}
      <div style={{ height: 420, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
        {loadingHail && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-slate-800/90 text-white text-xs px-3 py-1 rounded-full">
            Loading hail data... {loadPct}%
          </div>
        )}
        <MapContainer
          center={center}
          zoom={9}
          style={{ height: '100%', width: '100%', background: '#1e293b' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          {/* TODO: Hail probability tile layer — MRMS source pending
              {showProbLayer && (
                <TileLayer
                  url="https://TODO_MRMS_TILE_URL/{z}/{x}/{y}.png"
                  attribution="Hail risk: NOAA MRMS"
                  opacity={0.5}
                />
              )} */}
          {filtered.map((evt, i) => (
            <CircleMarker
              key={`${evt.year}-${evt.county}-${i}`}
              center={[evt.lat, evt.lng]}
              radius={getMarkerRadius(evt.size)}
              fillColor={getMarkerColor(evt.size)}
              color="#fff"
              weight={getMarkerWeight(evt.size)}
              opacity={1}
              fillOpacity={0.85}
              eventHandlers={{ click: () => setSelectedEvent(evt) }}
            >
              <Popup>
                <div style={{ minWidth: 180, fontFamily: 'sans-serif' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>🌩️ {evt.date.slice(0, 10)}</div>
                  <div><b>Location:</b> {evt.city || evt.county}</div>
                  <div><b>County:</b> {COUNTY_DISPLAY[evt.county] ?? evt.county}, {evt.state}</div>
                  <div><b>Hail Size:</b> {evt.size}"</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: '#888' }}>Source: IEM/NWS SPC LSR</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* County summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {DISPLAY_COUNTIES.map(county => (
          <div key={county} className="bg-slate-700 rounded-lg p-2 text-center">
            <div className="text-white font-bold text-lg">{countyCounts[county] || 0}</div>
            <div className="text-xs text-slate-400">{county.split(' ')[0]}</div>
          </div>
        ))}
      </div>

      {/* Event list */}
      {filtered.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-1">
          <div className="text-xs text-slate-400 mb-1">Storm log ({filtered.length} events):</div>
          {[...filtered].sort((a, b) => b.year - a.year || b.size - a.size).map((evt, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs p-2 rounded cursor-pointer hover:bg-slate-600 ${selectedEvent === evt ? 'bg-slate-600 ring-1 ring-blue-500' : ''}`}
              onClick={() => setSelectedEvent(evt)}
            >
              <span style={{ color: getMarkerColor(evt.size), fontWeight: 'bold' }}>⬤</span>
              <span className="text-slate-300 font-semibold">{evt.date.slice(0, 10)}</span>
              <span className="text-slate-400">{COUNTY_DISPLAY[evt.county]?.split(' ')[0] ?? evt.county}</span>
              <span className="text-white font-bold">{evt.size}"</span>
              <span className="text-slate-400 flex-1 truncate">{evt.city}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
