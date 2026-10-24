import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadProfile } from "@/lib/targets";
import { canModify } from "@/lib/ownership";
import { auth } from "@/auth";
import { Attribution, Note, Section, Skeleton, Term } from "@/components/ui";
import { PersonHeader } from "@/components/kundli";
import { ManglikDetails } from "@/components/manglik";
import { manglikStatus } from "@/lib/summaries";
import { manglikOf } from "@/lib/cache";
import { ReadingPanel } from "@/components/ReadingPanel";
import { FollowupBox } from "@/components/FollowupBox";
import { ItemActions } from "@/components/ItemActions";
import type { Attribution as AttributionData } from "@/lib/kundlit-schemas";

export const metadata: Metadata = { title: "Manglik Dosha", robots: { index: false, follow: false } };

export default function ManglikPage({ params }: PageProps<"/manglik/[slug]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <ManglikView params={params} />
    </Suspense>
  );
}

async function ManglikView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  const row = profile?.birthChart.manglik;
  if (!profile || !row) notFound();
  const m = manglikOf(row);
  const [session, editable] = await Promise.all([auth(), canModify(profile.userId)]);

  return (
    <div>
      <PersonHeader
        title={<Term id="manglik" full />}
        name={profile.name}
        birthDate={profile.birthDate}
        birthTime={profile.birthTime}
        placeLabel={profile.placeLabel}
        slug={slug}
        canEdit={editable}
      />
      <section className={`card mb-4 text-center ${m.manglik ? "border-warn/50" : "border-good/50"}`}>
        <p className={`text-3xl font-extrabold ${m.manglik ? "text-warn" : "text-good"}`}>{manglikStatus(m)}</p>
        {m.manglik && m.cancellations.length > 0 && (
          <p className="mt-1 text-sm text-muted">{m.cancellations.length} cancellation(s) apply — see below.</p>
        )}
      </section>
      <Section title="Details">
        <ManglikDetails m={m} />
        <Attribution data={row.attribution as AttributionData} />
      </Section>
      <Note title="Please note">
        Manglik Dosha is one traditional factor. It is not a prediction about anyone&apos;s life or marriage.
      </Note>
      <ReadingPanel kind="manglik" slug={slug} />
      <FollowupBox kind="manglik" slug={slug} />
      <ItemActions
        kind="manglik"
        type="profile"
        slug={slug}
        canSave={Boolean(session?.user)}
        saved={Boolean(profile.userId)}
        shareText={`Manglik Dosha check for ${profile.name} on Grahavani:`}
      />
    </div>
  );
}
