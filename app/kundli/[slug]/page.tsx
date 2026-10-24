import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadProfile } from "@/lib/targets";
import { completedChartRow, ensureFreshDasha } from "@/lib/cache";
import { canModify } from "@/lib/ownership";
import { auth } from "@/auth";
import { Attribution, Skeleton, Term } from "@/components/ui";
import { BoundaryNotes, ChartsSection, DashaSection, LagnaDetails, PersonHeader, PlanetTable, YogasSection } from "@/components/kundli";
import { ReadingPanel } from "@/components/ReadingPanel";
import { DoshasLoader, DoshasSkeleton } from "@/components/doshas";
import { AboutProvider } from "@/components/About";
import { FollowupBox } from "@/components/FollowupBox";
import { ItemActions } from "@/components/ItemActions";
import type { Attribution as AttributionData } from "@/lib/kundlit-schemas";

export const metadata: Metadata = { title: "Kundli", robots: { index: false, follow: false } };

export default function KundliPage({ params }: PageProps<"/kundli/[slug]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <KundliView params={params} />
    </Suspense>
  );
}

async function KundliView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  if (!profile) notFound();
  // Old charts are refreshed once (transit, avastha) so Yogas, planets and Doshas use the same data.
  const [chartRow, dasha, session, editable] = await Promise.all([
    completedChartRow(profile.birthChart),
    ensureFreshDasha(profile.birthChart),
    auth(),
    canModify(profile.userId),
  ]);
  const chart = chartRow.chart;
  const attribution = profile.birthChart.attribution as AttributionData;

  return (
    <div>
      <PersonHeader
        title={<Term id="kundli" full />}
        name={profile.name}
        birthDate={profile.birthDate}
        birthTime={profile.birthTime}
        placeLabel={profile.placeLabel}
        slug={slug}
        canEdit={editable}
      />
      <BoundaryNotes chart={chart} />
      <ChartsSection chart={chart} />
      <PlanetTable chart={chart} />
      <LagnaDetails chart={chart} />
      <AboutProvider type="kundli" slug={slug}>
        <YogasSection chart={chart} asOf={dasha.as_of} />
        <Suspense fallback={<DoshasSkeleton />}>
          <DoshasLoader chartRow={chartRow.row} />
        </Suspense>
      </AboutProvider>
      <DashaSection chart={chart} current={dasha} />
      <ReadingPanel kind="kundli" slug={slug} />
      <FollowupBox kind="kundli" slug={slug} />
      <Attribution data={attribution} />
      <ItemActions
        kind="kundli"
        type="profile"
        slug={slug}
        canSave={Boolean(session?.user)}
        saved={Boolean(profile.userId)}
        shareText={`Kundli of ${profile.name} on Grahavani:`}
      />
    </div>
  );
}
