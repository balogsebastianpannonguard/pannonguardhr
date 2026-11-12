import type { ReactNode } from "react";
import { FileText, ShieldCheck, UserRoundPlus, Users } from "lucide-react";
import { Backdrop, Brand } from "@/components/brand";

const FEATURES = [
  { icon: Users, title: "Munkavállalók", text: "A csapat tagjai és adataik egy áttekinthető helyen." },
  { icon: FileText, title: "Iratok", text: "Szerződések, igazolások és lejáratok nyomon követve." },
  { icon: UserRoundPlus, title: "Felvétel", text: "Az új kollégák beléptetése lépésről lépésre." },
];

/** A belépés, a regisztráció és a hitelesítő beállításának közös kerete. */
export function AuthShell({
  eyebrow,
  title,
  accent,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative grid min-h-dvh overflow-x-clip lg:grid-cols-[minmax(0,32rem)_1fr]">
      <Backdrop />

      <section className="pg-rise relative z-10 flex flex-col justify-center border-white/8 bg-ink-900/80 px-6 py-12 backdrop-blur-xl sm:px-12 lg:border-r">
        <Brand size="lg" />
        <p className="mt-14 text-xs font-semibold tracking-[0.22em] text-mint uppercase">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight font-semibold tracking-tight">
          {title}
          <br />
          <span className="pg-accent-text">{accent}</span>
        </h1>
        <div className="mt-4 mb-9 text-white/60">{intro}</div>
        {children}
      </section>

      <aside className="relative hidden items-center justify-center p-12 lg:flex">
        <div className="w-full max-w-md space-y-4">
          <div className="pg-panel flex items-center gap-4 rounded-3xl p-6">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-mint/12 text-mint">
              <ShieldCheck size={24} aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">Kétlépcsős védelem</p>
              <p className="text-sm text-white/55">
                Jelszó és a telefonodon generált hatjegyű kód – csak együtt nyitják a rendszert.
              </p>
            </div>
          </div>
          {FEATURES.map(({ icon: Icon, title, text }, index) => (
            <div
              key={title}
              className="pg-card pg-rise flex items-center gap-4 rounded-2xl p-5"
              style={{ animationDelay: `${0.15 + index * 0.1}s` }}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf/20 text-leaf-bright">
                <Icon size={19} aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-white/55">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}
