import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, DatabaseZap, Download, History, Info } from "lucide-react";
import { AppsheetImport } from "@/components/appsheet-import";
import { PageTitle } from "@/components/page-title";
import { Panel, Skeleton, buttonClass } from "@/components/ui";
import { latestAppsheetImport } from "@/lib/appsheet";
import { formatStamp } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "AppSheet-betöltés" };

const number = new Intl.NumberFormat("hu-HU");

export default function AppsheetPage() {
  return (
    <div className="space-y-8">
      <Link href="/munkavallalok" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Munkatársak
      </Link>
      <PageTitle eyebrow="Állomány" title="AppSheet-nyilvántartás" accent="betöltése.">
        A munkatársak teljes adatlapja az AppSheet-exportból – minden oszlop, betűre pontosan. Előbb ellenőrzöl, utána töltesz
        be; a végén a rendszer mindent visszaolvas, és cellánként összeveti a fájllal.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Body />
      </Suspense>
    </div>
  );
}

async function Body() {
  await requireUser();
  const last = await latestAppsheetImport();
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel title="Export feltöltése" icon={DatabaseZap}>
        <AppsheetImport />
      </Panel>
      <div className="space-y-6">
        <Panel title="Legutóbbi betöltés" icon={History}>
          {last ? (
            <div className="space-y-3 text-sm">
              <p className="[overflow-wrap:anywhere]">
                <strong>{last.file}</strong>
              </p>
              <p className="text-white/60">
                {formatStamp(last.at)} · {last.byName}
              </p>
              <p className="text-white/60">
                {number.format(last.rows)} sor · {number.format(last.result.created)} új · {number.format(last.result.updated)} frissített ·{" "}
                {number.format(last.result.unchanged)} változatlan
              </p>
              {last.result.verified && (
                <p className={last.result.verified.mismatches === 0 ? "text-emerald-200" : "text-red-200"}>
                  Visszaellenőrzés: {number.format(last.result.verified.cells)} cella, {number.format(last.result.verified.mismatches)} eltérés
                  {last.result.verified.exactBytes ? " · bájtra azonos" : ""}
                </p>
              )}
              <a href="/munkavallalok/appsheet/export" download className={`${buttonClass("secondary", "sm")} w-full`}>
                <Download size={15} aria-hidden /> Letöltés AppSheet-formátumban
              </a>
              <p className="text-xs text-white/40">A rendszerben tárolt adatokból, az eredetivel azonos formában. Bizalmas adatot tartalmaz; a letöltést naplózom.</p>
            </div>
          ) : (
            <p className="text-sm text-white/55">Még nem volt betöltés.</p>
          )}
        </Panel>
        <Panel title="Hogyan működik?" icon={Info}>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-white/65">
            <li>Az AppSheet-ben exportáld a nézetet CSV-be, és a fájlt változtatás nélkül töltsd fel.</li>
            <li>
              Minden oszlop megmarad. A születési adatok, azonosítók (TAJ, adóazonosító, személyi igazolvány, személyi szám), lakcímek,
              számlaszám és a gyermekek adatai titkosítva kerülnek az adatbázisba.
            </li>
            <li>A gyanús adatokat (pl. 8 jegyű TAJ-szám, hibás ellenőrző szám) megjelölöm, de nem írom át.</li>
            <li>
              Újabb exportnál a munkatársak az AppSheet-azonosítójuk alapján frissülnek, nem duplikálódnak. Aki kimaradt az új fájlból,
              azt nem törlöm, csak jelölöm.
            </li>
            <li>Az AppSheet-adatok kitöltik a munkatárs HR-adatlapját is (név, cég, munkakör, egység, belépés, orvosi, igazolványok), így a lejáratfigyelés is látja őket.</li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}
