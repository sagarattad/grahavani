"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getT } from "@/lib/i18n";
import { PlaceField, type PickedPlace } from "./PlaceField";
import { TurnstileBox } from "./TurnstileBox";
import { useSubmit } from "./useSubmit";

/** Resolved place line with "Wrong place? Edit". Saves to this profile only. */
export function PlaceEdit({ slug, label }: { slug: string; label: string }) {
  const t = getT("form");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const { turnstile, setToken, pending, error, retryIn, submit } = useSubmit(`/api/profiles/${slug}/place`);

  if (!editing) {
    return (
      <p className="text-sm">
        📍 {label}{" "}
        <button className="font-semibold text-brand underline" onClick={() => setEditing(true)}>
          {t("wrongPlace")}
        </button>
      </p>
    );
  }
  return (
    <div className="mt-2 space-y-3 rounded-xl border border-border p-3">
      <PlaceField id={`edit-${slug}`} value={place} onChange={setPlace} autoFocus />
      {place && <TurnstileBox ref={turnstile} onToken={setToken} />}
      {error && <p className="text-sm text-bad" role="alert">{error}</p>}
      {retryIn > 0 && <p className="text-sm text-warn">{t("busyRetry", { seconds: retryIn })}</p>}
      <div className="flex gap-2">
        <button
          className="btn-primary flex-1"
          disabled={!place || pending}
          onClick={() =>
            place &&
            submit({ place }, () => {
              setEditing(false);
              router.refresh();
            })
          }
        >
          {pending ? t("calculating") : "Save place"}
        </button>
        <button className="btn-secondary" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
