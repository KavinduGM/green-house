// Location-based live weather via Open-Meteo (free, no API key, accurate).
// Used by every project (smart or not). Cached briefly to avoid hammering.

interface Cached { t: number; data: unknown; }
const cache = new Map<string, Cached>();
const TTL = 10 * 60_000; // 10 minutes

export async function getWeather(lat: number, lng: number) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.data;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto&forecast_days=5`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather service unavailable');
  const data = await res.json();
  cache.set(key, { t: Date.now(), data });
  return data;
}

// Place search -> coordinates (for picking a project location).
export async function geocode(q: string) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Location search unavailable');
  const data: any = await res.json();
  return (data.results ?? []).map((r: any) => ({
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
  }));
}
