"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Re-renders the page on the server, which retries any data that failed to load. */
export function RetryButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="font-semibold text-brand underline disabled:opacity-50" disabled={pending} onClick={() => start(() => router.refresh())}>
      {pending ? "Retrying…" : "Retry"}
    </button>
  );
}
