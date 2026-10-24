import "server-only";
import { KundlitError } from "./kundlit";
import { jsonError } from "./request";

/** Turns calculation errors into friendly JSON responses for the forms. */
export function calculationErrorResponse(e: unknown) {
  if (e instanceof KundlitError) {
    if (e.code === "busy")
      return jsonError(503, "Many people are calculating right now. Retrying shortly…", {
        code: "busy",
        retryAfter: e.retryAfter ?? 20,
      });
    if (e.code === "invalid") return jsonError(400, "These birth details could not be calculated. Please check them.");
    return jsonError(503, "The calculation service is unavailable. Please try again later.", { code: "unavailable" });
  }
  console.error("unexpected_error", e);
  return jsonError(500, "Something went wrong. Please try again.");
}
