// Planetary relationships and dignity (Parashari). Kundlit's `dignity` field
// calls everything below own sign "neutral" and ignores the BPHS degree zones
// (Mercury is exalted only in Kanya 0–15°), so all dignity is computed here:
// degree zones in the D1, and natural (naisargika) + temporary (tatkalika) =
// compound (panchadha) relation to the sign lord.

export const SEVEN = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;
export type Planet = (typeof SEVEN)[number];
export const isPlanet = (n: string): n is Planet => (SEVEN as readonly string[]).includes(n);

/** Rashi number (1 = Mesha) → its lord. */
export const SIGN_LORD: Record<number, Planet> = {
  1: "Mars", 2: "Venus", 3: "Mercury", 4: "Moon", 5: "Sun", 6: "Mercury",
  7: "Venus", 8: "Mars", 9: "Jupiter", 10: "Saturn", 11: "Saturn", 12: "Jupiter",
};

export const EXALTATION_SIGN: Record<Planet, number> = { Sun: 1, Moon: 2, Mars: 10, Mercury: 6, Jupiter: 4, Venus: 12, Saturn: 7 };
/** Deep-exaltation longitude (sidereal degrees), for the Uccha bala component. */
export const EXALTATION_POINT: Record<Planet, number> = { Sun: 10, Moon: 33, Mars: 298, Mercury: 165, Jupiter: 95, Venus: 357, Saturn: 200 };
export const debilitationSign = (p: Planet) => ((EXALTATION_SIGN[p] + 5) % 12) + 1;
export const ownSigns = (p: Planet) => Object.entries(SIGN_LORD).filter(([, l]) => l === p).map(([s]) => Number(s));

type Natural = "friend" | "neutral" | "enemy";
const N: Record<Planet, { friends: Planet[]; enemies: Planet[] }> = {
  Sun: { friends: ["Moon", "Mars", "Jupiter"], enemies: ["Venus", "Saturn"] },
  Moon: { friends: ["Sun", "Mercury"], enemies: [] },
  Mars: { friends: ["Sun", "Moon", "Jupiter"], enemies: ["Mercury"] },
  Mercury: { friends: ["Sun", "Venus"], enemies: ["Moon"] },
  Jupiter: { friends: ["Sun", "Moon", "Mars"], enemies: ["Mercury", "Venus"] },
  Venus: { friends: ["Mercury", "Saturn"], enemies: ["Sun", "Moon"] },
  Saturn: { friends: ["Mercury", "Venus"], enemies: ["Sun", "Moon", "Mars"] },
};

/** How `p` naturally regards `other`. */
export function naturalRelation(p: Planet, other: Planet): Natural {
  if (N[p].friends.includes(other)) return "friend";
  if (N[p].enemies.includes(other)) return "enemy";
  return "neutral";
}

/** Signs counted from `from` to `to`, 1–12 (same sign = 1). */
export const signDistance = (from: number, to: number) => ((to - from + 12) % 12) + 1;

/** Temporary friend: `other` sits 2, 3, 4, 10, 11 or 12 signs from `p`. */
export const temporaryFriend = (pSign: number, otherSign: number) => [2, 3, 4, 10, 11, 12].includes(signDistance(pSign, otherSign));

export type Compound = "great friend" | "friend" | "neutral" | "enemy" | "great enemy";

/** Panchadha (five-fold) relation from natural + temporary. */
export function compoundRelation(natural: Natural, tempFriend: boolean): Compound {
  if (natural === "friend") return tempFriend ? "great friend" : "neutral";
  if (natural === "enemy") return tempFriend ? "neutral" : "great enemy";
  return tempFriend ? "friend" : "enemy";
}

export type DignityClass = "exalted" | "moolatrikona" | "own" | "debilitated" | Compound;

export type Dignity = {
  /** Exalted / moolatrikona / own / debilitated, or the compound relation to the sign lord. */
  label: DignityClass;
  /** Natural relation to the sign lord ("friend's sign"), when not exalted / own / debilitated. */
  natural: Natural | null;
  /** Compound relation to the sign lord, when not exalted / own / debilitated. */
  compound: Compound | null;
  signLord: Planet;
};

