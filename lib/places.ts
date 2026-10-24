import "server-only";
import { db } from "./db";

// Free place search via Open-Meteo Geocoding (no key; non-commercial use).
// Results are stored in the shared `places` table. User corrections are
// stored on their own profile and never written here.

export type PlaceOption = {
  id: string; // our places.id
  name: string;
  admin1: string | null;
  admin2: string | null;
  country: string | null;
  lat: number;
  lon: number;
  timezone: string;
  label: string;
};

type OpenMeteoResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  population?: number;
};

export function placeLabel(p: { name: string; admin2?: string | null; admin1?: string | null; country?: string | null }) {
  return [p.name, p.admin1, p.country].filter(Boolean).join(", ");
}

export async function searchPlaces(query: string): Promise<PlaceOption[]> {
  // Users type "City, State, India"; the geocoder wants just the name.
  const parts = query.split(",").map((s) => s.trim()).filter(Boolean);
  const name = parts[0] ?? "";
  if (name.length < 2) return [];
  const hint = parts.slice(1).join(" ").toLowerCase();

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const data = (await res.json()) as { results?: OpenMeteoResult[] };

  const results = (data.results ?? []).filter((r) => r.timezone);
  // India first, then whatever matches the typed state/country hint, then population.
  const score = (r: OpenMeteoResult) =>
    (r.country_code === "IN" ? 2 : 0) +
    (hint && `${r.admin1 ?? ""} ${r.admin2 ?? ""} ${r.country ?? ""}`.toLowerCase().includes(hint) ? 4 : 0);
  results.sort((a, b) => score(b) - score(a) || (b.population ?? 0) - (a.population ?? 0));

  const out: PlaceOption[] = [];
  for (const r of results.slice(0, 8)) {
    const row = await db.place.upsert({
      where: { providerPlaceId: String(r.id) },
      create: {
        providerPlaceId: String(r.id),
        name: r.name,
        admin1: r.admin1 ?? null,
        admin2: r.admin2 ?? null,
        country: r.country ?? null,
        countryCode: r.country_code ?? null,
        lat: r.latitude,
        lon: r.longitude,
        timezone: r.timezone!,
        population: r.population ?? null,
      },
      update: {},
    });
    out.push({
      id: row.id,
      name: row.name,
      admin1: row.admin1,
      admin2: row.admin2,
      country: row.country,
      lat: row.lat,
      lon: row.lon,
      timezone: row.timezone,
      label: placeLabel(row),
    });
  }
  return out;
}
