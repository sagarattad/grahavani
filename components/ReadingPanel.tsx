"use client";
import { useState } from "react";
import { getT } from "@/lib/i18n";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef } from "react";
import { READING_CARDS, type ReadingKind } from "@/lib/ai/schemas";
import { TurnstileBox } from "./TurnstileBox";

type Status = "idle" | "streaming" | "retrying" | "done" | "failed" | "error";
type Reading = Record<string, unknown>;
type KootItem = { koot?: string; earned?: number; max?: number; explanation?: string };

/** "Get reading": shows a cached reading, or streams a new one card by card. */
export function ReadingPanel({ kind, slug }: { kind: ReadingKind; slug: string }) {
  const t = getT("result");
  const [status, setStatus] = useState<Status>("idle");
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileInstance | null>(null);

  async function getReading() {
    setStatus("streaming");
    setError(null);
    setReading(null);
    try {
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, slug, language: "en", turnstileToken: token }),
      });
      setToken(null);
      turnstile.current?.reset();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not get a reading right now.");
        return setStatus("error");
      }
      if (res.headers.get("Content-Type")?.includes("application/json")) {
        const data = await res.json();
        setReading(data.output);
        return setStatus("done");
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "partial") setReading(ev.data);
          else if (ev.type === "retry") {
            setReading(null);
            setStatus("retrying");
          } else if (ev.type === "done") {
            setReading(ev.data);
            setStatus("done");
            finished = true;
          } else if (ev.type === "failed") {
            setReading(null);
            setStatus("failed");
            finished = true;
          }
        }
      }
      // The server was cut off (e.g. its time limit) before the final event.
      if (!finished) {
        setReading(null);
        setError("The reading was interrupted. Please try again.");
        setStatus("error");
      }
    } catch {
      setError("Network error while getting the reading.");
      setStatus("error");
    }
  }

  const final = status === "done";
  return (
    <section className="card mb-4" aria-live="polite">
      <h2 className="h2">AI reading</h2>
      <p className="mb-3 text-sm text-muted">{t("readingIntro")}</p>
      {kind === "milan" && (
        <p className="mb-3 text-sm font-semibold">Explanation of the computed result — not advice to marry or not.</p>
      )}

      {(status === "idle" || status === "error") && (
        <div className="space-y-3">
          <TurnstileBox ref={turnstile} onToken={setToken} />
          <button className="btn-primary w-full" onClick={getReading} disabled={!token}>
            {t("getReading")}
          </button>
          {error && <p className="text-sm text-bad" role="alert">{error}</p>}
        </div>
      )}
      {status === "retrying" && <p className="text-sm text-warn">{t("rechecking")}</p>}
      {status === "failed" && <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm">{t("readingFailed")}</p>}
      {status === "streaming" && !reading && <p className="text-sm text-muted">Writing your reading…</p>}

      {reading && (
        <div className="space-y-3">
          {READING_CARDS[kind].map(({ key, title }) => {
            const value = reading[key];
            if (value === undefined) return null;
            return (
              <article key={key} className="rounded-xl border border-border bg-background p-3">
                <h3 className="mb-1 flex items-center justify-between font-bold">
                  {title}
                  {!final && <span className="text-xs font-normal text-muted">{t("checking")}</span>}
                </h3>
                {Array.isArray(value) ? (
                  <ul className="space-y-2">
                    {(value as KootItem[]).map((k, i) => (
                      <li key={i} className="text-sm leading-relaxed">
                        <span className="font-semibold">
                          {k.koot} {k.earned !== undefined && k.max !== undefined && `· ${k.earned} / ${k.max}`}
                        </span>
                        {k.explanation && <span className="block">{k.explanation}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="whitespace-pre-line text-sm leading-relaxed">{String(value)}</p>
                )}
              </article>
            );
          })}
          {final && (
            <p className="text-xs text-muted">
              AI-generated from the computed data only. Traditional interpretation; not medical, legal or financial advice.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
