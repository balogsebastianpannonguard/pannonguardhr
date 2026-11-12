import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// RFC 6238 TOTP: 30 másodperces lépés, 6 számjegy, HMAC-SHA1 – ezt minden hitelesítő alkalmazás ismeri.
const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const TOTP_ISSUER = "PannonGuard";

function base32Encode(buffer: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(text: string) {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Érvénytelen base32 karakter.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

function codeAt(secret: Buffer, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Ellenőrzi a kódot ±1 lépés óraeltéréssel. A sikeres lépés számát adja vissza,
 * amit el kell menteni, hogy ugyanaz a kód ne legyen kétszer felhasználható.
 */
export function verifyTotp(secretBase32: string, code: string, lastUsedStep = -1) {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const secret = base32Decode(secretBase32);
  const current = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (const step of [current - 1, current, current + 1]) {
    if (step <= lastUsedStep) continue;
    if (timingSafeEqual(Buffer.from(codeAt(secret, step)), Buffer.from(clean))) return step;
  }
  return null;
}

export function otpauthUrl(email: string, secretBase32: string) {
  const label = encodeURIComponent(`${TOTP_ISSUER} HR:${email}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer: TOTP_ISSUER,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
}

/** Négyes csoportokba tördelt kulcs a kézi beíráshoz. */
export function formatSecret(secretBase32: string) {
  return secretBase32.match(/.{1,4}/g)?.join(" ") ?? secretBase32;
}
