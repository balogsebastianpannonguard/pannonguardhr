import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, validateSessionToken } from "@/lib/session";

// Ezek az oldalak belépés nélkül (vagy köztes munkamenettel) is elérhetők; a jogosultságot maguk ellenőrzik.
const PUBLIC_PATHS = ["/login", "/regisztracio", "/ketfaktor"];
// A jelszó-visszaállító link belépve és kilépve is megnyitható (az e-mailből érkezik).
const RESET_PATH = "/jelszo-visszaallitas";

export async function proxy(request: NextRequest) {
  // A Vercel Cron nem rendelkezik munkamenettel; a végpont a CRON_SECRET-tel maga védi magát.
  if (request.nextUrl.pathname.startsWith("/api/cron/")) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  // Adatbázishiba esetén a kérés nem kap hozzáférést.
  const session = await validateSessionToken(token).catch(() => null);
  const signedIn = session?.stage === "full";
  const path = request.nextUrl.pathname;
  if (path === RESET_PATH) return NextResponse.next();
  const isPublic = PUBLIC_PATHS.includes(path);

  if (!signedIn && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (signedIn && isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.png|logo.png).*)"],
};
