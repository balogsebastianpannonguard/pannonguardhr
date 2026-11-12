import "server-only";
import { createHash } from "node:crypto";
import type { ObjectId } from "mongodb";
import { getInvitesDb } from "@/lib/mongodb";

/** Ennek az alrendszernek a munkaköre az elosztóban. */
export const APP_ROLE = "HR";

/**
 * Az elosztó `invitations` gyűjteményének az a része, amelyet ez az alrendszer olvas és ír.
 * A mezőnevek az elosztóval közös szerződés részei (pannonguardeloszto/src/lib/invitations.ts).
 */
type InvitationDocument = {
  _id: ObjectId;
  email: string;
  role: string;
  invitedBy: string;
  tokenHash?: string;
  expiresAt?: Date;
  openedAt?: Date;
  registeredAt?: Date;
  name?: string;
  totpEnabledAt?: Date;
  lastLoginAt?: Date;
  loginCount?: number;
  revokedAt?: Date;
  /** Az elosztóban kért hitelesítő-visszaállítás időpontja. */
  totpResetAt?: Date;
  /** Jelszó-visszaállító link (csak a hash-e tárolt), lejárata és fajtája. */
  resetTokenHash?: string;
  resetExpiresAt?: Date;
  resetKind?: "password" | "both";
  resetOpenedAt?: Date;
  resetUsedAt?: Date;
  /** Az eseménynapló (az elosztó jeleníti meg); mindkét rendszer ír bele. */
  events?: { at: Date; type: string; by: string; detail?: string }[];
};

const invitations = async () =>
  (await getInvitesDb()).collection<InvitationDocument>("invitations");

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type InvitationCheck =
  | { status: "valid"; id: ObjectId; email: string; invitedBy: string; expiresAt: Date }
  | { status: "invalid" | "expired" | "used" | "revoked" };

/** A regisztrációs link ellenőrzése. Érvényes linknél rögzíti a megnyitást. */
export async function checkInvitationToken(token: string): Promise<InvitationCheck> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return { status: "invalid" };
  const collection = await invitations();
  const doc = await collection.findOne({ tokenHash: hashToken(token), role: APP_ROLE });
  if (!doc) return { status: "invalid" };
  if (doc.revokedAt) return { status: "revoked" };
  if (doc.registeredAt) return { status: "used" };
  if (!doc.expiresAt || doc.expiresAt.getTime() <= Date.now()) return { status: "expired" };

  if (!doc.openedAt) {
    await collection.updateOne({ _id: doc._id }, { $set: { openedAt: new Date() } });
  }
  return {
    status: "valid",
    id: doc._id,
    email: doc.email,
    invitedBy: doc.invitedBy,
    expiresAt: doc.expiresAt,
  };
}

/**
 * Egyszer használható beváltás: csak akkor sikerül, ha a token még érvényes.
 * A token törlődik, így a link többé nem használható.
 */
export async function redeemInvitation(token: string, name: string) {
  return (await invitations()).findOneAndUpdate(
    {
      tokenHash: hashToken(token),
      role: APP_ROLE,
      registeredAt: { $exists: false },
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    { $set: { registeredAt: new Date(), name }, $unset: { tokenHash: "" } },
    { returnDocument: "after" },
  );
}

/** Ha a fiók létrehozása nem sikerült, a beváltást visszavonjuk (a token már nem állítható vissza). */
export async function undoRedeem(id: ObjectId) {
  await (await invitations()).updateOne({ _id: id }, { $unset: { registeredAt: "", name: "" } });
}

export async function markTotpEnabled(id: ObjectId) {
  await (await invitations()).updateOne({ _id: id }, { $set: { totpEnabledAt: new Date() } });
  await addEvent(id, "totp.enabled", "felhasználó");
}

export async function markLogin(id: ObjectId) {
  await (await invitations()).updateOne(
    { _id: id },
    { $set: { lastLoginAt: new Date() }, $inc: { loginCount: 1 } },
  );
}

/**
 * A hozzáférés állapota az elosztó szerint. A visszavonás azonnal érvényes,
 * a hitelesítő-visszaállítás pedig a következő belépéskor új beállítást kér.
 */
export async function getAccessState(id: ObjectId) {
  const doc = await (await invitations()).findOne(
    { _id: id },
    { projection: { revokedAt: 1, totpResetAt: 1 } },
  );
  return { revoked: !doc || Boolean(doc.revokedAt), totpResetAt: doc?.totpResetAt };
}

/** Igaz, ha a felhasználó hitelesítőjét az adminisztrátor a beállítása után visszaállította. */
export function needsTotpReset(totpResetAt?: Date, totpEnabledAt?: Date) {
  return Boolean(totpResetAt && (!totpEnabledAt || totpResetAt > totpEnabledAt));
}

/* ---------- Jelszó-visszaállítás (az elosztóból küldött link) ---------- */

/** Esemény a közös naplóba (legfeljebb az utolsó 60 marad). A naplózás hibája nem akaszthat meg semmit. */
export async function addEvent(id: ObjectId, type: string, by: string, detail?: string) {
  try {
    await (await invitations()).updateOne(
      { _id: id },
      { $push: { events: { $each: [{ at: new Date(), type, by, ...(detail && { detail }) }], $slice: -60 } } },
    );
  } catch (error) {
    console.error("Eseménynapló hiba:", (error as Error).name);
  }
}

export type ResetCheck =
  | { status: "valid"; id: ObjectId; email: string; kind: "password" | "both"; expiresAt: Date }
  | { status: "invalid" | "expired" | "revoked" };

/** A jelszó-visszaállító link ellenőrzése. Érvényes linknél rögzíti az első megnyitást. */
export async function checkResetToken(token: string): Promise<ResetCheck> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return { status: "invalid" };
  const collection = await invitations();
  const doc = await collection.findOne({ resetTokenHash: hashToken(token), role: APP_ROLE });
  if (!doc || !doc.registeredAt) return { status: "invalid" };
  if (doc.revokedAt) return { status: "revoked" };
  if (!doc.resetExpiresAt || doc.resetExpiresAt.getTime() <= Date.now()) return { status: "expired" };
  if (!doc.resetOpenedAt) {
    await collection.updateOne({ _id: doc._id }, { $set: { resetOpenedAt: new Date() } });
    await addEvent(doc._id, "reset.opened", doc.email);
  }
  return { status: "valid", id: doc._id, email: doc.email, kind: doc.resetKind ?? "password", expiresAt: doc.resetExpiresAt };
}

/** Egyszer használható beváltás: a token a használattal törlődik. */
export async function redeemResetToken(token: string) {
  return (await invitations()).findOneAndUpdate(
    {
      resetTokenHash: hashToken(token),
      role: APP_ROLE,
      registeredAt: { $exists: true },
      revokedAt: { $exists: false },
      resetExpiresAt: { $gt: new Date() },
    },
    { $set: { resetUsedAt: new Date() }, $unset: { resetTokenHash: "", resetExpiresAt: "" } },
    { returnDocument: "after" },
  );
}

/** A hitelesítő visszaállítása (ugyanaz a jelzés, mint az elosztó gombja): a következő belépéskor új kulcs kell. */
export async function requestTotpResetFor(id: ObjectId) {
  await (await invitations()).updateOne({ _id: id }, { $set: { totpResetAt: new Date() }, $unset: { totpEnabledAt: "" } });
}
