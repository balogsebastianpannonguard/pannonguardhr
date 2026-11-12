import Image from "next/image";

export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/logo.png"
        alt="PannonGuard"
        width={878}
        height={1080}
        priority
        className={`h-auto drop-shadow-[0_6px_18px_rgb(232_167_150/0.3)] ${size === "lg" ? "w-11" : "w-9"}`}
      />
      <p className="leading-tight">
        <span className={`block font-display ${size === "lg" ? "text-lg" : ""}`}>PannonGuard</span>
        <span className="block text-[0.6rem] font-semibold tracking-[0.22em] text-rose uppercase">
          HR · Emberi erőforrás
        </span>
      </p>
    </div>
  );
}

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="pg-orb -top-72 left-1/4 size-[46rem] bg-rose/20" />
      <div className="pg-orb -right-48 -bottom-64 size-[40rem] bg-pink/25 [animation-delay:-9s]" />
      <div className="pg-orb top-1/3 -left-64 size-[28rem] bg-pink/10 [animation-delay:-4s]" />
      <div className="pg-grid" />
    </div>
  );
}
