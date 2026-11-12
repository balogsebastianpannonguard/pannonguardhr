# Biztonság – PannonGuard HR

- **Hozzáférés:** csak az Elosztóból küldött, `HR` munkakörű, érvényes és vissza nem vont meghívóval lehet fiókot nyitni; a beváltás egyszeri.
- **Hitelesítés:** scrypt jelszó-hash, TOTP második faktor (AES-256-GCM-mel titkosított kulccsal), egyszer használható kódok.
- **Munkamenet:** 12 órás élettartam, 60 perc tétlenség után lejár; élesben `__Host-` süti; 8 hibás próbálkozás után zárolás.
- **Visszavonás:** az Elosztóban visszavont hozzáférést minden kérés ellenőrzi.
- **Naplózás:** regisztráció, belépés, hibás kód, zárolás és kijelentkezés IP-vel és eszközzel.
- **Webes védelem:** CSP, HSTS, clickjacking- és MIME-védelem, noindex.

Teendő élesítés előtt: a HR-adatok (munkavállalók, iratok) bevezetésekor rögzíteni az adatkezelési célt és a megőrzési időt (GDPR 30. cikk).
