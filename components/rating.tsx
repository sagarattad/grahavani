import { Chip } from "./ui";
import type { Rating } from "@/lib/strength";

const TONE: Record<string, "good" | "warn" | "bad" | "muted"> = {
  Strong: "good",
  Moderate: "warn",
  Weak: "muted",
  High: "bad",
  Medium: "warn",
  Low: "good",
};

/** Grahavani's classical rating (Yogas) or intensity (Doshas), with its reasons. */
export function RatingLine({ rating, kind }: { rating: Rating<string>; kind: "yoga" | "dosha" }) {
  const label = kind === "yoga" ? `Grahavani's classical rating: ${rating.level ?? "Not rated"}` : rating.label;
  return (
    <div className="mt-2 text-xs">
      <Chip tone={rating.level ? TONE[rating.level] : "muted"}>{label}</Chip>
      {rating.reasons.length > 0 && <p className="mt-1 text-muted">Why: {rating.reasons.join("; ")}</p>}
    </div>
  );
}