/**
 * BPHS degree zones (D1 only): exaltation (end degree in the exaltation sign;
 * 30 = the whole sign) and moolatrikona (sign, from, to). The rest of an own
 * sign is "own"; debilitation is the whole opposite sign.
 */
export const DIGNITY_ZONES: Record<Planet, { exaltedTo: number; mt: [sign: number, from: number, to: number] }> = {
  Sun: { exaltedTo: 30, mt: [5, 0, 20] },
  Moon: { exaltedTo: 3, mt: [2, 3, 30] },
  Mars: { exaltedTo: 30, mt: [1, 0, 12] },
  Mercury: { exaltedTo: 15, mt: [6, 15, 20] },
  Jupiter: { exaltedTo: 30, mt: [9, 0, 10] },
  Venus: { exaltedTo: 30, mt: [7, 0, 15] },
  Saturn: { exaltedTo: 30, mt: [11, 0, 20] },
};

/**
 * Dignity of a planet in `sign`.
 * - `degInSign` given (D1): the BPHS degree zones apply.
 * - No degree (a divisional chart): sign level; a sign that is both the
 *   exaltation and an own / moolatrikona sign counts as exalted, and the rest
 *   of an own sign as own (moolatrikona needs degrees).
 * - `tempSigns`: where `p` and its sign lord sit for the temporary friendship
 *   (the D1 signs by default, see config/astro.ts TATKALIKA_BASIS).
 */
export function dignityOf(p: Planet, sign: number, tempSigns: Partial<Record<string, number>>, degInSign?: number): Dignity {
  const signLord = SIGN_LORD[sign];
  const fixed = (label: DignityClass): Dignity => ({ label, natural: null, compound: null, signLord });
  const zone = DIGNITY_ZONES[p];
  if (debilitationSign(p) === sign) return fixed("debilitated");
  if (EXALTATION_SIGN[p] === sign && (degInSign === undefined || degInSign < zone.exaltedTo)) return fixed("exalted");
  if (degInSign !== undefined && zone.mt[0] === sign && degInSign >= zone.mt[1] && degInSign < zone.mt[2]) return fixed("moolatrikona");
  if (signLord === p) return fixed("own");
  const natural = naturalRelation(p, signLord);
  const mine = tempSigns[p] ?? sign;
  const lordSign = tempSigns[signLord];
  const compound = lordSign ? compoundRelation(natural, temporaryFriend(mine, lordSign)) : null;
  return { label: compound ?? (natural === "friend" ? "friend" : natural === "enemy" ? "enemy" : "neutral"), natural, compound, signLord };
}

/** Weakest to strongest. */
export const DIGNITY_RANK: DignityClass[] = ["debilitated", "great enemy", "enemy", "neutral", "friend", "great friend", "own", "moolatrikona", "exalted"];
const rank = (d: Dignity) => DIGNITY_RANK.indexOf(d.label);

export type VargaRole = "supportive" | "neutral" | "weakening";

/**
 * A divisional-chart dignity judged on its own: friend or better supports,
 * neutral is neutral, enemy / great enemy / debilitated weakens. `improved`
 * only when the D1 dignity is neutral or worse and the D9 one is better
 * (a mitigation); a supportive D9 is never called a weakening.
 */
export function vargaReading(d1: Dignity, varga: Dignity): { role: VargaRole; improved: boolean } {
  const r = rank(varga);
  const role: VargaRole = r >= DIGNITY_RANK.indexOf("friend") ? "supportive" : varga.label === "neutral" ? "neutral" : "weakening";
  return { role, improved: rank(d1) <= DIGNITY_RANK.indexOf("neutral") && r > rank(d1) };
}

/** Display text: "own sign", "exalted", or the natural relation with the compound one, "neutral (compound friend)". */
export function dignityText(d: Dignity): string {
  if (d.natural === null) return d.label === "own" ? "own sign" : d.label;
  return d.compound ? `${d.natural} (compound ${d.compound})` : d.natural;
}

/** The one dignity given to the AI: the compound relation (or own / exalted / moolatrikona / debilitated). */
export function dignityFact(d: Dignity): string {
  if (d.natural === null) return d.label === "own" ? "own sign" : d.label;
  return d.compound ?? d.natural;
}
