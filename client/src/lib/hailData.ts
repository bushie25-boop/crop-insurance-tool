// IEM (Iowa Environmental Mesonet) SPC Local Storm Reports
// Covers hail ≥ 0.75" — much more complete than NOAA Storm Events
// NWS offices covering our 4 counties:
//   ARX = La Crosse WI (covers Trempealeau, Buffalo, Jackson WI)
//   MPX = Minneapolis MN (covers Houston MN)

export interface HailEvent {
  lat: number;
  lng: number;
  date: string;   // ISO date string
  year: number;
  size: number;   // inches
  county: string;
  state: string;
  city: string;
}

// Bounding box for WI/MN area (loose, for pre-filter)
const BBOX = { minLat: 43.5, maxLat: 44.8, minLng: -92.0, maxLng: -90.5 };

function inBbox(lat: number, lng: number): boolean {
  return lat >= BBOX.minLat && lat <= BBOX.maxLat &&
         lng >= BBOX.minLng && lng <= BBOX.maxLng;
}

async function fetchIEMHailYear(wfo: string, year: number): Promise<HailEvent[]> {
  const url = `https://mesonet.agron.iastate.edu/geojson/lsr.php?wfo=${wfo}&type=H&year=${year}&fmt=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const events: HailEvent[] = [];
    for (const feature of data.features ?? []) {
      const { lat, lon, valid, magnitude, county, state, city } = feature.properties ?? {};
      const lngVal = lon ?? feature.geometry?.coordinates?.[0];
      const latVal = lat ?? feature.geometry?.coordinates?.[1];
      if (!latVal || !lngVal) continue;
      if (!inBbox(latVal, lngVal)) continue;
      const sizeIn = parseFloat(magnitude) || 0;
      if (sizeIn < 0.75) continue;
      events.push({
        lat: latVal,
        lng: lngVal,
        date: valid ?? `${year}-06-01`,
        year,
        size: sizeIn,
        county: (county ?? '').toUpperCase(),
        state: state ?? '',
        city: city ?? '',
      });
    }
    return events;
  } catch {
    return [];
  }
}

// Fetch all years for both WFOs — cached in module scope
let _cache: HailEvent[] | null = null;
let _loading = false;
let _callbacks: Array<(events: HailEvent[]) => void> = [];

export async function loadHailEvents(
  onProgress?: (pct: number) => void
): Promise<HailEvent[]> {
  if (_cache) return _cache;
  if (_loading) {
    return new Promise(resolve => _callbacks.push(resolve));
  }
  _loading = true;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2004 }, (_, i) => 2005 + i); // 2005–current
  const wfos = ['ARX', 'MPX'];
  const allEvents: HailEvent[] = [];

  let done = 0;
  const total = years.length * wfos.length;

  await Promise.all(
    wfos.flatMap(wfo =>
      years.map(async year => {
        const events = await fetchIEMHailYear(wfo, year);
        allEvents.push(...events);
        done++;
        onProgress?.(Math.round((done / total) * 100));
      })
    )
  );

  // Deduplicate events within 0.05° and same date
  const seen = new Set<string>();
  const deduped = allEvents.filter(e => {
    const key = `${e.date.slice(0, 10)}_${e.lat.toFixed(2)}_${e.lng.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => a.date.localeCompare(b.date));
  _cache = deduped;
  _loading = false;
  _callbacks.forEach(cb => cb(deduped));
  _callbacks = [];
  return deduped;
}
