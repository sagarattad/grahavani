import type { Metadata } from "next";
import { MilanForm } from "@/components/MilanForm";
import { Term } from "@/components/ui";

export const metadata: Metadata = { title: "Kundli Milan (Gun Milan)" };

export default function NewMilan() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">
        <Term id="kundliMilan" full />
      </h1>
      <p className="mb-4 text-sm text-muted">
        <Term id="ashtakoot" full /> <Term id="gunMilan" />: score out of 36 with all 8 koots, Nadi and Bhakoot Dosha, and
        Manglik Dosha for both.
      </p>
      <MilanForm />
    </div>
  );
}
