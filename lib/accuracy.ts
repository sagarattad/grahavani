// "Birth time accuracy matters" notes. These only compare the API's own
// longitudes with fixed boundaries; they compute no positions.

const NAKSHATRA_SPAN = 360 / 27; // 13°20′
const MARGIN = 1; // degree

export const nearSignBoundary = (degInSign: number) => degInSign < MARGIN || degInSign > 30 - MARGIN;

export function nearNakshatraBoundary(longitude: number) {
  const within = ((longitude % NAKSHATRA_SPAN) + NAKSHATRA_SPAN) % NAKSHATRA_SPAN;
  return within < MARGIN || within > NAKSHATRA_SPAN - MARGIN;
}
