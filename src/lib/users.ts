import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export type UserDocument = {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  /** Titkosított TOTP-kulcs (secret-box). */
  totpSecret: string;
  totpEnabledAt?: Date;
  lastTotpStep?: number;
  invitationId: ObjectId;
  invitedBy: string;
  createdAt: Date;
  lastLoginAt?: Date;
};

export const users = async () => (await getDb()).collection<UserDocument>("users");

export async function findUserById(id: ObjectId) {
  return (await users()).findOne({ _id: id });
}

export async function findUserByEmail(email: string) {
  return (await users()).findOne({ email: email.toLowerCase() });
}

/** Elmenti a felhasznált TOTP-lépést; csak akkor sikerül, ha nagyobb az eddiginél (visszajátszás ellen). */
export async function consumeTotpStep(id: ObjectId, step: number, extra: Partial<UserDocument> = {}) {
  const result = await (await users()).updateOne(
    {
      _id: id,
      $or: [{ lastTotpStep: { $exists: false } }, { lastTotpStep: { $lt: step } }],
    },
    { $set: { lastTotpStep: step, ...extra } },
  );
  return result.modifiedCount === 1;
}
