import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import QRCode from "qrcode";
import { CircleAlert } from "lucide-react";
import { Backdrop, Brand } from "@/components/brand";
import { CopySecret, TotpSetupForm } from "@/components/totp-setup-form";
import { open } from "@/lib/secret-box";
import { getPendingSession } from "@/lib/session";
import { formatSecret, otpauthUrl } from "@/lib/totp";
import { findUserById } from "@/lib/users";

export const metadata: Metadata = { title: "Hitelesítő beállítása" };

export default function TwoFactorPage() {
  return (
    <main className="relative min-h-dvh overflow-x-clip px-5 py-10 sm:px-8">
      <Backdrop />
      <div className="relative mx-auto max-w-4xl">
        <Brand size="lg" />
        <p className="mt-12 text-xs font-semibold tracking-[0.22em] text-rose uppercase">
          Utolsó lépés · Kétlépcsős azonosítás
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          Állítsd be a <span className="pg-accent-text">hitelesítőt.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-white/60">
          A rendszerbe ezentúl a jelszavad mellett a telefonodon generált hatjegyű kóddal lépsz be.
          Így akkor is biztonságban vagy, ha a jelszavad illetéktelen kézbe kerül.
        </p>
        <Suspense fallback={<div className="pg-skeleton mt-10 h-[28rem] rounded-3xl" />}>
          <Setup />
        </Suspense>
      </div>
    </main>
  );
}

async function Setup() {
  const session = await getPendingSession("setup");
  const user = session ? await findUserById(session.userId) : null;

  if (!user || user.totpEnabledAt) {
    return (
      <div className="pg-panel mt-10 flex flex-col items-start gap-4 rounded-3xl p-6">
        <p className="flex items-center gap-2 text-red-200">
          <CircleAlert size={18} aria-hidden /> A beállítási munkamenet lejárt vagy már befejeződött.
        </p>
        <Link href="/login" className="pg-button rounded-xl px-5 py-2.5 font-semibold">
          Belépés
        </Link>
      </div>
    );
  }

  const secret = open(user.totpSecret);
  const qr = await QRCode.toDataURL(otpauthUrl(user.email, secret), {
    margin: 1,
    width: 440,
    errorCorrectionLevel: "M",
    color: { dark: "#0a1712", light: "#ffffff" },
  });

  return (
    <div className="mt-10 grid gap-5 lg:grid-cols-3">
      <Step number={1} title="Telepítsd az alkalmazást">
        <p className="text-sm leading-relaxed text-white/60">
          Töltsd le a telefonodra a <strong className="text-white">Google Authenticator</strong>, a{" "}
          <strong className="text-white">Microsoft Authenticator</strong> vagy bármely más TOTP-alapú
          hitelesítő alkalmazást az App Store-ból vagy a Google Play-ből.
        </p>
      </Step>

      <Step number={2} title="Olvasd be a QR-kódot">
        <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-[0_20px_60px_-20px_rgb(232_167_150/0.45)]">
          {/* A QR-kód data URL, a Next képoptimalizálója nem kezeli. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR-kód a hitelesítő alkalmazáshoz" width={176} height={176} />
        </div>
        <p className="mt-4 text-xs text-white/50">Nem tudod beolvasni? Add meg kézzel ezt a kulcsot:</p>
        <div className="mt-2">
          <CopySecret secret={formatSecret(secret)} />
        </div>
      </Step>

      <Step number={3} title="Írd be a kódot">
        <p className="mb-4 text-sm text-white/60">
          Az alkalmazásban megjelenik a <strong className="text-white">PannonGuard</strong> bejegyzés.
          Írd be az ott látható hatjegyű kódot.
        </p>
        <TotpSetupForm />
        <p className="mt-3 text-xs text-white/40">Fiók: {user.email}</p>
      </Step>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="pg-panel pg-rise rounded-3xl p-6"
      style={{ animationDelay: `${number * 0.08}s` }}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-rose font-display text-sm font-bold text-ink-950">
          {number}
        </span>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
