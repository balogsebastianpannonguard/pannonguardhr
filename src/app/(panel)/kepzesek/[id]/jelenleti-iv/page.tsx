import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/training-actions";
import { Skeleton } from "@/components/ui";
import { formatShortDate } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { getTraining } from "@/lib/trainings";
import { TRAINING_TYPES } from "@/lib/trainings-meta";

export const metadata: Metadata = { title: "Jelenléti ív" };

export default function AttendanceSheetPage({ params }: PageProps<"/kepzesek/[id]/jelenleti-iv">) {
  return (
    <Suspense fallback={<Skeleton className="h-[48rem]" />}>
      <Sheet params={params} />
    </Suspense>
  );
}

const fullDate = (day: string) => `${day.slice(0, 4)}. ${formatShortDate(day)}`;

async function Sheet({ params }: Pick<PageProps<"/kepzesek/[id]/jelenleti-iv">, "params">) {
  const [, { id }] = await Promise.all([requireUser(), params]);
  const training = await getTraining(id);
  if (!training) notFound();
  // Üres sorok a helyszínen csatlakozóknak (legalább 3, és legalább 12 sor összesen).
  const blanks = Math.max(3, 12 - training.participants.length);

  return (
    <div className="space-y-6">
      <div className="print-hidden flex flex-wrap items-center justify-between gap-3">
        <Link href={`/kepzesek/${training.id}`} className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
          <ArrowLeft size={15} aria-hidden /> Vissza a képzéshez
        </Link>
        <PrintButton label="Jelenléti ív nyomtatása" />
      </div>

      <article className="mx-auto w-full max-w-[52rem] rounded-2xl bg-white px-6 py-8 text-[#14182b] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] sm:px-12 sm:py-12 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <div className="border-b-2 border-[#14182b] pb-4">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#4b5563] uppercase">PannonGuard Biztonsági Szolgáltató Zrt.</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Jelenléti ív</h1>
          <p className="mt-1 text-base font-semibold">{training.name}</p>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2 print:grid-cols-2">
          <Row label="Típus" value={TRAINING_TYPES[training.type]} />
          <Row label="Időpont" value={training.endDate ? `${fullDate(training.startDate)} – ${fullDate(training.endDate)}` : fullDate(training.startDate)} />
          <Row label="Helyszín" value={training.location} />
          <Row label="Oktató / képző" value={training.trainer} />
        </dl>

        <div className="mt-6 overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[34rem] border-collapse text-sm print:min-w-0">
            <thead>
              <tr className="border-y-2 border-[#14182b] text-left">
                <th className="w-10 py-2 pr-2">#</th>
                <th className="py-2 pr-3">Név</th>
                <th className="py-2 pr-3">Munkakör</th>
                <th className="w-[38%] py-2">Aláírás</th>
              </tr>
            </thead>
            <tbody>
              {training.participants.map((participant, index) => (
                <tr key={participant.employeeId} className="h-11 break-inside-avoid border-b border-[#9ca3af]">
                  <td className="pr-2 tabular-nums">{index + 1}.</td>
                  <td className="pr-3 font-medium">{participant.name}</td>
                  <td className="pr-3 text-[#4b5563]">{participant.position}</td>
                  <td />
                </tr>
              ))}
              {Array.from({ length: blanks }, (_, index) => (
                <tr key={`blank-${index}`} className="h-11 break-inside-avoid border-b border-[#9ca3af]">
                  <td className="pr-2 text-[#9ca3af] tabular-nums">{training.participants.length + index + 1}.</td>
                  <td />
                  <td />
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-sm">
          Az aláírásommal igazolom, hogy a fenti képzésen részt vettem, és az oktatás anyagát megértettem.
        </p>

        <div className="mt-14 grid grid-cols-2 gap-10 text-sm break-inside-avoid">
          <div>
            <div className="border-t border-[#14182b] pt-1.5 text-center">Oktató aláírása</div>
          </div>
          <div>
            <div className="border-t border-[#14182b] pt-1.5 text-center">Munkáltató képviselője</div>
          </div>
        </div>
        <p className="mt-8 text-xs text-[#6b7280]">Kelt: ……………………, {fullDate(training.startDate)} · Résztvevők: {training.participants.length} fő</p>
      </article>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-[#4b5563]">{label}:</dt>
      <dd className="font-medium">{value || "……………………………"}</dd>
    </div>
  );
}
