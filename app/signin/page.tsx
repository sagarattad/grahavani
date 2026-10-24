import type { Metadata } from "next";
import { Suspense } from "react";
import { googleConfigured, signIn } from "@/auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  AccessDenied: "This Google account doesn't have access to this site.",
};

/** Only same-site paths, so the sign-in can't be used to redirect elsewhere. */
const safeNext = (next: string | undefined) => (next?.startsWith("/") && !next.startsWith("//") ? next : "/");

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <Suspense fallback={null}>
      <SignIn searchParams={searchParams} />
    </Suspense>
  );
}

async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  const error = typeof params.error === "string" ? (ERRORS[params.error] ?? "Sign-in didn't work. Please try again.") : null;

  return (
    <section className="card mx-auto mt-6 max-w-sm text-center">
      <h1 className="text-xl font-extrabold">Sign in</h1>
      <p className="mt-1 text-sm text-muted">This site is private. Sign in with an approved Google account.</p>
      {error && <p className="mt-3 rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
      {googleConfigured ? (
        <form
          className="mt-4"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: next });
          }}
        >
          <button className="btn-primary w-full">Sign in with Google</button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-bad">Google sign-in isn&apos;t set up (AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET).</p>
      )}
    </section>
  );
}
