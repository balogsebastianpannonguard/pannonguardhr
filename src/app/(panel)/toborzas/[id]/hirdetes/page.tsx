import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { CopyButton, PrintButton } from "@/components/recruitment-tools";
import { Skeleton } from "@/components/ui";
import { EMPLOYMENT_TYPES } from "@/lib/employees";
import { getPosition } from "@/lib/recruitment";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Álláshirdetés" };

export default function AdPrintPage({ params }: PageProps<"/toborzas/[id]/hirdetes">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <Ad params={params} />
    </Suspense>
  );
}

async function Ad({ params }: Pick<PageProps<"/toborzas/[id]/hirdetes">, "params">) {
  const [{ id }] = await Promise.all([params, requireUser()]);
  const position = await getPosition(id);
  if (!position) notFound();
  const text = position.ad?.text ?? "";

  return (
    <div className="space-y-6">
      <div className="print-hidden flex flex-wrap items-center justify-between gap-3">
        <Link href={`/toborzas/${position.id}`} className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
          <ArrowLeft size={15} aria-hidden /> {position.title}
        </Link>
        {text && (
          <div className="flex flex-wrap gap-2">
            <CopyButton text={text} label="Szöveg másolása" />
            <PrintButton />
          </div>
        )}
      </div>
      {text ? (
        <article className="mx-auto w-full max-w-[52rem] rounded-2xl bg-white px-6 py-8 text-[#14182b] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] sm:px-14 sm:py-14 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
          <header className="border-b-2 border-[#14182b] pb-4">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#4b5563] uppercase">PannonGuard · Álláslehetőség</p>
            <h1 className="mt-2 text-3xl font-bold [overflow-wrap:anywhere]">{position.title}</h1>
            <p className="mt-1 text-sm text-[#4b5563]">
              {[position.location, position.department, EMPLOYMENT_TYPES[position.employmentType], position.schedule].filter(Boolean).join(" · ")}
            </p>
          </header>
          <div className="mt-6 text-[15px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</div>
        </article>
      ) : (
        <p className="text-white/60">Ehhez az álláshelyhez még nincs mentett hirdetésszöveg. Az álláshely oldalán készítheted el.</p>
      )}
    </div>
  );
}
