/**
 * Az AppSheet-ből exportált munkatársi nyilvántartás oszlopai – betűre pontosan az export fejlécével
 * (az elírásokat is megtartva, pl. „végzetség”, „alkamassági”), mert az import és a visszaexport ehhez igazodik.
 * Kliens- és szerveroldalon is használható.
 *
 * `secret`: az érték csak titkosítva kerül az adatbázisba, és csak naplózott megjelenítéssel látható.
 */

export type AppsheetGroup = "munkaviszony" | "szemelyes" | "azonosito" | "lakcim" | "elerhetoseg" | "kepesites" | "gyermek" | "dokumentum" | "appsheet";

export const APPSHEET_GROUPS: Record<AppsheetGroup, string> = {
  munkaviszony: "Munkaviszony",
  szemelyes: "Személyes adatok",
  azonosito: "Azonosítók és bankszámla",
  lakcim: "Lakcím",
  elerhetoseg: "Elérhetőség",
  kepesites: "Végzettség, vagyonőri igazolvány, alkalmasság",
  gyermek: "Gyermekek (családi kedvezmény)",
  dokumentum: "Dokumentumok és megjegyzés",
  appsheet: "AppSheet-nyilvántartási adatok",
};

export type AppsheetColumn = { id: string; header: string; group: AppsheetGroup; secret?: boolean; date?: boolean; multiline?: boolean };

const child = (n: 1 | 2 | 3 | 4): AppsheetColumn[] => [
  { id: `gyerek${n}Nev`, header: `${n} Gyerek neve`, group: "gyermek", secret: true },
  { id: `gyerek${n}Ado`, header: `${n} Gyerek Adoszáma`, group: "gyermek", secret: true },
  { id: `gyerek${n}Szul`, header: `${n} Gyerek Szül. idő`, group: "gyermek", secret: true, date: true },
];

/** Az export oszlopai az eredeti sorrendben. */
export const APPSHEET_COLUMNS: AppsheetColumn[] = [
  { id: "ceg", header: "Cég", group: "munkaviszony" },
  { id: "belepes", header: "Belépés ideje", group: "munkaviszony", date: true },
  { id: "vezeteknev", header: "Vezetéknév", group: "szemelyes" },
  { id: "keresztnev", header: "Keresztnév", group: "szemelyes" },
  { id: "szuletesiNev", header: "Születési név", group: "szemelyes", secret: true },
  { id: "szuletesiHely", header: "Születési hely", group: "szemelyes", secret: true },
  { id: "szuletesiIdo", header: "Születési idő", group: "szemelyes", secret: true, date: true },
  { id: "anyjaNeve", header: "Anyja neve", group: "szemelyes", secret: true },
  { id: "neme", header: "Neme", group: "szemelyes" },
  { id: "taj", header: "TAJ szám", group: "azonosito", secret: true },
  { id: "adoazonosito", header: "adóazonosító", group: "azonosito", secret: true },
  { id: "szigSzam", header: "személyi igazolvány szám", group: "azonosito", secret: true },
  { id: "szigErvenyesseg", header: "szig. Érvényesség", group: "azonosito", date: true },
  { id: "szemelyiSzam", header: "személyi szám", group: "azonosito", secret: true },
  { id: "lakohely", header: "lakóhely", group: "lakcim", secret: true },
  { id: "tartozkodasiHely", header: "tartózkodási hely", group: "lakcim", secret: true },
  { id: "vagyonorIgazolvany", header: "vagyonőri igazolvány", group: "kepesites" },
  { id: "tanusitvanySzam", header: "tanúsítvány/bizonyítvány szám", group: "kepesites" },
  { id: "tanusitvanyErvenyesseg", header: "tan/biz érvényesség", group: "kepesites", date: true },
  { id: "email", header: "e-mail", group: "elerhetoseg" },
  { id: "telefon", header: "telefon", group: "elerhetoseg" },
  { id: "munkaJellege", header: "Munka jellege", group: "munkaviszony" },
  { id: "feor", header: "FEOR Szám", group: "munkaviszony" },
  { id: "munkakor", header: "Munkakör", group: "munkaviszony" },
  { id: "szervezetiEgyseg", header: "Szervezeti egység", group: "munkaviszony" },
  { id: "szamlaszam", header: "Számlaszám", group: "azonosito", secret: true },
  { id: "vegzettseg", header: "Legmagasabb iskolai végzetség", group: "kepesites" },
  { id: "orvosi", header: "Orvosi alkamassági érvényessége", group: "kepesites", date: true },
  { id: "kilepesDatuma", header: "Kilépés Dátuma", group: "munkaviszony", date: true },
  { id: "megszunes", header: "Munkaviszony megszünése", group: "munkaviszony" },
  { id: "megjegyzes", header: "Megjegyzés", group: "dokumentum", multiline: true },
  { id: "hianyzoDokumentumok", header: "Hiányzó dokumentumok", group: "dokumentum" },
  ...child(1),
  ...child(2),
  ...child(3),
  ...child(4),
  { id: "updatedBy", header: "Updated By", group: "appsheet" },
  { id: "lastUpdated", header: "Last Updated", group: "appsheet" },
  { id: "history", header: "History", group: "appsheet" },
  { id: "fullName", header: "Full Name", group: "appsheet" },
];

export const APPSHEET_BY_HEADER = new Map(APPSHEET_COLUMNS.map((column) => [column.header, column]));
export const APPSHEET_BY_ID = new Map(APPSHEET_COLUMNS.map((column) => [column.id, column]));

/** A felületre kerülő (nem bizalmas) AppSheet-adatok egy munkatársnál. */
export type AppsheetView = {
  key: string;
  /** A sor helye a legutóbbi betöltött fájlban (1 = első adatsor). */
  row: number;
  plain: Record<string, string>;
  hasSecret: boolean;
  issues: string[];
  importedAt: Date;
  file: string;
  /** Igaz, ha a legutóbbi betöltött fájlban már nem szerepelt. */
  missing?: boolean;
};
