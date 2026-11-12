# PannonGuard HR

Meghívásos, kétlépcsős azonosítással védett alrendszer a HR munkakörhöz, a PannonGuard Komplex része.

## Működés

- **Meghívás / belépés:** az Elosztó `HR` munkakörű meghívója ide mutat (`/regisztracio?token=…`); jelszó + hitelesítő (TOTP).
- **Munkavállalók** (`/munkavallalok`): törzsadatok, munkaviszony, végzettségek, képesítések, jogosultságok, orvosi alkalmasság és vagyonőri igazolvány; a bér és a személyes azonosítók titkosítva (`DATA_ENCRYPTION_KEY`), megtekintésük naplózott. CSV import (magyar Excel) és export, GDPR szerinti végleges törlés minden kapcsolódó rekorddal.
- **Lejáratok** (`/lejaratok`): orvosi, igazolvány, képesítés, határozott szerződés, próbaidő és képzési tanúsítvány egy listában.
- **Távollétek** (`/tavollet`): naptár, szabadságkeret, munkanapszámítás magyar ünnepnapokkal.
- **Belépés és kilépés** (`/be-kilepes`): szerkeszthető ellenőrzőlisták, felelősök, határidők.
- **HR-dokumentumok** (`/dokumentumok`): munkaszerződés, módosítás, Mt. 46. § tájékoztató, megszüntetések, munkáltatói igazolás, figyelmeztetés sablonból, a dolgozó adataival kitöltve, A4 nyomtatás; a sablonok szerkeszthetők.
- **Toborzás** (`/toborzas`): álláshelyek, AI-álláshirdetés, önéletrajz-feldolgozás (PDF/kép/szöveg), kiválasztási folyamat, interjú, pontozás, összehasonlítás, felvétel egy kattintással.
- **Képzések** (`/kepzesek`): résztvevők, vizsgák, tanúsítványok lejárata, jelenléti ív, kilépők és tanulmányi szerződések.
- **Kimutatások** (`/kimutatasok`): létszám, belépők/kilépők, fluktuáció, távollét, képzés; nyomtatható vezetői riport AI-összefoglalóval (csak összesített számokból).
- **Jog és szabályzat** (`/jog`): munkajogi kérdések, szabályzat-ellenőrzés, dokumentum-összehasonlítás.
- **Kommunikáció** (`/kommunikacio`): e-mail, tájékoztató, közlemény, munkaköri leírás vázlatai.
- **Pajzsi:** lebegő HR-asszisztens (Ctrl/⌘+K) és hibabejelentés.

## Környezeti változók

| Változó | Leírás |
| --- | --- |
| `MONGODB_URI` | MongoDB kapcsolat (közös fürt) |
| `MONGODB_DB` | A HR saját adatbázisa (`pannonguard_hr`) |
| `INVITES_DB` | Az Elosztó adatbázisa (`pannonguard_eloszto`) |
| `TOTP_ENCRYPTION_KEY` | 64 hex karakter; `npm run setup:secrets` generálja |
| `DATA_ENCRYPTION_KEY` | 64 hex karakter; a bizalmas munkavállalói adatok és dokumentumok titkosítása (cseréje után a régi adatok nem olvashatók!) |
| `GEMINI_API_KEY` | Pajzsi csevegése (Google Gemini) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_USER`, `EMAIL_PASS` | A bejelentések e-mail-értesítője |
| `TICKET_TO` | (opcionális) a bejelentéseket fogadó cím |

## Fejlesztés

```bash
npm install
npm run setup:secrets
npm run dev   # http://localhost:3004
```
