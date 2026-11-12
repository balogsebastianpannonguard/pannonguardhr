import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Download, FileSpreadsheet, Info } from "lucide-react";
import { EmployeeImport } from "@/components/employee-import";
import { PageTitle } from "@/components/page-title";
import { Panel, Skeleton, buttonClass } from "@/components/ui";
import { IMPORT_HEADERS } from "@/lib/employees-csv";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Munkavállalók importálása" };

export default function ImportPage() {
  return (
    <div className="space-y-8">
      <Link href="/munkavallalok" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Munkavállalók
      </Link>
      <PageTitle eyebrow="Állomány" title="Import" accent="Excelből.">
        Töltsd fel a meglévő nyilvántartásodat CSV-ben. Előbb előnézetet kapsz soronkénti hibajelzéssel, és csak utána rögzítünk
        bármit.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ImportBody />
      </Suspense>
    </div>
  );
}

async function ImportBody() {
  await requireUser();
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel title="CSV feltöltése" icon={FileSpreadsheet}>
        <EmployeeImport />
      </Panel>
      <Panel title="Így készítsd elő" icon={Info}>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-white/65">
          <li>Az első sor a fejléc legyen. Az oszlopok sorrendje mindegy, a nevüket ékezettől és kis-nagybetűtől függetlenül ismerem fel.</li>
          <li>Kötelező: <strong>Név</strong> és <strong>Munkakör</strong>. Minden más elhagyható.</li>
          <li>Dátum lehet 2026.03.01., 2026.03.01 vagy 2026-03-01 formában.</li>
          <li>Akit e-mail-cím, vagy név és belépési nap alapján már nyilvántartunk, azt kihagyom.</li>
          <li>Bért, adóazonosítót, TAJ-t és lakcímet ne tegyél a fájlba – ezeket a dolgozó lapján, titkosítva vidd fel.</li>
        </ol>
        <p className="mt-4 text-xs text-white/45">Felismert oszlopok: {IMPORT_HEADERS.join(", ")}.</p>
        <a href="/munkavallalok/sablon" download className={`${buttonClass("secondary", "sm")} mt-4 w-full`}>
          <Download size={15} aria-hidden /> Üres sablon letöltése
        </a>
      </Panel>
    </div>
  );
}
