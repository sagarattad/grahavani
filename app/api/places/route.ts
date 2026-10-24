import { searchPlaces } from "@/lib/places";
import { jsonError } from "@/lib/request";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 120) return Response.json({ results: [] });
  try {
    return Response.json({ results: await searchPlaces(q) });
  } catch (e) {
    console.error("place_search_failed", e);
    return jsonError(503, "Place search is unavailable right now.");
  }
}
