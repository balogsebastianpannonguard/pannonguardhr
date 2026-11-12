# PannonGuard HR

Meghívásos, kétlépcsős azonosítással védett alrendszer a HR munkakörhöz, a PannonGuard Komplex része.

## Működés

- **Meghívás:** az Elosztóban (pannonguard-iranyitokozpont) a `HR` munkakörre küldött meghívó regisztrációs linkje ide mutat (`/regisztracio?token=…`).
- **Regisztráció:** név és jelszó, majd hitelesítő alkalmazás (TOTP) beállítása. A link egyszer használható, 7 napig érvényes.
- **Belépés:** jelszó + hatjegyű kód. Az Elosztóban visszavont hozzáférés azonnal érvényes, a hitelesítő és a jelszó onnan visszaállítható.
- **Áttekintés:** névre szóló üdvözlés, a fiók biztonsági állapota és a hamarosan érkező HR-területek.
- **Pajzsi:** lebegő HR-asszisztens (jobb alsó sarok, Ctrl/⌘+K). Gemini-alapú csevegés munkajogról, levélvázlatokról, felvételről (óránként 40 kérdés), és **Bejelentés**: hibajegy vagy kérés e-mailben a fejlesztőnek (`HR-HB-…` / `HR-KE-…`).
- **Megjelenés:** rosegold–pink–PannonGuard kékes-fekete; az Elosztó HR-levelei is ezt a színvilágot kapják.

## Környezeti változók

| Változó | Leírás |
| --- | --- |
| `MONGODB_URI` | MongoDB kapcsolat (közös fürt) |
| `MONGODB_DB` | A HR saját adatbázisa (`pannonguard_hr`) |
| `INVITES_DB` | Az Elosztó adatbázisa (`pannonguard_eloszto`) |
| `TOTP_ENCRYPTION_KEY` | 64 hex karakter; `npm run setup:secrets` generálja |
| `GEMINI_API_KEY` | Pajzsi csevegése (Google Gemini) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_USER`, `EMAIL_PASS` | A bejelentések e-mail-értesítője |
| `TICKET_TO` | (opcionális) a bejelentéseket fogadó cím |

## Fejlesztés

```bash
npm install
npm run setup:secrets
npm run dev   # http://localhost:3004
```
