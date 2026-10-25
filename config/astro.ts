// Astrological conventions that schools disagree on. Change here, not in the rules.

/**
 * Temporary (tatkalika) friendship for divisional-chart dignity:
 * - "d1": judged from the planets' D1 signs (Parashari; the default);
 * - "varga": judged from their signs in that divisional chart.
 */
export const TATKALIKA_BASIS: "d1" | "varga" = "d1";

/** "When active" lists leave out Dasha periods that start after this age. */
export const MAX_ACTIVATION_AGE = 90;
