const GEO_API = "https://geo.api.gouv.fr/communes";
const CACHE_KEY = "kizconnect_geo_cache_v1";

function normalize(value = "") {
  return String(value).trim().toLocaleLowerCase("fr-FR");
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
}

function writeCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

export async function geocodeFrenchCity(city) {
  const key = normalize(city);
  if (!key) return null;
  const cache = readCache();
  const cached = cache[key];
  if (cached && Date.now() - cached.savedAt < 30 * 24 * 60 * 60 * 1000) return cached.value;

  const url = `${GEO_API}?nom=${encodeURIComponent(city.trim())}&fields=centre,population&boost=population&limit=1`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("GEO_LOOKUP_FAILED");
  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  const coordinates = row?.centre?.coordinates;
  const value = Array.isArray(coordinates) && coordinates.length >= 2
    ? { name: row.nom || city.trim(), lon: Number(coordinates[0]), lat: Number(coordinates[1]) }
    : null;
  cache[key] = { savedAt: Date.now(), value };
  writeCache(cache);
  return value;
}

export function distanceKm(a, b) {
  if (!a || !b) return null;
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export async function filterProfilesByRadius(profiles, originCity, radiusKm) {
  const origin = await geocodeFrenchCity(originCity);
  if (!origin) return { profiles: [], origin: null, geocoded: false };

  const byCity = new Map();
  for (const profile of profiles || []) {
    const city = String(profile.city || "").trim();
    if (!city) continue;
    const key = normalize(city);
    if (!byCity.has(key)) byCity.set(key, city);
  }

  const entries = [...byCity.entries()];
  const coords = new Map();
  const batchSize = 6;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async ([key, city]) => {
      try { return [key, await geocodeFrenchCity(city)]; }
      catch { return [key, null]; }
    }));
    for (const [key, value] of results) coords.set(key, value);
  }

  const filtered = [];
  for (const profile of profiles || []) {
    const point = coords.get(normalize(profile.city));
    const distance = distanceKm(origin, point);
    if (distance != null && distance <= radiusKm) filtered.push({ ...profile, _distanceKm: distance });
  }
  filtered.sort((a, b) => (a._distanceKm ?? Infinity) - (b._distanceKm ?? Infinity));
  return { profiles: filtered, origin, geocoded: true };
}
