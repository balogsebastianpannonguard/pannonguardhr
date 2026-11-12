import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { HrDocEditor } from "@/components/hrdoc-editor";
import { HrDocLegalNote } from "@/components/hrdoc-legal-note";
import { Skeleton } from "@/components/ui";
import { parseId } from "@/lib/employees";
import { STANDARD_FIELDS, getDocument, getTemplate } from "@/lib/hr-documents";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "HR-dokumentum szerkesztése" };

export default function EditDocumentPage({ params }: PageProps<"/dokumentumok/[id]/szerkesztes">) {
  return (
    <Suspense fallback={<Skeleton className="h-[48rem]" />}>
      <EditDocument params={params} />
    </Suspense>
  );
}

async function EditDocument({ params }: Pick<PageProps<"/dokumentumok/[id]/szerkesztes">, "params">) {
  const [, { id }] = await Promise.all([requireUser(), params]);
  const _id = parseId(id);
  const document = _id ? await getDocument(_id) : null;
  if (!document) notFound();
  const template = await getTemplate(document.templateKey);

  return (
    <div className="space-y-6">
      <Link href={`/dokumentumok/${document.id}`} className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Vissza a dokumentumhoz
      </Link>
      <header className="pg-rise">
        <p className="text-xs font-semibold tracking-[0.22em] text-rose uppercase">Szerkesztés · {document.number}</p>
        <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
          {document.title} <span className="pg-accent-text">· {document.employeeName}</span>
        </h1>
      </header>
      <HrDocLegalNote />
      <HrDocEditor
        id={document.id}
        templateKey={document.templateKey}
        employeeId={document.employeeId}
        title={document.title}
        number={document.number}
        templateBody={template?.body ?? document.content.body}
        initialBody={document.content.body}
        standard={STANDARD_FIELDS}
        fields={template?.fields ?? []}
        initialValues={document.content.values}
        signatures={template?.signatures ?? ["munkaltato", "munkavallalo"]}
      />
    </div>
  );
}
