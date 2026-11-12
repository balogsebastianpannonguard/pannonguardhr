import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-8 text-center">
      <div>
        <p className="text-xs font-semibold tracking-[0.25em] text-rose uppercase">404</p>
        <h1 className="mt-4 font-display text-4xl font-light">Ez az oldal nem található</h1>
        <Link href="/" className="mt-6 inline-block text-rose underline underline-offset-4">
          Vissza az áttekintéshez
        </Link>
      </div>
    </main>
  );
}
