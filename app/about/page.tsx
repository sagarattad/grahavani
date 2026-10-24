import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <article className="card space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-extrabold">About Grahavani</h1>
      <p>
        Grahavani shows standard Vedic astrology (Parashari Jyotish) results: Kundli with Lagna (D1) and Navamsa (D9)
        charts in the North Indian style, Vimshottari Dasha, Yogas, Ashtakoot Gun Milan and Manglik Dosha.
      </p>
      <h2 className="h2">Where the calculations come from</h2>
      <p>
        All positions, houses, Dasha dates, koot scores and Manglik results are calculated by{" "}
        <a href="https://kundlit.com" className="underline" target="_blank" rel="noopener noreferrer">
          Kundlit
        </a>{" "}
        (Swiss Ephemeris, Lahiri ayanamsa, whole-sign houses). Grahavani only displays them. The AI readings explain these
        results in plain language and are checked against them; the AI never calculates anything.
      </p>
      <h2 className="h2">Why results may differ from other sites</h2>
      <p>
        Different sites can use a different ayanamsa, different tables for Vashya or Yoni koot, half-point rules, or
        different rules for which dosha cancellations apply. A small birth-time or place difference can also change the
        Lagna or the Moon&apos;s Nakshatra.
      </p>
      <h2 className="h2">Please note</h2>
      <p>
        Astrology is shared here as a traditional and cultural practice. Nothing on Grahavani is medical, legal or
        financial advice, and Gun Milan is only one traditional factor — decisions about marriage belong to the people
        and families involved.
      </p>
    </article>
  );
}
