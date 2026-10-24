"use client";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";

// Cloudflare Turnstile. Tokens are single-use: call ref.reset() after each submit.
export const TurnstileBox = forwardRef<TurnstileInstance, { onToken: (t: string | null) => void }>(
  function TurnstileBox({ onToken }, ref) {
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
