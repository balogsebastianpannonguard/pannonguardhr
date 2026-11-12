import "server-only";
import { getDb } from "@/lib/mongodb";

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

const throttle = async () =>
  (await getDb()).collection<{ _id: string; count: number; expiresAt: Date }>("login_throttle");

/** Visszaadja, hogy a mostani próbálkozás még belefér-e a keretbe. */
export async function registerAttempt(key: string) {
  const result = await (await throttle()).findOneAndUpdate(
    { _id: key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + WINDOW_MS) } },
    { upsert: true, returnDocument: "after" },
  );
  return (result?.count ?? 0) <= MAX_ATTEMPTS;
}

export async function clearAttempts(key: string) {
  await (await throttle()).deleteOne({ _id: key });
}
