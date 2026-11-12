import { LogOut } from "lucide-react";
import { logout } from "@/lib/auth-actions";
import { requireUser } from "@/lib/session";

export async function UserCard({ compact = false }: { compact?: boolean }) {
  const user = await requireUser();
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <div className="flex items-center gap-3" title={compact ? `${user.name} · ${user.email}` : undefined}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-rose-bright to-pink-bright font-display text-sm font-bold text-ink-950 uppercase">
        {initials}
      </span>
      <div className={`min-w-0 flex-1 ${compact ? "sr-only" : ""}`}>
        <p className="truncate text-sm font-semibold">{user.name}</p>
        <p className="truncate text-xs text-white/50">{user.email}</p>
      </div>
      <form action={logout}>
        <button
          type="submit"
          aria-label="Kijelentkezés"
          title="Kijelentkezés"
          className="grid size-9 place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={17} aria-hidden />
        </button>
      </form>
    </div>
  );
}

export function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <span className="pg-skeleton size-10 rounded-full" />
      <span className="flex-1 space-y-1.5">
        <span className="pg-skeleton block h-3 w-28 rounded" />
        <span className="pg-skeleton block h-2.5 w-36 rounded" />
      </span>
    </div>
  );
}
