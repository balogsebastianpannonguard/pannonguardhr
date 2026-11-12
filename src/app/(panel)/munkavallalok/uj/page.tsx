import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { EmployeeForm } from "@/components/employee-form";
import { PageTitle } from "@/components/page-title";
import { Skeleton } from "@/components/ui";
import { employeeFacets } from "@/lib/employees";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Új munkavállaló" };

export default function NewEmployeePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href="/munkavallalok" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Munkavállalók
      </Link>
      <PageTitle eyebrow="Állomány" title="Új" accent="munkavállaló.">
        Elég a név és a munkakör, a többit később is kiegészítheted. A végzettségeket és képesítéseket mentés után, a dolgozó lapján
        tudod felvenni.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-[48rem]" />}>
        <NewEmployee />
      </Suspense>
    </div>
  );
}

async function NewEmployee() {
  await requireUser();
  const facets = await employeeFacets();
  return <EmployeeForm positions={facets.positions} departments={facets.departments} />;
}
