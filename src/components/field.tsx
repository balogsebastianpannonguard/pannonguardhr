import type { ReactNode } from "react";

export function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="group block">
      <span className="mb-2 block text-sm font-medium text-white/70">{label}</span>
      <span className="pg-field flex items-center gap-3 rounded-xl px-4">
        {icon && (
          <span className="text-white/40 transition-colors group-focus-within:text-rose">{icon}</span>
        )}
        {children}
      </span>
      {hint && <span className="mt-1.5 block text-xs text-white/45">{hint}</span>}
    </label>
  );
}

export const inputClass = "pg-input h-12 w-full min-w-0 text-white placeholder:text-white/30";
