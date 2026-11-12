import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("A TOTP_ENCRYPTION_KEY hiányzik vagy hibás (npm run setup:secrets).");
  }
  return Buffer.from(hex, "hex");
}

/** AES-256-GCM, formátum: v1:iv:tag:adat (base64url). */
export function seal(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((part) =>
    typeof part === "string" ? part : part.toString("base64url"),
  ).join(":");
}

export function open(sealed: string) {
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== "v1") throw new Error("Ismeretlen titkosítási formátum.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
