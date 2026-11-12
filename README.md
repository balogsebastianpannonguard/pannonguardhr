# PannonGuard HR

Meghívásos, kétlépcsős azonosítással védett alrendszer a HR munkakörhöz, a PannonGuard Komplex része.

## Működés

- **Meghívás:** az Elosztóban (pannonguard-iranyitokozpont) a `HR` munkakörre küldött meghívó regisztrációs linkje ide mutat (`/regisztracio?token=…`).
- **Regisztráció:** név és jelszó, majd hitelesítő alkalmazás (TOTP) beállítása. A link egyszer használható, 7 napig érvényes.
- **Belépés:** jelszó + hatjegyű kód. Az Elosztóban visszavont hozzáférés azonnal érvényes, a hitelesítő és a jelszó onnan visszaállítható.
- **Áttekintés:** névre szóló üdvözlés, a fiók biztonsági állapota és a hamarosan érkező HR-területek.

## Környezeti változók

| Változó | Leírás |
| --- | --- |
| `MONGODB_URI` | MongoDB kapcsolat (közös fürt) |
| `MONGODB_DB` | A HR saját adatbázisa (`pannonguard_hr`) |
| `INVITES_DB` | Az Elosztó adatbázisa (`pannonguard_eloszto`) |
| `TOTP_ENCRYPTION_KEY` | 64 hex karakter; `npm run setup:secrets` generálja |

## Fejlesztés

```bash
npm install
npm run setup:secrets
npm run dev   # http://localhost:3004
```
