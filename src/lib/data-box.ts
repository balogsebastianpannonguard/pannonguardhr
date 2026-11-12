import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * A különleges és bizalmas személyes adatok (bér, adóazonosító, TAJ, lakcím, születési adatok, bankszámla)
 * mezőszintű titkosítása AES-256-GCM-mel. A kulcs a DATA_ENCRYPTION_KEY (64 hex karakter), külön a TOTP-kulcstól.
 * Formátum: d1:iv:tag:adat (base64url).
 */
function key() {
  const hex = process.env.DATA_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) throw new Error("A DATA_ENCRYPTION_KEY hiányzik vagy hibás.");
  return Buffer.from(hex, "hex");
}

export function sealData<T>(value: T): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["d1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

export function openData<T>(sealed: string | undefined, fallback: T): T {
  if (!sealed) return fallback;
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== "d1") throw new Error("Ismeretlen titkosítási formátum.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")) as T;
}
