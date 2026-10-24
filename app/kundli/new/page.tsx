import type { Metadata } from "next";
import { PersonForm } from "@/components/PersonForm";
import { Term } from "@/components/ui";

export const metadata: Metadata = { title: "Free Kundli" };

export default function NewKundli() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">
        <Term id="kundli" full />
      </h1>
      <p className="mb-4 text-sm text-muted">Lagna and Navamsa charts, planets, Vimshottari Dasha and Yogas.</p>
      <PersonForm kind="kundli" />
    </div>
  );
}
