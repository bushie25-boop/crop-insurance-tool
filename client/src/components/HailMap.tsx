import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { HAIL_EVENTS_SAMPLE, type HailEvent } from '../lib/historicalData';

// Fix Leaflet default icon issue in Vite
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function getMarkerColor(magnitude: number): string {
  if (magnitude >= 1.5) return '#ef4444'; // red — large hail
  if (magnitude >= 1.0) return '#f97316'; // orange — significant
  if (magnitude >= 0.75) return '#eab308'; // yellow — moderate
  return '#22c55e'; // green — small
}

function getMarkerRadius(magnitude: number): number {
  if (magnitude >= 1.5) return 14;
  if (magnitude >= 1.0) return 10;
  if (magnitude >= 0.75) return 7;
  return 5;
}

interface Props {
  selectedCounty: string;
}

export default function HailMap({ selectedCounty }: Props) {
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [playback, setPlayback] = useState(false);
  const [playYear, setPlayYear] = useState(2000);
  const [selectedEvent, setSelectedEvent] = useState<HailEvent | null>(null);

  const allYears = [...new Set(HAIL_EVENTS_SAMPLE.map(e => e.year))].sort();
  const minYear = Math.min(...allYears);
  const maxYear = Math.max(...allYears);

  // Filter events
  const filtered = HAIL_EVENTS_SAMPLE.filter(e => {
    const countyMatch = selectedCounty === 'all' || e.county === selectedCounty;
    const yearMatch = selectedYear === 'all' || e.year === selectedYear;
    return countyMatch && yearMatch;
  });

  // Playback animation
  useEffect(() => {
    if (!playback) return;
    const interval = setInterval(() => {
      setPlayYear(prev => {
        if (prev >= maxYear) { setPlayback(false); return maxYear; }
        return prev + 1;
      });
      setSelectedYear(prev => typeof prev === 'number' ? prev + 1 : prev);
    }, 600);
    return () => clearInterval(interval);
  }, [playback, maxYear]);

  // Map center — center of the 4-county region
  const center: [number, number] = [44.15, -91.45];

  const countyCounts = HAIL_EVENTS_SAMPLE
    .filter(e => selectedYear === 'all' || e.year === selectedYear)
    .reduce((acc, e) => { acc[e.county] = (acc[e.county] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-white font-bold text-lg mb-1">🌩️ Hail Event Map</h3>
        <p className="text-xs text-slate-400">
          NOAA Storm Events — {filtered.length} events shown
          {selectedYear !== 'all' ? ` for ${selectedYear}` : ' (all years)'}
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
            if (!playback) { setPlayYear(minYear); setSelectedYear(minYear); }
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

        {/* Playing indicator */}
        {playback && (
          <span className="text-xs text-yellow-300 font-bold animate-pulse">
            ▶ {typeof selectedYear === 'number' ? selectedYear : ''}
          </span>
        )}
      </div>

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
          { color: '#22c55e', label: '< 0.75"' },
          { color: '#eab308', label: '0.75"' },
          { color: '#f97316', label: '1.0"' },
          { color: '#ef4444', label: '≥ 1.5" (golf ball)' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span style={{ background: color, width: 10, height: 10, borderRadius: '50%', display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>

      {/* Map */}
      <div style={{ height: 420, borderRadius: 12, overflow: 'hidden' }}>
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
          {filtered.map((evt, i) => (
            <CircleMarker
              key={`${evt.year}-${evt.county}-${i}`}
              center={[evt.lat, evt.lng]}
              radius={getMarkerRadius(evt.magnitude)}
              fillColor={getMarkerColor(evt.magnitude)}
              color="#fff"
              weight={1.5}
              opacity={1}
              fillOpacity={0.85}
              eventHandlers={{ click: () => setSelectedEvent(evt) }}
            >
              <Popup>
                <div style={{ minWidth: 180, fontFamily: 'sans-serif' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>🌩️ {evt.date}</div>
                  <div><b>County:</b> {evt.county}</div>
                  <div><b>Hail Size:</b> {evt.magnitude}"</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#555' }}>{evt.description}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* County summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {['Trempealeau WI', 'Buffalo WI', 'Jackson WI', 'Houston MN'].map(county => (
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
          {[...filtered].sort((a, b) => b.year - a.year || b.magnitude - a.magnitude).map((evt, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs p-2 rounded cursor-pointer hover:bg-slate-600 ${selectedEvent === evt ? 'bg-slate-600 ring-1 ring-blue-500' : 'bg-slate-750'}`}
              onClick={() => setSelectedEvent(evt)}
            >
              <span style={{ color: getMarkerColor(evt.magnitude), fontWeight: 'bold' }}>⬤</span>
              <span className="text-slate-300 font-semibold">{evt.date}</span>
              <span className="text-slate-400">{evt.county.split(' ')[0]}</span>
              <span className="text-white font-bold">{evt.magnitude}"</span>
              <span className="text-slate-400 flex-1 truncate">{evt.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
