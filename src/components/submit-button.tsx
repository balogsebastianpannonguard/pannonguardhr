import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="pg-button group flex h-13 w-full items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-70"
    >
      {pending ? <LoaderCircle size={18} aria-hidden className="animate-spin" /> : children}
    </button>
  );
}
