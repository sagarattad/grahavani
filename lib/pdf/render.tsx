import { renderToBuffer } from "@react-pdf/renderer";
import { KundliPdf, ManglikPdf, MilanPdf, type KundliPdfData, type ManglikPdfData, type MilanPdfData } from "./documents";

export type PdfInput =
  | { kind: "kundli"; data: KundliPdfData }
  | { kind: "manglik"; data: ManglikPdfData }
  | { kind: "milan"; data: MilanPdfData };

export function renderPdf(input: PdfInput): Promise<Buffer> {
  switch (input.kind) {
    case "kundli":
      return renderToBuffer(<KundliPdf {...input.data} />);
    case "manglik":
      return renderToBuffer(<ManglikPdf {...input.data} />);
    case "milan":
      return renderToBuffer(<MilanPdf {...input.data} />);
  }
}

const LABEL = { kundli: "Kundli", manglik: "Manglik", milan: "Gun-Milan" } as const;

/** Content-Disposition with an ASCII fallback name plus the UTF-8 original. */
export function pdfDisposition(kind: PdfInput["kind"], names: string[]) {
  const base = `Grahavani-${LABEL[kind]}-${names.join("-")}`;
  const ascii =
    base
      .normalize("NFKD")
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "Grahavani";
  return `attachment; filename="${ascii}.pdf"; filename*=UTF-8''${encodeURIComponent(base.replace(/\s+/g, "-"))}.pdf`;
}
