import type { ReactNode } from "react";

export function PageTitle({
  eyebrow,
  title,
  accent,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  children?: ReactNode;
}) {
  return (
    <div className="pg-rise">
      <p className="text-xs font-semibold tracking-[0.22em] text-rose uppercase">{eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
        {title} {accent && <span className="pg-accent-text">{accent}</span>}
      </h1>
      {children && <div className="mt-2 max-w-2xl text-white/60">{children}</div>}
    </div>
  );
}
