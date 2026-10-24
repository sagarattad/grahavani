"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getT } from "@/lib/i18n";
import { PersonFields, emptyPerson, personPayload } from "./PersonFields";
import { TurnstileBox } from "./TurnstileBox";
import { useSubmit } from "./useSubmit";

const STEPS = ["Calculating the Groom's Kundli…", "Calculating the Bride's Kundli…", "Calculating Gun Milan…"];

export function MilanForm() {
  const t = getT("form");
  const router = useRouter();
  const [boy, setBoy] = useState(emptyPerson("male"));
  const [girl, setGirl] = useState(emptyPerson("female"));
  const [step, setStep] = useState(0);
  const { turnstile, setToken, pending, error, setError, retryIn, submit } = useSubmit<{ url: string }>("/api/matches");

  // The server does all calls in one request; this line just shows progress.
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setStep((x) => Math.min(x + 1, STEPS.length - 1)), 2500);
    return () => clearInterval(id);
  }, [pending]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!boy.place || !girl.place) return setError(t("pickPlace"));
        setStep(0);
        submit({ boy: personPayload(boy), girl: personPayload(girl) }, (r) => router.push(r.url));
      }}
    >
      <fieldset className="card">
        <legend className="h2 px-1">{t("groom")}</legend>
        <PersonFields prefix="boy" value={boy} onChange={setBoy} fixedGender />
      </fieldset>
      <fieldset className="card">
        <legend className="h2 px-1">{t("bride")}</legend>
        <PersonFields prefix="girl" value={girl} onChange={setGirl} fixedGender />
      </fieldset>
      <div className="card space-y-4">
        <TurnstileBox ref={turnstile} onToken={setToken} />
        {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
        {retryIn > 0 && <p className="text-sm text-warn" role="status">{t("busyRetry", { seconds: retryIn })}</p>}
        {pending && retryIn === 0 && <p className="text-sm text-muted" role="status">{STEPS[step]}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? t("calculating") : t("submitMilan")}
        </button>
      </div>
    </form>
  );
}
