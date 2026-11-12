import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { HrDocEditor } from "@/components/hrdoc-editor";
import { HrDocLegalNote } from "@/components/hrdoc-legal-note";
import { Skeleton } from "@/components/ui";
import { getEmployee } from "@/lib/employees";
import { STANDARD_FIELDS, getTemplate, initialValues } from "@/lib/hr-documents";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Új HR-dokumentum" };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default function NewDocumentPage({ searchParams }: PageProps<"/dokumentumok/uj">) {
  return (
    <div className="space-y-6">
      <Link href="/dokumentumok" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white print:hidden">
        <ArrowLeft size={15} aria-hidden /> HR-dokumentumok
      </Link>
      <Suspense fallback={<Skeleton className="h-[48rem]" />}>
        <NewDocument searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewDocument({ searchParams }: Pick<PageProps<"/dokumentumok/uj">, "searchParams">) {
  const [, params] = await Promise.all([requireUser(), searchParams]);
  const templateKey = one(params.sablon);
  const employeeParam = one(params.dolgozo);
  if (!templateKey || !employeeParam) redirect(`/dokumentumok${employeeParam ? `?dolgozo=${encodeURIComponent(employeeParam)}` : ""}`);

  const [template, employee] = await Promise.all([getTemplate(templateKey), getEmployee(employeeParam)]);
  if (!template || !employee) notFound();

  return (
    <div className="space-y-6">
      <header className="pg-rise print:hidden">
        <p className="text-xs font-semibold tracking-[0.22em] text-rose uppercase">Új dokumentum</p>
        <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
          {template.title} <span className="pg-accent-text">· {employee.name}</span>
        </h1>
        <p className="mt-2 max-w-2xl text-white/60">
          Töltsd ki a sablon saját mezőit, nézd át az előnézetet, majd mentsd: a mentett változat titkosítva kerül a munkavállaló dokumentumai közé, és onnan nyomtatható.
        </p>
      </header>
      <HrDocLegalNote />
      <HrDocEditor
        templateKey={template.key}
        employeeId={String(employee._id)}
        title={template.title}
        templateBody={template.body}
        initialBody={template.body}
        standard={STANDARD_FIELDS}
        fields={template.fields}
        initialValues={initialValues(template, employee)}
        signatures={template.signatures}
      />
    </div>
  );
}
