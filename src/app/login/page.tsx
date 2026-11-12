import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Belépés" };

const NOTICES: Record<string, string> = {
  kilepve: "Sikeresen kijelentkeztél.",
  mindenhol: "Minden eszközön kijelentkeztél.",
  visszavonva: "A hozzáférésedet visszavonták. Fordulj az adminisztrátorhoz.",
  jelszocsere: "Az új jelszavad be van állítva. Lépj be vele.",
  ujhitelesito: "Az adminisztrátor visszaállította a hitelesítődet. Belépés után állítsd be újra.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell
      eyebrow="Belépés"
      title="Az emberek, akik a csapatot adják."
      accent="Egy helyen."
      intro="Lépj be az e-mail-címeddel és a jelszavaddal, majd erősítsd meg a hitelesítő alkalmazás kódjával."
    >
      <Suspense fallback={<LoginForm />}>
        <LoginWithNotice searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LoginWithNotice({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { ok } = await searchParams;
  return <LoginForm notice={typeof ok === "string" ? NOTICES[ok] : undefined} />;
}
