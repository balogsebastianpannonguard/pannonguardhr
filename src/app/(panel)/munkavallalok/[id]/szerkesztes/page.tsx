import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { EmployeeForm } from "@/components/employee-form";
import { PageTitle } from "@/components/page-title";
import { Skeleton } from "@/components/ui";
import { employeeFacets, getEmployeeView } from "@/lib/employees";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Munkavállaló szerkesztése" };

export default function EditEmployeePage({ params }: PageProps<"/munkavallalok/[id]/szerkesztes">) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Suspense fallback={<Skeleton className="h-[48rem]" />}>
        <EditEmployee params={params} />
      </Suspense>
    </div>
  );
}

async function EditEmployee({ params }: Pick<PageProps<"/munkavallalok/[id]/szerkesztes">, "params">) {
  const [{ id }] = await Promise.all([params, requireUser()]);
  const [view, facets] = await Promise.all([getEmployeeView(id), employeeFacets()]);
  if (!view) notFound();
  return (
    <>
      <Link href={`/munkavallalok/${id}`} className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> {view.employee.name}
      </Link>
      <PageTitle eyebrow="Munkavállaló" title={view.employee.name} accent="szerkesztése." />
      <EmployeeForm employee={view.employee} positions={facets.positions} departments={facets.departments} />
    </>
  );
}
