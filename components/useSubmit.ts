"use client";
import { useEffect, useRef, useState } from "react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";

/**
 * Posts a form with a fresh Turnstile token. When the server says Kundlit is
 * busy it shows a countdown and retries automatically with a new token.
 */
export function useSubmit<T>(endpoint: string) {
  const turnstile = useRef<TurnstileInstance | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState(0);
  const lastBody = useRef<Record<string, unknown> | null>(null);
  const onDone = useRef<((r: T) => void) | null>(null);
  const retryPending = useRef(false);

  async function send(body: Record<string, unknown>, tok: string) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, turnstileToken: tok }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return onDone.current?.(data as T);
      if (data.code === "busy") {
        retryPending.current = true;
        setRetryIn(Math.min(Number(data.retryAfter) || 20, 60));
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setToken(null); // tokens are single-use
      turnstile.current?.reset();
      setSending(false);
    }
  }

  useEffect(() => {
    if (retryIn <= 0) return;
    const id = setTimeout(() => setRetryIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [retryIn]);

  useEffect(() => {
    if (retryPending.current && retryIn === 0 && token && !sending && lastBody.current) {
      retryPending.current = false;
      void send(lastBody.current, token);
    }
  });

  function submit(body: Record<string, unknown>, done: (r: T) => void) {
    if (!token) return setError("Please wait for the human check to finish.");
    lastBody.current = body;
    onDone.current = done;
    void send(body, token);
  }

  return { turnstile, setToken, pending: sending || retryIn > 0, error, setError, retryIn, submit };
}
