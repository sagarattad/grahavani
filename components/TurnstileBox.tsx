"use client";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef, useEffect, useImperativeHandle } from "react";

/**
 * Turnstile is off when no site key is set (private mode, see lib/request.ts).
 * Forms then send this placeholder instead of a token.
 */
export const TURNSTILE_ON = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
export const NO_TURNSTILE_TOKEN = "turnstile-off";

// Cloudflare Turnstile. Tokens are single-use: call ref.reset() after each submit.
export const TurnstileBox = forwardRef<TurnstileInstance, { onToken: (t: string | null) => void }>(
  function TurnstileBox({ onToken }, ref) {
    if (!TURNSTILE_ON) return <NoTurnstile ref={ref} onToken={onToken} />;
    return (
      <Turnstile
        ref={ref}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
        options={{ size: "flexible", theme: "light" }}
        onSuccess={onToken}
        onExpire={() => onToken(null)}
        onError={() => onToken(null)}
      />
    );
  },
);

/** Renders nothing; hands out the placeholder token at once and after every reset. */
const NoTurnstile = forwardRef<TurnstileInstance, { onToken: (t: string | null) => void }>(function NoTurnstile({ onToken }, ref) {
  useEffect(() => onToken(NO_TURNSTILE_TOKEN), [onToken]);
  useImperativeHandle(
    ref,
    () =>
      ({
        reset: () => onToken(NO_TURNSTILE_TOKEN),
        execute: () => onToken(NO_TURNSTILE_TOKEN),
      }) as unknown as TurnstileInstance,
    [onToken],
  );
  return null;
});
