import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function Panel({
  title,
  icon: Icon,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`pg-panel rounded-3xl p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold">
              {Icon && (
                <span className="grid size-8 place-items-center rounded-lg bg-rose/15 text-rose">
                  <Icon size={16} aria-hidden />
                </span>
              )}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  ok: "bg-emerald-400/12 text-emerald-200 ring-emerald-300/25",
  warning: "bg-amber-400/12 text-amber-200 ring-amber-300/25",
  error: "bg-red-500/12 text-red-200 ring-red-400/25",
  info: "bg-pink/20 text-pink-bright ring-pink-bright/25",
  muted: "bg-white/6 text-white/60 ring-white/10",
} as const;

export type Tone = keyof typeof TONES;

export function Pill({ tone = "muted", children, icon: Icon }: { tone?: Tone; children: ReactNode; icon?: LucideIcon }) {
  return (
    <span
      className={`inline-flex h-fit shrink-0 items-center gap-1 self-start rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${TONES[tone]}`}
    >
      {Icon && <Icon size={12} aria-hidden />}
      {children}
    </span>
  );
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-white/12 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-rose/10 text-rose">
        <Icon size={26} aria-hidden />
      </span>
      <p className="mt-4 font-display text-lg font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-white/55">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, icon: Icon, tone = "text-white", hint }: { label: string; value: ReactNode; icon: LucideIcon; tone?: string; hint?: ReactNode }) {
  return (
    <div className="pg-card rounded-2xl p-4">
      <Icon size={18} aria-hidden className={`${tone} opacity-80`} />
      <p className={`mt-3 font-display text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-sm text-white/55">{label}</p>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}

export const fieldClass = "pg-field pg-input w-full rounded-xl px-3.5 text-white placeholder:text-white/25 disabled:opacity-50";

export function Label({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block truncate text-sm font-medium text-white/70">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-white/40">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} h-11 ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClass} h-11 px-3 [&>option]:bg-ink-900 ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldClass} min-h-28 py-3 leading-relaxed ${props.className ?? ""}`} />;
}

const BUTTONS = {
  primary: "pg-button font-semibold",
  secondary: "border border-white/12 bg-white/5 font-medium text-white hover:bg-white/10",
  danger: "border border-red-400/30 font-semibold text-red-200 hover:bg-red-500/10",
  ghost: "font-medium text-white/65 hover:bg-white/6 hover:text-white",
} as const;

export function buttonClass(variant: keyof typeof BUTTONS = "primary", size: "sm" | "md" = "md") {
  return `inline-flex items-center justify-center gap-2 rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50 ${
    size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-4"
  } ${BUTTONS[variant]}`;
}

export function LinkButton({ href, children, variant = "primary", size = "md" }: { href: string; children: ReactNode; variant?: keyof typeof BUTTONS; size?: "sm" | "md" }) {
  return (
    <Link href={href} className={buttonClass(variant, size)}>
      {children}
    </Link>
  );
}

export function Feedback({ error, message }: { error?: string; message?: string }) {
  return (
    <p role="status" className={`min-h-5 text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>
      {error ?? message}
    </p>
  );
}

export function Skeleton({ className = "h-64" }: { className?: string }) {
  return <div aria-hidden className={`pg-skeleton rounded-3xl ${className}`} />;
}
