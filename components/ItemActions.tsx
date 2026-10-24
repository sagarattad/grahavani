"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getT } from "@/lib/i18n";

/** Share, Save to My charts, and Delete for a chart or match. */
export function ItemActions({
  kind,
  type,
  slug,
  canSave,
  saved,
  shareText,
}: {
  kind: "kundli" | "manglik" | "milan";
  type: "profile" | "match";
  slug: string;
  canSave: boolean;
  saved: boolean;
  shareText: string;
}) {
  const t = getT("result");
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isSaved, setSaved] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "delete" | "save") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, type, slug }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    if (action === "save") setSaved(true);
    else router.push("/");
  }

  return (
    <section className="card mb-4">
      <p className="mb-3 text-sm text-muted">{t("shareWarning")}</p>
      <a href={`/api/pdf/${kind}/${slug}`} download className="btn-primary mb-1 w-full">
        {t("downloadPdf")}
      </a>
      <p className="mb-3 text-center text-xs text-muted">{t("pdfNote")}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn-secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? t("copied") : t("copyLink")}
        </button>
        <button
          className="btn-secondary"
          onClick={() =>
            window.open(
              `https://wa.me/?text=${encodeURIComponent(`${shareText} ${window.location.href}`)}`,
              "_blank",
              "noopener,noreferrer",
            )
          }
        >
          {t("whatsapp")}
        </button>
        {canSave && (
          <button className="btn-secondary" disabled={busy || isSaved} onClick={() => act("save")}>
            {isSaved ? t("saved") : t("save")}
          </button>
        )}
        <button
          className="btn-secondary text-bad"
          disabled={busy}
          onClick={() => window.confirm(t("deleteConfirm")) && act("delete")}
        >
          {t("delete")}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-bad" role="alert">{error}</p>}
    </section>
  );
}
