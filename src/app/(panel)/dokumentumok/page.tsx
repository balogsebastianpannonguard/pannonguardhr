import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, FileText, FolderOpen, PenLine, UserRound, X } from "lucide-react";
import { HrDocLegalNote } from "@/components/hrdoc-legal-note";
import { PageTitle } from "@/components/page-title";
import { Empty, LinkButton, Panel, Select, Skeleton, buttonClass } from "@/components/ui";
import { formatStamp } from "@/lib/dates";
import { employeeOptions, parseId } from "@/lib/employees";
import { TEMPLATE_GROUPS, listDocuments, listTemplates } from "@/lib/hr-documents";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "HR-dokumentumok" };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default function DocumentsPage({ searchParams }: PageProps<"/dokumentumok">) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle eyebrow="Munkaügy" title="HR-dokumentumok" accent="sablonból.">
          Munkaszerződés, módosítás, tájékoztató, felmondás vagy igazolás percek alatt: válassz sablont és munkavállalót, az adatokat a nyilvántartásból töltjük ki.
        </PageTitle>
        <LinkButton href="/dokumentumok/sablonok" variant="secondary" size="sm">
          <PenLine size={15} aria-hidden /> Sablonok szerkesztése
        </LinkButton>
      </div>
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Documents searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Documents({ searchParams }: Pick<PageProps<"/dokumentumok">, "searchParams">) {
  const [, params] = await Promise.all([requireUser(), searchParams]);
  const employeeParam = one(params.dolgozo);
  const employeeId = parseId(employeeParam);
  const [templates, options, documents] = await Promise.all([listTemplates(), employeeOptions(true), listDocuments(employeeId ?? undefined)]);
  const selected = employeeId ? options.find((option) => option.id === employeeParam) : undefined;
  const groups = Object.entries(TEMPLATE_GROUPS) as [keyof typeof TEMPLATE_GROUPS, string][];

  return (
    <div className="space-y-6">
      {selected && (
        <div className="pg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
          <p className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-rose/15 text-rose">
              <UserRound size={17} aria-hidden />
            </span>
            <span>
              <span className="font-semibold">{selected.name}</span>
              <span className="block text-sm text-white/50">{selected.position} · a sablonra kattintva az ő adataival készül a dokumentum</span>
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/munkavallalok/${selected.id}`} variant="ghost" size="sm">
              Adatlap
            </LinkButton>
            <LinkButton href={`/be-kilepes?dolgozo=${selected.id}`} variant="secondary" size="sm">
              Be- és kilépés
            </LinkButton>
            <LinkButton href="/dokumentumok" variant="ghost" size="sm">
              <X size={14} aria-hidden /> Szűrés törlése
            </LinkButton>
          </div>
        </div>
      )}

      <Panel title="Új dokumentum" icon={FileText}>
        <form action="/dokumentumok/uj" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-white/70">Sablon</span>
            <Select name="sablon" required defaultValue="">
              <option value="" disabled>
                – válassz –
              </option>
              {groups.map(([group, label]) => (
                <optgroup key={group} label={label}>
                  {templates
                    .filter((template) => template.group === group)
                    .map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.title}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-white/70">Munkavállaló</span>
            <Select name="dolgozo" required defaultValue={selected?.id ?? ""}>
              <option value="" disabled>
                – válassz –
              </option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {option.position}
                  {option.status === "kilepett" ? " (kilépett)" : ""}
                </option>
              ))}
            </Select>
          </label>
          <button type="submit" className={buttonClass("primary")}>
            Tovább <ArrowRight size={16} aria-hidden />
          </button>
        </form>

        <div className="mt-6 space-y-5">
          {groups.map(([group, label]) => (
            <div key={group}>
              <h3 className="mb-2 text-xs font-semibold tracking-[0.18em] text-white/40 uppercase">{label}</h3>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {templates
                  .filter((template) => template.group === group)
                  .map((template) => (
                    <li key={template.key}>
                      <Link
                        href={`/dokumentumok/uj?sablon=${template.key}${selected ? `&dolgozo=${selected.id}` : ""}`}
                        className="pg-card flex h-full flex-col rounded-2xl p-4"
                      >
                        <span className="font-semibold">{template.title}</span>
                        <span className="mt-1 flex-1 text-sm text-white/50">{template.description}</span>
                        {template.custom && <span className="mt-2 text-xs text-pink-bright">Módosított szöveg</span>}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        <HrDocLegalNote className="mt-6" />
      </Panel>

      <Panel title={selected ? `${selected.name} dokumentumai` : "Elkészült dokumentumok"} icon={FolderOpen}>
        {documents.length === 0 ? (
          <Empty icon={FolderOpen} title="Még nincs mentett dokumentum" text="A mentett dokumentumok itt jelennek meg; bármikor újra megnyithatod, módosíthatod és kinyomtathatod őket." />
        ) : (
          <ul className="divide-y divide-white/6">
            {documents.map((document) => (
              <li key={document.id}>
                <Link href={`/dokumentumok/${document.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl px-2 py-3 transition hover:bg-white/4">
                  <span className="min-w-0">
                    <span className="block font-medium [overflow-wrap:anywhere]">{document.title}</span>
                    <span className="block text-sm text-white/50">
                      {!selected && `${document.employeeName} · `}
                      {document.number}
                    </span>
                  </span>
                  <span className="text-xs text-white/40">
                    {formatStamp(document.createdAt)} · {document.createdBy}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
