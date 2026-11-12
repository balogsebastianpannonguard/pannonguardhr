import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CircleAlert, Pencil } from "lucide-react";
import { DeleteDocumentButton, PrintButton } from "@/components/hrdoc-actions";
import { HrDocLegalNote } from "@/components/hrdoc-legal-note";
import { HrDocPaper, displayValues, fillText, missingKeys } from "@/components/hrdoc-paper";
import { LinkButton, Skeleton } from "@/components/ui";
import { formatStamp } from "@/lib/dates";
import { parseId } from "@/lib/employees";
import { BUILTIN_TEMPLATES, getDocument, templateLabels } from "@/lib/hr-documents";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "HR-dokumentum" };

export default function DocumentPage({ params }: PageProps<"/dokumentumok/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[52rem]" />}>
      <DocumentView params={params} />
    </Suspense>
  );
}

async function DocumentView({ params }: Pick<PageProps<"/dokumentumok/[id]">, "params">) {
  const [, { id }] = await Promise.all([requireUser(), params]);
  const _id = parseId(id);
  const document = _id ? await getDocument(_id) : null;
  if (!document) notFound();

  const template = BUILTIN_TEMPLATES.find((item) => item.key === document.templateKey);
  const fields = template?.fields ?? [];
  const values = displayValues(document.content.values, fields);
  const labels = templateLabels(template);
  const missing = missingKeys(fillText(document.content.body, values));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/dokumentumok?dolgozo=${document.employeeId}`} className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
          <ArrowLeft size={15} aria-hidden /> {document.employeeName} dokumentumai
        </Link>
        <div className="flex flex-wrap gap-2">
          <DeleteDocumentButton id={document.id} />
          <LinkButton href={`/dokumentumok/${document.id}/szerkesztes`} variant="secondary" size="sm">
            <Pencil size={15} aria-hidden /> Szerkesztés
          </LinkButton>
          <PrintButton />
        </div>
      </div>

      <div className="space-y-3 print:hidden">
        <p className="text-sm text-white/45">
          {document.title} · {document.number} · készítette: {document.createdBy}, {formatStamp(document.createdAt)}
          {document.updatedAt.getTime() !== document.createdAt.getTime() && ` · módosítva: ${formatStamp(document.updatedAt)}`}
        </p>
        {missing.length > 0 && (
          <p className="flex items-start gap-2 rounded-2xl border border-amber-300/25 bg-amber-400/8 p-3 text-sm text-amber-100">
            <CircleAlert size={16} aria-hidden className="mt-0.5 shrink-0 text-amber-300" />
            Kitöltetlen: {missing.map((key) => labels[key] ?? key).join(", ")}. Nyomtatásban üres vonalként jelenik meg, kézzel pótolható.
          </p>
        )}
        <HrDocLegalNote />
      </div>

      <HrDocPaper title={document.title} number={document.number} body={document.content.body} values={values} labels={labels} signatures={template?.signatures ?? ["munkaltato", "munkavallalo"]} />
    </div>
  );
}
