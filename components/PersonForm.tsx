"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getT } from "@/lib/i18n";
import { PersonFields, emptyPerson, personPayload } from "./PersonFields";
import { TurnstileBox } from "./TurnstileBox";
import { useSubmit } from "./useSubmit";

/** One-person form used by Kundli and Manglik. */
export function PersonForm({ kind }: { kind: "kundli" | "manglik" }) {
  const t = getT("form");
  const router = useRouter();
  const [person, setPerson] = useState(emptyPerson());
  const { turnstile, setToken, pending, error, setError, retryIn, submit } = useSubmit<{ url: string }>("/api/profiles");

  return (
    <form
      className="card space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!person.place) return setError(t("pickPlace"));
        submit({ kind, person: personPayload(person) }, (r) => router.push(r.url));
      }}
    >
      <PersonFields prefix="p" value={person} onChange={setPerson} />
      <TurnstileBox ref={turnstile} onToken={setToken} />
      {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
      {retryIn > 0 && <p className="text-sm text-warn" role="status">{t("busyRetry", { seconds: retryIn })}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? t("calculating") : kind === "kundli" ? t("submitKundli") : t("submitManglik")}
      </button>
    </form>
  );
}
