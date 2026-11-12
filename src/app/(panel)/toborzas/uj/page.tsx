import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, BriefcaseBusiness } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { PositionForm } from "@/components/recruitment-position-form";
import { Panel, Skeleton } from "@/components/ui";
import { EMPLOYMENT_TYPES } from "@/lib/employees";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Új álláshely" };

export default function NewPositionPage() {
  return (
    <div className="space-y-8">
      <Link href="/toborzas" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Toborzás
      </Link>
      <PageTitle eyebrow="Toborzás" title="Új" accent="álláshely.">
        Add meg a pozíció alapadatait és az elvárásokat – ezekből készül a hirdetés, és ehhez méri az AI a jelölteket.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-[36rem] max-w-3xl" />}>
        <NewPosition />
      </Suspense>
    </div>
  );
}

async function NewPosition() {
  await requireUser();
  return (
    <Panel title="Álláshely adatai" icon={BriefcaseBusiness} className="max-w-3xl">
      <PositionForm employmentTypes={Object.entries(EMPLOYMENT_TYPES)} />
    </Panel>
  );
}
