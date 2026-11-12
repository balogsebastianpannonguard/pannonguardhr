import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const PARAMS = { N: 2 ** 16, r: 8, p: 1 };
const MAXMEM = 256 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 12;

function deriveKey(password: string, salt: Buffer, length: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, length, { ...options, maxmem: MAXMEM }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

/** Formátum: scrypt:N:r:p:salt:hash (ugyanaz, mint az adminban). */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, 32, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("hex"), key.toString("hex")].join(":");
}

// Nem létező felhasználónál is lefut egy hash, hogy a válaszidő ne árulja el, létezik-e a fiók.
const DUMMY_HASH = `scrypt:${PARAMS.N}:${PARAMS.r}:${PARAMS.p}:${"00".repeat(16)}:${"00".repeat(32)}`;

export async function verifyPassword(password: string, stored: string | undefined) {
  const [scheme, N, r, p, salt, hash] = (stored ?? DUMMY_HASH).split(":");
  if (scheme !== "scrypt" || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = await deriveKey(password, Buffer.from(salt, "hex"), expected.length, {
    N: +N,
    r: +r,
    p: +p,
  });
  return timingSafeEqual(actual, expected) && stored !== undefined;
}

export function passwordProblem(password: string, email: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A jelszó legalább ${PASSWORD_MIN_LENGTH} karakter legyen.`;
  }
  if (password.length > 128) return "A jelszó legfeljebb 128 karakter lehet.";
  const local = email.split("@")[0].toLowerCase();
  if (local.length >= 4 && password.toLowerCase().includes(local)) {
    return "A jelszó ne tartalmazza az e-mail-címedet.";
  }
  if (new Set(password).size < 6) return "A jelszó legyen változatosabb.";
  return null;
}
