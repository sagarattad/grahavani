"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

type State = "idle" | "loading" | "error";
type Ctx = { texts: Record<string, string> | null; state: State; error: string | null; load: () => void; retry: () => void };

const AboutContext = createContext<Ctx | null>(null);

/**
 * One per chart (type "kundli", profile slug) or Gun Milan (type "milan").
 * Shows cached texts straight away; the first time any "About" is opened it
 * asks for all texts in one request (hidden Turnstile, run on demand).
 */
export function AboutProvider({ type, slug, children }: { type: "kundli" | "milan"; slug: string; children: ReactNode }) {
  const [texts, setTexts] = useState<Record<string, string> | null>(null);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const turnstile = useRef<TurnstileInstance | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/about?type=${type}&slug=${slug}`)
      .then((r) => r.json())
      .then((d) => live && d.cached && setTexts(d.texts))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [type, slug]);

  async function post(token: string) {
    try {
      const res = await fetch("/api/about", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, slug, turnstileToken: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't write this right now.");
      setTexts(data.texts);
      setState("idle");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    } finally {
      busy.current = false;
    }
  }

  function load() {
    if (texts || busy.current) return;
    busy.current = true;
    setState("loading");
    setError(null);
    turnstile.current?.execute();
  }

  function retry() {
    turnstile.current?.reset();
    busy.current = false;
    load();
  }

  return (
    <AboutContext.Provider value={{ texts, state, error, load, retry }}>
      {children}
      <div className="h-0 overflow-visible">
        <Turnstile
          ref={turnstile}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
          options={{ execution: "execute", appearance: "interaction-only", size: "flexible" }}
          onSuccess={post}
          onError={() => {
            busy.current = false;
            setError("The human check failed. Please try again.");
            setState("error");
          }}
        />
      </div>
    </AboutContext.Provider>
  );
}

/** Collapsed "About this Yoga / Dosha"; opening it loads the texts if needed. */
export function AboutToggle({ itemKey, label }: { itemKey: string; label: string }) {
  const ctx = useContext(AboutContext);
  if (!ctx) return null;
  const text = ctx.texts?.[itemKey];
  return (
    <details className="mt-2 text-xs" onToggle={(e) => e.currentTarget.open && ctx.load()}>
      <summary className="cursor-pointer font-semibold text-brand">{label}</summary>
      <div className="mt-1 rounded-lg bg-background px-3 py-2 text-sm leading-relaxed">
        {text ? (
          <>
            <p>{text}</p>
            <p className="mt-1 text-xs text-muted">AI-written for this chart from the computed data; traditional interpretation.</p>
          </>
        ) : ctx.state === "error" ? (
          <p className="text-bad">
            {ctx.error}{" "}
            <button className="font-semibold text-brand underline" onClick={ctx.retry}>
              Retry
            </button>
          </p>
        ) : ctx.texts ? (
          <p className="text-muted">No description for this item.</p>
        ) : (
          <p className="text-muted">Writing…</p>
        )}
      </div>
    </details>
  );
}
