/** Bidirectional geocoding helpers (Nominatim). */

/**
 * Short place labels:
 * "Kathmandu Metropolitan City" → "Kathmandu"
 * "Bagamati Province" → "Bagamati"
 */
function shortenPlaceName(value?: string): string | undefined {
  if (!value?.trim()) return undefined;

  let s = value.trim();

  // Drop postal / ward-style suffixes like "Kathmandu-31"
  s = s.replace(/-\d+$/, "").trim();

  // Skip pure postcodes
  if (/^\d{4,6}$/.test(s)) return undefined;

  s = s
    .replace(/\s+Sub[- ]?Metropolitan\s+City$/i, "")
    .replace(/\s+Metropolitan\s+City$/i, "")
    .replace(/\s+Municipality$/i, "")
    .replace(/\s+Municipal\s+Corporation$/i, "")
    .replace(/\s+Nagarpalika$/i, "")
    .replace(/\s+Gaunpalika$/i, "")
    .replace(/\s+Province$/i, "")
    .replace(/\s+Pradesh$/i, "")
    .replace(/\s+District$/i, "")
    .replace(/\s+Zone$/i, "")
    .trim();

  return s || undefined;
}

/**
 * Format: street, area, city, state, country
 * e.g. 60 Nirajan Bikram Marga, Naya Baneshwar, Kathmandu, Bagamati, Nepal
 */
function formatAddressParts(parts: Record<string, string>): string | null {
  const street =
    parts.road ||
    parts.pedestrian ||
    parts.path ||
    parts.footway ||
    parts.street;

  const streetWithNumber =
    parts.house_number && street
      ? `${parts.house_number} ${street}`
      : street;

  const area = shortenPlaceName(
    parts.neighbourhood ||
      parts.suburb ||
      parts.quarter ||
      parts.city_block ||
      parts.hamlet ||
      parts.residential
  );

  // Prefer short city fields; fall back to municipality / city_district then shorten
  const city = shortenPlaceName(
    parts.city ||
      parts.town ||
      parts.village ||
      parts.municipality ||
      parts.city_district
  );

  const state = shortenPlaceName(
    parts.state || parts.province || parts.region || parts.state_district
  );

  const country = shortenPlaceName(parts.country);

  const unique = [streetWithNumber, area, city, state, country]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .filter((p, i, arr) => arr.findIndex((x) => x.toLowerCase() === p.toLowerCase()) === i);

  return unique.length ? unique.join(", ") : null;
}

export type GeocodeResult = {
  lat: string;
  lng: string;
  address: string;
};

export async function reverseGeocode(lat: string, lng: string): Promise<string | null> {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    addressdetails: "1",
    zoom: "18",
  });

  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    display_name?: string;
    address?: Record<string, string>;
  };

  if (data.address) {
    const short = formatAddressParts(data.address);
    if (short) return short;
  }

  const display = data.display_name?.trim();
  if (!display) return null;
  const chunks = display
    .split(",")
    .map((s) => shortenPlaceName(s.trim()))
    .filter((p): p is string => Boolean(p));
  if (!chunks.length) return null;
  if (chunks.length <= 5) return chunks.join(", ");
  return [chunks[0], ...chunks.slice(-4)].join(", ");
}

/** Forward-geocode a typed address to coordinates (and a short formatted address). */
export async function forwardGeocode(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (q.length < 5) return null;

  const params = new URLSearchParams({
    format: "jsonv2",
    q,
    addressdetails: "1",
    limit: "1",
  });

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: Record<string, string>;
  }>;

  const hit = data[0];
  if (!hit?.lat || !hit?.lon) return null;

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const short =
    (hit.address && formatAddressParts(hit.address)) ||
    hit.display_name?.trim() ||
    q;

  return {
    lat: lat.toFixed(6),
    lng: lng.toFixed(6),
    address: short,
  };
}
