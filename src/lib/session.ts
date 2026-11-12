import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getAccessState, needsTotpReset } from "@/lib/invitations";
import { getDb } from "@/lib/mongodb";
import { findUserById } from "@/lib/users";

const production = process.env.NODE_ENV === "production";

export const SESSION_COOKIE = production
  ? "__Host-pg_hr_session"
  : "pg_hr_session";

/**
 * - `mfa`: a jelszó helyes, a hatjegyű kódra vár.
 * - `setup`: regisztrált, de a hitelesítő alkalmazás még nincs beállítva.
 * - `full`: teljes értékű belépés.
 */
export type SessionStage = "mfa" | "setup" | "full";

const TTL_MS: Record<SessionStage, number> = {
  mfa: 5 * 60 * 1000,
  setup: 30 * 60 * 1000,
  full: 12 * 60 * 60 * 1000,
};
const IDLE_TTL_MS = 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

type SessionDocument = {
  _id: string;
  userId: ObjectId;
  invitationId: ObjectId;
  stage: SessionStage;
  codeAttempts: number;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
};

export type Session = Pick<SessionDocument, "userId" | "invitationId" | "stage"> & {
  id: string;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const sessions = async () => (await getDb()).collection<SessionDocument>("sessions");

export async function createSession(
  userId: ObjectId,
  invitationId: ObjectId,
  stage: SessionStage,
) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const store = await cookies();

  // Az előző (pl. félbehagyott) munkamenet ezen a böngészőn megszűnik.
  const previous = store.get(SESSION_COOKIE)?.value;
  if (previous) await (await sessions()).deleteOne({ _id: hashToken(previous) });

  await (await sessions()).insertOne({
    _id: hashToken(token),
    userId,
    invitationId,
    stage,
    codeAttempts: 0,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + TTL_MS[stage]),
  });

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: production,
    // Lax, hogy a levelekből és más oldalakról érkező linkek is belépett állapotban nyíljanak meg.
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(TTL_MS[stage] / 1000),
  });
}

export async function validateSessionToken(token?: string): Promise<Session | null> {
  if (!token) return null;
  const collection = await sessions();
  const id = hashToken(token);
  const session = await collection.findOne({ _id: id });
  const now = Date.now();
  if (!session || session.expiresAt.getTime() <= now) return null;

  if (session.stage === "full") {
    const idleFor = now - session.lastSeenAt.getTime();
    if (idleFor > IDLE_TTL_MS) {
      await collection.deleteOne({ _id: id });
      return null;
    }
    if (idleFor > TOUCH_INTERVAL_MS) {
      await collection.updateOne({ _id: id }, { $set: { lastSeenAt: new Date(now) } });
    }
  }
  return {
    id,
    userId: session.userId,
    invitationId: session.invitationId,
    stage: session.stage,
  };
}

export async function getSession() {
  // A lejárat ellenőrzése időfüggő, ezért csak kérésidőben futhat.
  await connection();
  return validateSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  firstName: string;
  invitedBy: string;
  totpEnabledAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
};

/** A védett oldalak és műveletek belépési pontja: teljes munkamenetet és élő hozzáférést követel. */
export async function requireUser(): Promise<CurrentUser & { session: Session }> {
  const session = await getSession();
  if (!session || session.stage !== "full") redirect("/login");
  const [user, access] = await Promise.all([
    findUserById(session.userId),
    getAccessState(session.invitationId),
  ]);
  if (!user || access.revoked) {
    await (await sessions()).deleteOne({ _id: session.id });
    redirect("/login?ok=visszavonva");
  }
  if (needsTotpReset(access.totpResetAt, user.totpEnabledAt)) {
    await (await sessions()).deleteOne({ _id: session.id });
    redirect("/login?ok=ujhitelesito");
  }
  return {
    session,
    id: String(user._id),
    email: user.email,
    name: user.name,
    // Magyar névsorrend: a vezetéknév után az első keresztnév.
    firstName: user.name.trim().split(/\s+/)[1] ?? user.name,
    invitedBy: user.invitedBy,
    totpEnabledAt: user.totpEnabledAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

/** Egy köztes (mfa/setup) munkamenet, ha van. */
export async function getPendingSession(stage: Exclude<SessionStage, "full">) {
  const session = await getSession();
  return session?.stage === stage ? session : null;
}

/** Hibás kód után növeli a számlálót; túl sok hibánál törli a munkamenetet. */
export async function registerCodeFailure(session: Session) {
  const collection = await sessions();
  const updated = await collection.findOneAndUpdate(
    { _id: session.id },
    { $inc: { codeAttempts: 1 } },
    { returnDocument: "after" },
  );
  if (!updated || updated.codeAttempts >= MAX_CODE_ATTEMPTS) {
    await collection.deleteOne({ _id: session.id });
    return false;
  }
  return true;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await (await sessions()).deleteOne({ _id: hashToken(token) });
  store.delete({ name: SESSION_COOKIE, path: "/", secure: production });
}

export async function destroyAllSessions(userId: ObjectId) {
  await (await sessions()).deleteMany({ userId });
}

export async function countActiveSessions(userId: ObjectId) {
  // A 60 perce tétlen munkamenet már lejárt, akkor is, ha a törlés még nem történt meg.
  return (await sessions()).countDocuments({
    userId,
    stage: "full",
    expiresAt: { $gt: new Date() },
    lastSeenAt: { $gt: new Date(Date.now() - IDLE_TTL_MS) },
  });
}

export function toObjectId(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}
