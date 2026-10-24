import type { Metadata } from "next";
import { PersonForm } from "@/components/PersonForm";
import { Term } from "@/components/ui";

export const metadata: Metadata = { title: "Manglik Dosha check" };

export default function NewManglik() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">
        <Term id="manglik" full /> check
      </h1>
      <p className="mb-4 text-sm text-muted">Find out whether Manglik Dosha is present, how strong it is, and any cancellations.</p>
      <PersonForm kind="manglik" />
    </div>
  );
}
