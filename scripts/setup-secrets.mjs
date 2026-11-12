// Új TOTP_ENCRYPTION_KEY-t ír a .env.local fájlba, ha még nincs.
// Figyelem: meglévő kulcs cseréje után a már beállított hitelesítők nem működnek.
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV_FILE = ".env.local";
const env = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";

if (/^TOTP_ENCRYPTION_KEY=[0-9a-f]{64}$/m.test(env)) {
  console.log("A TOTP_ENCRYPTION_KEY már be van állítva, nem módosítom.");
  process.exit(0);
}

const kept = env
  .split("\n")
  .filter((line) => !line.startsWith("TOTP_ENCRYPTION_KEY="))
  .join("\n")
  .trimEnd();
writeFileSync(ENV_FILE, `${kept}\nTOTP_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}\n`);
chmodSync(ENV_FILE, 0o600);
console.log("Kész. Indítsd újra a szervert.");
