"use client";
import { useRef, useState } from "react";
import { getT } from "@/lib/i18n";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import type { ReadingKind } from "@/lib/ai/schemas";
import { TurnstileBox } from "./TurnstileBox";

type QA = { q: string; a: string | null };

export function FollowupBox({ kind, slug }: { kind: ReadingKind; slug: string }) {
  const t = getT("result");
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<QA[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileInstance | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3 || !token) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, slug, question: q, language: "en", turnstileToken: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (!res.ok) return setError(data.error ?? "Could not answer right now.");
      setHistory((h) => [...h, { q, a: data.answer?.answer ?? null }]);
      setQuestion("");
    } finally {
      setPending(false);
      setToken(null);
      turnstile.current?.reset();
    }
  }

  return (
    <section className="card mb-4">
      <h2 className="h2">{t("askTitle")}</h2>
      {history.map((x, i) => (
        <div key={i} className="mb-3 text-sm">
          <p className="font-semibold">Q: {x.q}</p>
          <p className="mt-1 leading-relaxed">{x.a ?? t("noAnswer")}</p>
        </div>
      ))}
      <form onSubmit={ask} className="space-y-3">
        <textarea
          className="field min-h-20 py-2"
          maxLength={300}
          placeholder={t("askPlaceholder")}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <TurnstileBox ref={turnstile} onToken={setToken} />
        <button className="btn-primary w-full" disabled={pending || !token || question.trim().length < 3 || remaining === 0}>
          {pending ? "…" : t("ask")}
        </button>
        {remaining !== null && <p className="help">{t("remaining", { count: remaining })}</p>}
        {error && <p className="text-sm text-bad" role="alert">{error}</p>}
      </form>
    </section>
  );
}
