// Planetary relationships and dignity (Parashari). Kundlit's `dignity` field
// only distinguishes exalted / moolatrikona / own / debilitated and calls
// everything else "neutral", so the friend / enemy part is computed here:
// natural (naisargika) + temporary (tatkalika) = compound (panchadha) relation.

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
  /** Kundlit's class when it names one; otherwise the relation to the sign lord. */
  label: DignityClass;
  /** Natural relation to the sign lord ("friend's sign"), when not exalted / own / debilitated. */
  natural: Natural | null;
  /** Compound relation to the sign lord, when not exalted / own / debilitated. */
  compound: Compound | null;
  signLord: Planet;
};

const KUNDLIT_CLASSES = new Set(["exalted", "moolatrikona", "own", "debilitated"]);

/**
 * Dignity of a planet in `sign`, given where every planet is (sign numbers in
 * the same chart: D1 signs for D1 dignity, D9 signs for D9 dignity).
 * `kundlitClass` (D1 only) is used when it is one of exalted / moolatrikona /
 * own / debilitated, so our labels never contradict the data source.
 */
export function dignityOf(p: Planet, sign: number, signsOf: Partial<Record<string, number>>, kundlitClass?: string): Dignity {
  const signLord = SIGN_LORD[sign];
  if (kundlitClass && KUNDLIT_CLASSES.has(kundlitClass)) return { label: kundlitClass as DignityClass, natural: null, compound: null, signLord };
  if (!kundlitClass) {
    if (EXALTATION_SIGN[p] === sign) return { label: "exalted", natural: null, compound: null, signLord };
    if (debilitationSign(p) === sign) return { label: "debilitated", natural: null, compound: null, signLord };
    if (signLord === p) return { label: "own", natural: null, compound: null, signLord };
  }
  const natural = naturalRelation(p, signLord);
  const lordSign = signsOf[signLord];
  const compound = lordSign ? compoundRelation(natural, temporaryFriend(sign, lordSign)) : null;
  return { label: compound ?? (natural === "friend" ? "friend" : natural === "enemy" ? "enemy" : "neutral"), natural, compound, signLord };
}

/** "friend's sign (compound: great friend)" style text. */
export function dignityText(d: Dignity): string {
  if (d.natural === null) return d.label === "own" ? "own sign" : d.label;
  const nat = d.natural === "neutral" ? "neutral sign" : `${d.natural}'s sign`;
  return d.compound ? `${nat} (compound: ${d.compound})` : nat;
}
