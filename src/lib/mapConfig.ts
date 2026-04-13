/**
 * mapConfig.ts — Configuración centralizada de Mapbox
 *
 * ⚠️  IMPORTANTE: No modificar este archivo ni el token.
 *     Todos los mapas, geocoding y cálculo de millas usan Mapbox.
 *     Token público (pk.*) — seguro para uso en cliente/browser.
 */

export const MAPBOX_TOKEN = 'pk.eyJ1IjoiZm1vbnNhbHZlIiwiYSI6ImNtbm5nMDg1ODFzenAycW9kYTRvcXZxdWEifQ.jLMyrT5fQG2yfx16RR_MXA';

/** URL base de tiles para Leaflet (Mapbox Streets v12) */
export const MAPBOX_TILE_URL = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`;

export const MAPBOX_TILE_OPTIONS = {
  attribution: '© <a href="https://www.mapbox.com/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  tileSize: 512 as const,
  zoomOffset: -1 as const,
};

/** Geocoding: convierte una dirección en coordenadas [lat, lng] */
export async function mapboxGeocode(place: string): Promise<[number, number] | null> {
  const attempts = [place];

  // Intento sin suite/unidad
  const noSuite = place.replace(/,?\s*(Suite|Ste|Unit|Apt|#)\s*\S*/gi, '').replace(/\s{2,}/g, ' ').trim();
  if (noSuite !== place) attempts.push(noSuite);

  // Intento con solo ciudad + estado + zip
  const parts = place.split(',').map(p => p.trim());
  if (parts.length >= 2) attempts.push(parts.slice(-2).join(', '));
  if (parts.length === 1) {
    const m = place.match(/([A-Za-z\s]+)\s+([A-Z]{2})\s+(\d{5})/);
    if (m) attempts.push(`${m[1].trim()}, ${m[2]} ${m[3]}`);
  }

  for (const query of attempts) {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=us&limit=1&types=address,place,postcode,locality`
      );
      const data = await res.json();
      if (data.features?.length > 0) {
        const [lng, lat] = data.features[0].center;
        return [lat, lng];
      }
    } catch {}
  }
  return null;
}

interface RouteWithLegs {
  geometry: [number, number][];
  legDistancesMiles: number[];
  totalDistanceMiles: number;
}

/** Ruta con geometría completa + distancia por tramo (Mapbox Directions) */
export async function mapboxRouteWithLegs(coords: [number, number][]): Promise<RouteWithLegs | null> {
  if (coords.length < 2) return null;
  try {
    const waypoints = coords.map(c => `${c[1]},${c[0]}`).join(';');
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`
    );
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      const route = data.routes[0];
      const geometry = route.geometry?.coordinates?.map((c: number[]) => [c[1], c[0]] as [number, number]) || [];
      const legDistancesMiles = (route.legs || []).map((leg: any) => (leg.distance || 0) * 0.000621371);
      const totalDistanceMiles = route.distance * 0.000621371;
      return { geometry, legDistancesMiles, totalDistanceMiles };
    }
  } catch {}
  return null;
}

/** Solo distancia en millas entre dos puntos (sin geometría) */
export async function mapboxDrivingDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${lon1},${lat1};${lon2},${lat2}?access_token=${MAPBOX_TOKEN}&overview=false`
    );
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      return data.routes[0].distance * 0.000621371;
    }
  } catch {}
  return null;
}

/** Solo geometría de ruta (array de [lat, lng]) */
export async function mapboxRoute(coords: [number, number][]): Promise<[number, number][] | null> {
  const result = await mapboxRouteWithLegs(coords);
  return result ? result.geometry : null;
}
