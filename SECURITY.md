# Biztonság – PannonGuard HR

- **Hozzáférés:** csak az Elosztóból küldött, `HR` munkakörű, érvényes és vissza nem vont meghívóval lehet fiókot nyitni; a beváltás egyszeri.
- **Hitelesítés:** scrypt jelszó-hash, TOTP második faktor (AES-256-GCM-mel titkosított kulccsal), egyszer használható kódok.
- **Munkamenet:** 12 órás élettartam, 60 perc tétlenség után lejár; élesben `__Host-` süti; 8 hibás próbálkozás után zárolás.
- **Visszavonás:** az Elosztóban visszavont hozzáférést minden kérés ellenőrzi.
- **Naplózás:** regisztráció, belépés, hibás kód, zárolás és kijelentkezés IP-vel és eszközzel.
- **Webes védelem:** CSP, HSTS, clickjacking- és MIME-védelem, noindex.

Teendő élesítés előtt: a HR-adatok (munkavállalók, iratok) bevezetésekor rögzíteni az adatkezelési célt és a megőrzési időt (GDPR 30. cikk).

## HR-adatok (2026-11)

- A bér, az azonosítók (adóazonosító, TAJ, bankszámla), a lakcím és a születési adatok mezőszinten titkosítva (AES-256-GCM, `DATA_ENCRYPTION_KEY`); a generált HR-dokumentumok, jogi elemzések és piszkozatok törzse szintén.
- Minden módosítás a `hr_log` naplóba kerül személyes adat nélkül; a bizalmas adatok megtekintése is naplózott.
- AI (Google Gemini): önéletrajz-feldolgozásnál és dokumentum-ellenőrzésnél a feltöltött szöveg a Gemini API-hoz kerül; a riportokhoz csak összesített számok mennek, a sablonos dokumentumok kitöltése AI nélkül, a szerveren történik. Az önéletrajz eredeti fájlja nem tárolódik.
- Teendő: az adatkezelési tájékoztatóban és a nyilvántartásban (GDPR 30. cikk) rögzíteni a Gemini adatfeldolgozót, a jelöltadatok megőrzési idejét (alapértelmezés: elutasítás után 180 nap) és a munkavállalói adatok megőrzési idejét.
