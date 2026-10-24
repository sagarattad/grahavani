import { HOUSE_GEOMETRY, houseLabels, type House } from "@/lib/chart/northIndian";
import { grahaShort, rashi } from "@/lib/glossary";

// North Indian (diamond) chart. House positions are fixed; each house shows its
// Rashi number and the grahas in it. R = retrograde (Vakri), C = combust (Asta).
export function NorthIndianChart({ houses, title }: { houses: House[]; title: string }) {
  const summary = houses
    .map((h) => `House ${h.house}: ${rashi(h.signNum)}${h.grahas.length ? `, ${h.grahas.map((g) => g.name).join(", ")}` : ""}`)
    .join(". ");
  return (
    <figure className="mx-auto w-full max-w-[420px]">
      <svg viewBox="-4 -4 408 408" role="img" aria-label={`${title}. ${summary}`} className="h-auto w-full">
        <title>{title}</title>
        <rect x="0" y="0" width="400" height="400" fill="#fffdf8" stroke="#7c2d12" strokeWidth="2.5" />
        <g stroke="#7c2d12" strokeWidth="1.5" fill="none">
          <line x1="0" y1="0" x2="400" y2="400" />
          <line x1="400" y1="0" x2="0" y2="400" />
          <polygon points="200,0 400,200 200,400 0,200" />
        </g>
        {houses.map((h) => {
          const geo = HOUSE_GEOMETRY[h.house];
          return (
            <g key={h.house}>
              <text
                x={geo.label[0]}
                y={geo.label[1]}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fill="#9a6b55"
              >
                {h.signNum}
              </text>
              {houseLabels(h, grahaShort).map((l) => (
                <text
                  key={l.key}
                  x={l.x}
                  y={l.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={l.fontSize}
                  fontWeight={l.lagna ? 700 : 600}
                  fill={l.lagna ? "#b45309" : "#2a1a14"}
                >
                  {`${l.short}${l.retro ? "ᴿ" : ""}${l.combust ? "ᶜ" : ""}`}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted">
        Numbers are Rashi numbers (1 = Mesha … 12 = Meena). La = Lagna, ᴿ = Vakri (retrograde), ᶜ = Asta (combust).
      </figcaption>
    </figure>
  );
}
