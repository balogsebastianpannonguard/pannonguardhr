import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CircleAlert, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";
import { checkInvitationToken } from "@/lib/invitations";

export const metadata: Metadata = { title: "Regisztráció" };

const PROBLEMS = {
  invalid: "Ez a regisztrációs link nem érvényes. Ellenőrizd, hogy a teljes linket nyitottad-e meg a levélből.",
  expired: "Ez a meghívó lejárt. Kérj új linket az adminisztrátortól.",
  used: "Ezzel a meghívóval már regisztráltak. Ha te voltál, egyszerűen lépj be.",
  revoked: "Ezt a meghívót visszavonták. Fordulj az adminisztrátorhoz.",
};

export default function RegisterPage({ searchParams }: PageProps<"/regisztracio">) {
  return (
    <AuthShell
      eyebrow="Regisztráció"
      title="Üdv a csapatban."
      accent="Kezdjük el."
      intro="Két rövid lépés: add meg a neved és egy erős jelszót, majd állítsd be a telefonodon a hitelesítő alkalmazást."
    >
      <Suspense fallback={<div className="pg-skeleton h-96 rounded-2xl" />}>
        <Registration searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function Registration({ searchParams }: Pick<PageProps<"/regisztracio">, "searchParams">) {
  const { token } = await searchParams;
  // A link érvényessége időfüggő, ezért csak kérésidőben ellenőrizhető.
  await connection();
  const check =
    typeof token === "string"
      ? await checkInvitationToken(token).catch(() => null)
      : ({ status: "invalid" } as const);

  if (!check || check.status !== "valid") {
    return (
      <div className="space-y-5">
        <div className="flex gap-3 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
          <CircleAlert size={19} aria-hidden className="mt-0.5 shrink-0 text-red-300" />
          <p>{check ? PROBLEMS[check.status] : "A regisztráció átmenetileg nem érhető el."}</p>
        </div>
        <Link href="/login" className="inline-block text-sm text-mint underline underline-offset-4">
          Tovább a belépéshez
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-2xl border border-mint/20 bg-mint/8 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint/15 text-mint">
          <MailCheck size={19} aria-hidden />
        </span>
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold">{check.email}</p>
          <p className="text-white/55">
            Meghívott: <span className="text-white/80">{check.invitedBy}</span> · HR
          </p>
        </div>
      </div>
      <RegisterForm token={typeof token === "string" ? token : ""} />
    </div>
  );
}
