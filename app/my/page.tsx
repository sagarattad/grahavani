import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { auth, googleConfigured } from "@/auth";
import { Section, Skeleton } from "@/components/ui";
import { birthDateTime, points } from "@/lib/format";
import type { Milan } from "@/lib/kundlit-schemas";

export const metadata: Metadata = { title: "My charts", robots: { index: false, follow: false } };

export default function MyPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <MyCharts />
    </Suspense>
  );
}

async function MyCharts() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="card text-center">
        <p>{googleConfigured ? "Log in with Google (top right) to see your saved charts." : "Login is not set up yet."}</p>
      </div>
    );
  }
  const userId = session.user.id;
  const [profiles, matches] = await Promise.all([
    db.profile.findMany({ where: { userId, createdVia: { not: "milan" } }, orderBy: { createdAt: "desc" } }),
    db.match.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { boyProfile: true, girlProfile: true, milanResult: true },
    }),
  ]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">My charts</h1>
      <Section title="My Kundlis">
        {profiles.length === 0 && <p className="text-sm text-muted">Nothing saved yet.</p>}
        <ul className="divide-y divide-border">
          {profiles.map((p) => (
            <li key={p.id}>
              <Link href={`/${p.createdVia}/${p.slug}`} className="flex min-h-11 items-center justify-between py-2">
                <span>
                  <span className="font-semibold">{p.name}</span>
                  <span className="block text-xs text-muted">{birthDateTime(p.birthDate, p.birthTime)}</span>
                </span>
                <span className="text-xs text-muted">{p.createdVia === "manglik" ? "Manglik" : "Kundli"} →</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="My matches">
        {matches.length === 0 && <p className="text-sm text-muted">Nothing saved yet.</p>}
        <ul className="divide-y divide-border">
          {matches.map((m) => (
            <li key={m.id}>
              <Link href={`/milan/${m.slug}`} className="flex min-h-11 items-center justify-between py-2">
                <span className="font-semibold">
                  {m.boyProfile.name} · {m.girlProfile.name}
                </span>
                <span className="font-bold">{points((m.milanResult.result as Milan).total_36)} / 36 →</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <p className="text-sm text-muted">Open an item to delete it.</p>
    </div>
  );
}
