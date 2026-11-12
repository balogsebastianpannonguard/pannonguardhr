import "server-only";
import { ObjectId, type Filter } from "mongodb";
import type { Signature, TemplateField } from "@/components/hrdoc-paper";
import { longDay } from "@/components/hrdoc-paper";
import { openData } from "@/lib/data-box";
import { dayKey } from "@/lib/dates";
import { EXIT_REASONS, readSecret, type EmployeeDocument } from "@/lib/employees";
import { getDb } from "@/lib/mongodb";

/* ---------- Munkáltató ---------- */

/** A cégjegyzékszám és az adószám itt adható meg; üresen a dokumentumban kitöltendő helyként jelenik meg. */
export const EMPLOYER = {
  name: "PannonGuard Biztonsági Szolgáltató Zrt.",
  seat: "4026 Debrecen, Hatvan utca 39. II/3.",
  registry: "",
  taxNumber: "",
  city: "Debrecen",
};

/* ---------- Helyőrzők ---------- */

/** A nyilvántartásból automatikusan kitöltött helyőrzők és megnevezésük (a hiányzó adat jelöléséhez is). */
export const STANDARD_FIELDS: { key: string; label: string; secret?: boolean }[] = [
  { key: "nev", label: "Név" },
  { key: "szuletesi_nev", label: "Születési név", secret: true },
  { key: "szuletesi_hely_ido", label: "Születési hely, idő", secret: true },
  { key: "anyja_neve", label: "Anyja neve", secret: true },
  { key: "lakcim", label: "Lakcím", secret: true },
  { key: "adoazonosito", label: "Adóazonosító jel", secret: true },
  { key: "taj", label: "TAJ-szám", secret: true },
  { key: "bankszamla", label: "Bankszámlaszám", secret: true },
  { key: "munkakor", label: "Munkakör" },
  { key: "munkavegzes_helye", label: "Munkavégzés helye" },
  { key: "alapber", label: "Alapbér", secret: true },
  { key: "belepes", label: "Munkaviszony kezdete" },
  { key: "hatarozott_vege", label: "Határozott idő vége" },
  { key: "proba_vege", label: "Próbaidő vége" },
  { key: "heti_oraszam", label: "Heti óraszám" },
  { key: "napi_oraszam", label: "Napi óraszám" },
  { key: "kilepes", label: "Kilépés napja" },
  { key: "kilepes_oka", label: "Kilépés oka" },
  { key: "datum", label: "Kelt (dátum)" },
  { key: "kelt_hely", label: "Kelt (hely)" },
  { key: "munkaltato", label: "Munkáltató" },
  { key: "munkaltato_szekhely", label: "Munkáltató székhelye" },
  { key: "cegjegyzekszam", label: "Cégjegyzékszám" },
  { key: "munkaltato_adoszam", label: "Munkáltató adószáma" },
  { key: "munkaltato_kepviselo", label: "Munkáltató képviselője" },
];

const money = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });
const hours = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 });

/** A dolgozó adataiból (a bizalmas mezők visszafejtésével) előállított helyőrző-értékek. Csak szerveren! */
export function standardValues(employee: EmployeeDocument | null, today = dayKey(new Date())): Record<string, string> {
  const secret = employee ? readSecret(employee) : {};
  const birth = [secret.birthPlace, longDay(secret.birthDate)].filter(Boolean).join(", ");
  const salary =
    secret.salary !== undefined ? `${money.format(secret.salary)} Ft${secret.salaryType === "oraber" ? "/óra" : "/hó"}` : "";
  const weekly = employee?.weeklyHours;
  const values: Record<string, string | undefined> = {
    nev: employee?.name,
    szuletesi_nev: secret.birthName || employee?.name,
    szuletesi_hely_ido: birth,
    anyja_neve: secret.motherName,
    lakcim: secret.address,
    adoazonosito: secret.taxId,
    taj: secret.tajNumber,
    bankszamla: secret.bankAccount,
    munkakor: employee?.position,
    munkavegzes_helye: employee?.department,
    alapber: salary,
    belepes: longDay(employee?.startDate),
    hatarozott_vege: longDay(employee?.contractEnd),
    proba_vege: longDay(employee?.probationEnd),
    heti_oraszam: weekly ? hours.format(weekly) : undefined,
    napi_oraszam: weekly ? hours.format(weekly / 5) : undefined,
    kilepes: longDay(employee?.exitDate),
    kilepes_oka: employee?.exitReason ? EXIT_REASONS[employee.exitReason] : undefined,
    datum: longDay(today),
    kelt_hely: EMPLOYER.city,
    munkaltato: EMPLOYER.name,
    munkaltato_szekhely: EMPLOYER.seat,
    cegjegyzekszam: EMPLOYER.registry,
    munkaltato_adoszam: EMPLOYER.taxNumber,
    munkaltato_kepviselo: "",
  };
  return Object.fromEntries(STANDARD_FIELDS.map(({ key }) => [key, values[key] ?? ""]));
}

/* ---------- Beépített sablonok ---------- */

export type HrTemplate = {
  key: string;
  title: string;
  /** Rövid leírás a sablonválasztóhoz. */
  description: string;
  group: "szerzodes" | "tajekoztatas" | "megszuntetes";
  body: string;
  fields: TemplateField[];
  signatures: Signature[];
};

export const TEMPLATE_GROUPS = { szerzodes: "Szerződések", tajekoztatas: "Tájékoztatók, igazolások", megszuntetes: "Megszüntetés" } as const;

const PARTIES = `amely létrejött egyrészről a
{{munkaltato}} (székhely: {{munkaltato_szekhely}}, cégjegyzékszám: {{cegjegyzekszam}}, adószám: {{munkaltato_adoszam}}; képviseli: {{munkaltato_kepviselo}}) – a továbbiakban: Munkáltató –,

másrészről
név: {{nev}}
születési név: {{szuletesi_nev}}
születési hely, idő: {{szuletesi_hely_ido}}
anyja neve: {{anyja_neve}}
lakcím: {{lakcim}}
adóazonosító jel: {{adoazonosito}}
TAJ-szám: {{taj}}
– a továbbiakban: Munkavállaló – (együtt: Felek) között, alulírott helyen és napon, a munka törvénykönyvéről szóló 2012. évi I. törvény (a továbbiakban: Mt.) alapján, az alábbi feltételekkel.`;

const PARTIES_SHORT = `amely létrejött egyrészről a {{munkaltato}} (székhely: {{munkaltato_szekhely}}; képviseli: {{munkaltato_kepviselo}}) – a továbbiakban: Munkáltató –, másrészről {{nev}} (születési hely, idő: {{szuletesi_hely_ido}}; anyja neve: {{anyja_neve}}; lakcím: {{lakcim}}; adóazonosító jel: {{adoazonosito}}) – a továbbiakban: Munkavállaló – között, alulírott helyen és napon, az alábbiak szerint.`;

const ADDRESSEE = `Címzett: {{nev}}
lakcím: {{lakcim}}
munkakör: {{munkakor}}`;

const CLOSING = `Kelt: {{kelt_hely}}, {{datum}}`;

const CONTRACT_SIGNING = `A Felek a jelen szerződést – amely két eredeti példányban készült, és amelyből egy példányt a Munkavállaló átvett – elolvasás és közös értelmezés után, mint akaratukkal mindenben egyezőt, jóváhagyólag írták alá.`;

const SETTLEMENT = `## Elszámolás
A Munkavállaló a munkaviszony megszűnésekor köteles munkakörét az előírt rendben átadni, a nála lévő munkáltatói eszközöket (egyenruha, rádió, belépőkártya, kulcsok és egyéb felszerelés) visszaszolgáltatni, és a Munkáltatóval elszámolni (Mt. 80. § (1)). A Munkáltató a munkabért és egyéb járandóságokat legkésőbb a munkaviszony megszűnését követő ötödik munkanapon kifizeti, és kiadja a munkaviszony megszűnésével kapcsolatos igazolásokat (Mt. 80. § (2)).`;

const REMEDY = `## Jogorvoslat
A jognyilatkozat ellen a Munkavállaló a közlésétől számított harminc napon belül keresetlevéllel munkaügyi pert indíthat (Mt. 287. § (1)) az illetékes törvényszéknél.`;

function contractBody(fixed: boolean) {
  return `# MUNKASZERZŐDÉS
${fixed ? "határozott időtartamra" : "határozatlan időtartamra"}

${PARTIES}

## 1. A munkaviszony kezdete és időtartama
${
  fixed
    ? "1.1. A Felek a munkaviszonyt határozott időre, {{belepes}} napjától {{hatarozott_vege}} napjáig létesítik. A határozott idő indoka: {{hatarozott_indok}}. A határozott idejű munkaviszony tartama – a meghosszabbítást is ideértve – az öt évet nem haladhatja meg (Mt. 192. §)."
    : "1.1. A Felek a munkaviszonyt határozatlan időre létesítik. A munkaviszony kezdete (a munkába lépés napja): {{belepes}}."
}
1.2. A Felek próbaidőt kötnek ki, amelynek utolsó napja: {{proba_vege}}. A próbaidő alatt a munkaviszonyt bármelyik fél azonnali hatállyal, indokolás nélkül megszüntetheti (Mt. 45. § (5), 79. §).

## 2. Munkakör és munkavégzés helye
2.1. A Munkavállaló munkaköre: {{munkakor}}. A munkakörbe tartozó feladatokat a munkaköri leírás tartalmazza, amelyet a Munkáltató a munkába lépéskor átad.
2.2. A munkavégzés helye: {{munkavegzes_helye}}. A vagyonvédelmi tevékenység jellegéből adódóan a munkavégzés helye a Munkáltató által őrzött objektumok szerint változhat; erről a Munkáltató a munkaidő-beosztással együtt tájékoztatja a Munkavállalót.

## 3. Munkabér
3.1. A Munkavállaló személyi alapbére: bruttó {{alapber}}.
3.2. A munkabért a Munkáltató havonta utólag, {{berfizetes}} fizeti ki a Munkavállaló {{bankszamla}} számú bankszámlájára.
3.3. A Munkavállalót az Mt. szerinti bérpótlékok (műszakpótlék, éjszakai pótlék, rendkívüli munkaidő és munkaszüneti nap pótléka) illetik meg.

## 4. Munkaidő
4.1. A Munkavállaló heti munkaideje {{heti_oraszam}} óra, napi munkaideje {{napi_oraszam}} óra. Munkarend: {{munkarend}}.
4.2. A munkaidő-beosztást a Munkáltató legalább hét nappal korábban, legalább egy hétre írásban közli (Mt. 97. § (5)).

## 5. Szabadság, felmondási idő
5.1. A Munkavállalót az Mt. 116–120. §-a szerinti szabadság illeti meg.
5.2. A felmondási időre és a végkielégítésre az Mt. 69. és 77. §-a irányadó.${fixed ? " A határozott idejű munkaviszony munkáltatói felmondására az Mt. 66. § (8) bekezdése is irányadó." : ""}

## 6. Egyéb rendelkezések
6.1. A Munkavállaló kijelenti, hogy a személy- és vagyonvédelmi, valamint a magánnyomozói tevékenység szabályairól szóló 2005. évi CXXXIII. törvény szerinti feltételeknek megfelel, érvényes vagyonőri igazolvánnyal rendelkezik, és ezek bármely változását haladéktalanul bejelenti a Munkáltatónak.
6.2. A Munkavállaló köteles az őrzött objektumokkal, a Munkáltató és megbízói tevékenységével kapcsolatban tudomására jutott üzleti titkot és bizalmas információt megőrizni, a munkaviszony megszűnése után is.
6.3. A Munkáltató a munkába lépést követő hét napon belül írásban tájékoztatja a Munkavállalót az Mt. 46. §-a szerinti munkafeltételekről.
6.4. Egyéb megállapodás: {{egyeb_megallapodas}}
6.5. A jelen szerződésben nem szabályozott kérdésekben az Mt. rendelkezései és a Munkáltató hatályos belső szabályzatai az irányadók.

${CONTRACT_SIGNING}

${CLOSING}`;
}

const CONTRACT_FIELDS: TemplateField[] = [
  { key: "munkarend", label: "Munkarend", type: "text", default: "egyenlőtlen munkaidő-beosztás, munkaidőkeretben, beosztás szerint" },
  { key: "berfizetes", label: "Bérfizetés napja", type: "text", default: "a tárgyhónapot követő hónap 10. napjáig" },
  { key: "egyeb_megallapodas", label: "Egyéb megállapodás", type: "textarea", default: "A Felek egyéb megállapodást nem kötnek." },
  { key: "munkaltato_kepviselo", label: "Munkáltató képviselője", type: "text", hint: "Az aláíró neve és beosztása." },
];

export const BUILTIN_TEMPLATES: HrTemplate[] = [
  {
    key: "munkaszerzodes-hatarozatlan",
    title: "Munkaszerződés (határozatlan idejű)",
    description: "Teljes munkaszerződés vagyonőri munkakörre, próbaidővel, változó munkahellyel.",
    group: "szerzodes",
    body: contractBody(false),
    fields: CONTRACT_FIELDS,
    signatures: ["munkaltato", "munkavallalo"],
  },
  {
    key: "munkaszerzodes-hatarozott",
    title: "Munkaszerződés (határozott idejű)",
    description: "Határozott időtartamú munkaszerződés a lejárat és az indok rögzítésével (Mt. 192. §).",
    group: "szerzodes",
    body: contractBody(true),
    fields: [{ key: "hatarozott_indok", label: "A határozott idő indoka", type: "text", default: "a megbízó szerződésének időtartamához igazodó őrzési feladat" }, ...CONTRACT_FIELDS],
    signatures: ["munkaltato", "munkavallalo"],
  },
  {
    key: "szerzodesmodositas",
    title: "Munkaszerződés-módosítás",
    description: "Bér, munkakör, munkaidő vagy munkahely közös megegyezéses módosítása (Mt. 58. §).",
    group: "szerzodes",
    body: `# MUNKASZERZŐDÉS-MÓDOSÍTÁS

${PARTIES_SHORT}

1. A Felek között {{eredeti_kelte}} napján létrejött munkaszerződést (a továbbiakban: Munkaszerződés) az Mt. 58. §-a alapján közös megegyezéssel, {{hatalybalepes}} napjától kezdődő hatállyal az alábbiak szerint módosítják:

{{modositas_tartalma}}

2. A Munkaszerződés jelen módosítással nem érintett rendelkezései változatlanul hatályban maradnak.

3. A módosítás két eredeti példányban készült, amelyből egy példányt a Munkavállaló átvett. A Felek a módosítást elolvasás és közös értelmezés után, mint akaratukkal mindenben egyezőt, jóváhagyólag írták alá.

${CLOSING}`,
    fields: [
      { key: "eredeti_kelte", label: "Az eredeti munkaszerződés kelte", type: "date" },
      { key: "hatalybalepes", label: "Hatálybalépés napja", type: "date" },
      { key: "uj_alapber", label: "Új alapbér", type: "text", hint: "Pl. 420 000 Ft/hó" },
      { key: "uj_munkakor", label: "Munkakör a módosítás után", type: "text", default: "{{munkakor}}" },
      {
        key: "modositas_tartalma",
        label: "A módosítás tartalma",
        type: "textarea",
        default: "1.1. A Munkavállaló személyi alapbére: bruttó {{uj_alapber}}.\n1.2. A Munkavállaló munkaköre: {{uj_munkakor}}.",
        hint: "A nem változó pontot töröld; a {{…}} helyőrzők itt is működnek.",
      },
      { key: "munkaltato_kepviselo", label: "Munkáltató képviselője", type: "text" },
    ],
    signatures: ["munkaltato", "munkavallalo"],
  },
  {
    key: "tajekoztato-mt46",
    title: "Munkáltatói tájékoztató (Mt. 46. §)",
    description: "A munkafeltételekről szóló írásbeli tájékoztatás – a munkába lépéstől számított 7 napon belül.",
    group: "tajekoztatas",
    body: `# TÁJÉKOZTATÁS
a munkafeltételekről, az Mt. 46. §-a alapján

${ADDRESSEE}

Tisztelt {{nev}}!

A {{munkaltato}} (a továbbiakban: Munkáltató) a {{belepes}} napján kezdődő munkaviszonyára tekintettel az alábbiakról tájékoztatja.

## 1. Napi munkaidő és munkaidő-beosztás
{{napi_munkaido}} {{munkaido_beosztas}}

## 2. Munkabér és egyéb juttatások
Alapbérén túl a következő munkabér és juttatások illetik meg: {{juttatasok}}

## 3. A bérfizetés gyakorisága és napja
A munkabért a Munkáltató {{berfizetes}} fizeti ki, bankszámlára utalással.

## 4. A munkába lépés napja
{{belepes}}

## 5. Szabadság
{{szabadsag}}

## 6. Felmondási idő
{{felmondasi_ido}}

## 7. Kollektív szerződés
{{kollektiv}}

## 8. A munkáltatói jogkör gyakorlója
{{munkaltatoi_jogkor}}

## 9. Képzés
{{kepzes}}

## 10. Társadalombiztosítás
A Munkáltató a munkabérből a jogszabály szerinti járulékokat levonja, és azokat – a munkáltatót terhelő közterhekkel együtt – a Nemzeti Adó- és Vámhivatal részére bevallja és megfizeti.

A fentiek változásáról a Munkáltató legkésőbb a változás hatálybalépésének napján írásban tájékoztatja.

${CLOSING}`,
    fields: [
      { key: "napi_munkaido", label: "Napi munkaidő", type: "textarea", default: "Az Ön napi munkaideje {{napi_oraszam}} óra (heti {{heti_oraszam}} óra)." },
      {
        key: "munkaido_beosztas",
        label: "Munkaidő-beosztás szabályai",
        type: "textarea",
        default: "A Munkáltató a munkaidőt munkaidőkeretben, egyenlőtlenül osztja be; a beosztást legalább hét nappal korábban, legalább egy hétre írásban közli.",
      },
      {
        key: "juttatasok",
        label: "Alapbéren túli bér és juttatások",
        type: "textarea",
        default: "az Mt. szerinti bérpótlékok (műszakpótlék, éjszakai pótlék, rendkívüli munkaidő és munkaszüneti nap pótléka); egyéb juttatás: nincs.",
      },
      { key: "berfizetes", label: "Bérfizetés", type: "text", default: "havonta, a tárgyhónapot követő hónap 10. napjáig" },
      {
        key: "szabadsag",
        label: "Szabadság",
        type: "textarea",
        default:
          "Az Mt. 116–120. §-a szerint évi 20 munkanap alapszabadság, valamint az életkor, a gyermekek száma és egyéb körülmények szerinti pótszabadság illeti meg. A szabadságot a Munkáltató – az Ön előzetes meghallgatása után – adja ki; évente hét munkanapot az Ön kérésének megfelelő időpontban kell kiadni (Mt. 122. §).",
      },
      {
        key: "felmondasi_ido",
        label: "Felmondási idő szabályai",
        type: "textarea",
        default:
          "A felmondási idő 30 nap, amely munkáltatói felmondás esetén a Munkáltatónál töltött idő alapján meghosszabbodik (Mt. 69. §). A felmondási idő a felmondás közlését követő napon kezdődik.",
      },
      { key: "kollektiv", label: "Kollektív szerződés", type: "text", default: "A Munkáltatónál kollektív szerződés nincs hatályban." },
      { key: "munkaltatoi_jogkor", label: "Munkáltatói jogkör gyakorlója", type: "text", default: "a Munkáltató vezérigazgatója" },
      {
        key: "kepzes",
        label: "Képzés",
        type: "textarea",
        default: "A munkakör ellátásához szükséges kötelező képzéseket – így a munkavédelmi oktatást és a vagyonőri továbbképzést – a Munkáltató költségmentesen biztosítja.",
      },
    ],
    signatures: ["munkaltato", "atvetel"],
  },
  {
    key: "kozos-megegyezes",
    title: "Közös megegyezéses megszüntetés",
    description: "Megállapodás a munkaviszony megszüntetéséről (Mt. 64. § (1) a)), elszámolással.",
    group: "megszuntetes",
    body: `# MEGÁLLAPODÁS
a munkaviszony közös megegyezéssel történő megszüntetéséről

${PARTIES_SHORT}

1. A Felek rögzítik, hogy a Munkavállaló {{belepes}} óta áll a Munkáltató alkalmazásában, {{munkakor}} munkakörben.

2. A Felek a közöttük fennálló munkaviszonyt az Mt. 64. § (1) bekezdés a) pontja alapján közös megegyezéssel, {{megszunes_napja}} napjával megszüntetik.

3. {{munkavegzes_alol}}

4. {{juttatas}}

5. A Munkavállaló a munkaviszony megszűnésekor köteles munkakörét az előírt rendben átadni, a nála lévő munkáltatói eszközöket (egyenruha, rádió, belépőkártya, kulcsok és egyéb felszerelés) visszaszolgáltatni, és a Munkáltatóval elszámolni (Mt. 80. § (1)).

6. A Munkáltató a Munkavállaló munkabérét és egyéb járandóságait legkésőbb a munkaviszony megszűnését követő ötödik munkanapon kifizeti, és kiadja a munkaviszony megszűnésével kapcsolatos igazolásokat (Mt. 80. § (2)).

7. A megállapodás két eredeti példányban készült, amelyből egy példányt a Munkavállaló átvett. A Felek a megállapodást elolvasás és közös értelmezés után, mint akaratukkal mindenben egyezőt, jóváhagyólag írták alá.

${CLOSING}`,
    fields: [
      { key: "megszunes_napja", label: "A munkaviszony megszűnésének napja", type: "date" },
      {
        key: "munkavegzes_alol",
        label: "Munkavégzés a megszűnésig",
        type: "textarea",
        default: "A Munkavállaló a munkaviszony megszűnéséig a munkaidő-beosztás szerint munkát végez.",
        hint: "Pl.: „A Munkáltató a Munkavállalót … napjától a megszűnésig mentesíti a munkavégzés alól, erre az időre távolléti díj illeti meg.”",
      },
      {
        key: "juttatas",
        label: "Juttatás / végkielégítés",
        type: "textarea",
        default: "A Felek a munkaviszony megszüntetésével összefüggésben végkielégítésben és egyéb juttatásban nem állapodnak meg.",
      },
      { key: "munkaltato_kepviselo", label: "Munkáltató képviselője", type: "text" },
    ],
    signatures: ["munkaltato", "munkavallalo"],
  },
  {
    key: "munkaltatoi-felmondas",
    title: "Munkáltatói felmondás (indoklással)",
    description: "Rendes felmondás indoklással, felmondási idővel, felmentéssel és jogorvoslati tájékoztatással.",
    group: "megszuntetes",
    body: `# MUNKÁLTATÓI FELMONDÁS

${ADDRESSEE}

Tisztelt {{nev}}!

A {{munkaltato}} (a továbbiakban: Munkáltató) az Ön és a Munkáltató között {{belepes}} óta fennálló munkaviszonyt az Mt. 64. § (1) bekezdés b) pontja és 65. §-a alapján felmondással megszünteti.

## A felmondás indoka
{{indoklas}}

## Felmondási idő
A felmondási idő a felmondás közlését követő napon kezdődik (Mt. 68. § (1)), tartama {{felmondasi_ido}} nap. A munkaviszony a felmondási idő utolsó napján, {{megszunes_napja}} napján szűnik meg.

## Felmentés a munkavégzés alól
{{felmentes}}

## Végkielégítés
{{vegkielegites}}

${SETTLEMENT}

${REMEDY}

${CLOSING}`,
    fields: [
      {
        key: "indoklas",
        label: "A felmondás indoka",
        type: "textarea",
        hint: "Mt. 64. § (2), 66. § (2): világos, valós és okszerű indok a munkavállaló magatartásával, képességével vagy a munkáltató működésével összefüggésben. Vitás esetben a munkáltatónak kell bizonyítania.",
      },
      { key: "felmondasi_ido", label: "Felmondási idő (nap)", type: "number", default: "30", hint: "Mt. 69. §: 30 nap, a munkáltatónál töltött 3/5/8/10/15/18/20 év után +5/15/20/25/30/40/60 nap." },
      { key: "megszunes_napja", label: "A munkaviszony megszűnésének napja", type: "date" },
      {
        key: "felmentes",
        label: "Felmentés",
        type: "textarea",
        default:
          "A Munkáltató Önt a felmondási idő felére, … napra mentesíti a munkavégzési kötelezettség alól. A felmentés idejét – legfeljebb két részletben – az Ön kívánsága szerint kell kiadni; erre az időre távolléti díj illeti meg (Mt. 70. §).",
      },
      {
        key: "vegkielegites",
        label: "Végkielégítés",
        type: "textarea",
        default: "Ön az Mt. 77. §-a alapján … havi távolléti díjnak megfelelő összegű végkielégítésre jogosult.",
        hint: "Mt. 77. §: legalább 3 év munkaviszony után jár; nem jár, ha a felmondás indoka a munkavállaló magatartása vagy nem egészségi okkal összefüggő képessége.",
      },
      { key: "munkaltato_kepviselo", label: "Munkáltató képviselője", type: "text" },
    ],
    signatures: ["munkaltato", "atvetel"],
  },
  {
    key: "probaido-megszuntetes",
    title: "Próbaidő alatti megszüntetés",
    description: "Azonnali hatályú felmondás a próbaidő alatt, indokolás nélkül (Mt. 79. §).",
    group: "megszuntetes",
    body: `# AZONNALI HATÁLYÚ FELMONDÁS
a próbaidő alatt

${ADDRESSEE}

Tisztelt {{nev}}!

A {{munkaltato}} (a továbbiakban: Munkáltató) az Ön és a Munkáltató között {{belepes}} óta fennálló munkaviszonyt – a munkaszerződésben kikötött, {{proba_vege}} napjáig tartó próbaidő alatt – az Mt. 79. §-a alapján azonnali hatállyal, indokolás nélkül megszünteti.

A munkaviszony megszűnésének napja: {{megszunes_napja}}.

${SETTLEMENT}

${REMEDY}

${CLOSING}`,
    fields: [
      { key: "megszunes_napja", label: "A munkaviszony megszűnésének napja", type: "date", hint: "A közlés napja – a próbaidő utolsó napjánál nem lehet későbbi." },
      { key: "munkaltato_kepviselo", label: "Munkáltató képviselője", type: "text" },
    ],
    signatures: ["munkaltato", "atvetel"],
  },
  {
    key: "munkaltatoi-igazolas",
    title: "Munkáltatói igazolás (kilépéskor, Mt. 80. §)",
    description: "Igazolás a munkaviszony megszűnésekor: időtartam, megszűnés módja, szabadság, levonások.",
    group: "tajekoztatas",
    body: `# IGAZOLÁS
a munkaviszony megszűnéséről (Mt. 80. § (2))

A {{munkaltato}} (székhely: {{munkaltato_szekhely}}, adószám: {{munkaltato_adoszam}}) igazolja, hogy

név: {{nev}}
születési név: {{szuletesi_nev}}
születési hely, idő: {{szuletesi_hely_ido}}
anyja neve: {{anyja_neve}}
TAJ-szám: {{taj}}
adóazonosító jel: {{adoazonosito}}

a Munkáltatónál {{belepes}} napjától {{megszunes_napja}} napjáig munkaviszonyban állt, {{munkakor}} munkakörben.

## A munkaviszony megszűnésének módja
{{megszunes_modja}}

## Szabadság
A tárgyévben kiadott szabadság: {{kiadott_szabadsag}} munkanap. {{szabadsag_megjegyzes}}

## Letiltás, levonás, előleg
{{letiltasok}}

## Egyéb
{{egyeb}}

A Munkáltató a fentieken túl átadja a jövedelemről és a levont közterhekről szóló adó- és járulékigazolást, valamint – kérésre – az álláskeresési ellátás igényléséhez szükséges munkáltatói igazolást.

${CLOSING}`,
    fields: [
      { key: "megszunes_napja", label: "A munkaviszony utolsó napja", type: "date" },
      { key: "megszunes_modja", label: "A megszűnés módja", type: "text", default: "{{kilepes_oka}}" },
      { key: "kiadott_szabadsag", label: "A tárgyévben kiadott szabadság (nap)", type: "number" },
      { key: "szabadsag_megjegyzes", label: "Szabadság – megjegyzés", type: "text", default: "A ki nem adott szabadságot a Munkáltató pénzben megváltotta." },
      { key: "letiltasok", label: "Letiltások, levonások", type: "textarea", default: "A Munkavállaló munkabérét letiltás nem terheli, munkabérelőleg-tartozása nincs." },
      { key: "egyeb", label: "Egyéb közlendő", type: "textarea", default: "–" },
      { key: "munkaltato_kepviselo", label: "Munkáltató képviselője", type: "text" },
    ],
    signatures: ["munkaltato", "atvetel"],
  },
  {
    key: "figyelmeztetes",
    title: "Írásbeli figyelmeztetés",
    description: "Figyelmeztetés kötelezettségszegés miatt, a tényállás, az elvárás és a következmények rögzítésével.",
    group: "tajekoztatas",
    body: `# ÍRÁSBELI FIGYELMEZTETÉS

${ADDRESSEE}

Tisztelt {{nev}}!

A Munkáltató tudomására jutott, hogy Ön {{esemeny_datuma}} napján {{esemeny_leirasa}}

Ezzel megszegte a munkaviszonyból eredő alábbi kötelezettségét: {{megszegett_kotelezettseg}}

A Munkáltató felhívja, hogy a jövőben {{elvaras}}

Tájékoztatjuk, hogy a kötelezettségszegés megismétlődése vagy újabb kötelezettségszegés esetén a Munkáltató további munkajogi intézkedést tehet, amely – súlyos vagy ismételt esetben – a munkaviszony megszüntetéséig terjedhet.

A figyelmeztetéssel kapcsolatos észrevételeit az átvételtől számított nyolc napon belül írásban megteheti.

${CLOSING}`,
    fields: [
      { key: "esemeny_datuma", label: "Az esemény napja", type: "date" },
      { key: "esemeny_leirasa", label: "Mi történt?", type: "textarea", hint: "Tárgyszerűen: hely, időpont, mi történt – pl. „a … objektumban a szolgálatot 45 perc késéssel kezdte meg, előzetes jelzés nélkül.”" },
      {
        key: "megszegett_kotelezettseg",
        label: "Megszegett kötelezettség",
        type: "textarea",
        default: "a munkavégzés helyén a munkáltató által előírt időben, munkára képes állapotban megjelenni (Mt. 52. § (1) a) pont).",
      },
      { key: "elvaras", label: "Elvárás a jövőre", type: "textarea", default: "a munkaidő-beosztás szerinti időpontban kezdje meg a szolgálatot, és akadályoztatását előre jelezze." },
      { key: "munkaltato_kepviselo", label: "Munkáltató képviselője", type: "text" },
    ],
    signatures: ["munkaltato", "atvetel"],
  },
];

export const templateLabels = (template?: Pick<HrTemplate, "fields">) =>
  Object.fromEntries([...STANDARD_FIELDS.map((field) => [field.key, field.label]), ...(template?.fields ?? []).map((field) => [field.key, field.label])]);

/* ---------- Sablonok az adatbázisban ---------- */

export type TemplateOverride = { _id: string; kind: "document"; body: string; updatedAt: Date; updatedBy: string };

const overrideId = (key: string) => `doc:${key}`;
export const templateStore = async () => (await getDb()).collection<TemplateOverride>("hr_templates");

export async function listTemplates() {
  const overrides = await (await templateStore()).find({ kind: "document" }).toArray();
  const byId = new Map(overrides.map((doc) => [doc._id, doc]));
  return BUILTIN_TEMPLATES.map((template) => {
    const override = byId.get(overrideId(template.key));
    return { ...template, body: override?.body ?? template.body, custom: Boolean(override), updatedAt: override?.updatedAt, updatedBy: override?.updatedBy };
  });
}

export async function getTemplate(key: string) {
  const template = BUILTIN_TEMPLATES.find((item) => item.key === key);
  if (!template) return null;
  const override = await (await templateStore()).findOne({ _id: overrideId(key) });
  return { ...template, body: override?.body ?? template.body, custom: Boolean(override), updatedAt: override?.updatedAt, updatedBy: override?.updatedBy };
}

export async function saveTemplateBody(key: string, body: string, by: string) {
  await (await templateStore()).updateOne({ _id: overrideId(key) }, { $set: { kind: "document", body, updatedAt: new Date(), updatedBy: by } }, { upsert: true });
}

export async function resetTemplateBody(key: string) {
  await (await templateStore()).deleteOne({ _id: overrideId(key) });
}

/* ---------- Elkészült dokumentumok ---------- */

/** A titkosított tartalom: a (szerkesztett) sablonszöveg és a mezőértékek. */
export type HrDocumentContent = { body: string; values: Record<string, string> };

export type HrDocumentRecord = {
  _id: ObjectId;
  number: string;
  templateKey: string;
  /** A sablon megnevezése (személyes adatot nem tartalmaz). */
  title: string;
  employeeId: ObjectId;
  employeeName: string;
  /** sealData(HrDocumentContent) */
  sealed: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
};

export const hrDocuments = async () => (await getDb()).collection<HrDocumentRecord>("hr_documents");

let indexed = false;
async function ensureIndexes() {
  if (indexed) return;
  const collection = await hrDocuments();
  await Promise.all([collection.createIndex({ employeeId: 1, createdAt: -1 }), collection.createIndex({ number: 1 }, { unique: true })]);
  indexed = true;
}

export async function nextDocumentNumber(now = new Date()) {
  await ensureIndexes();
  const year = dayKey(now).slice(0, 4);
  const last = await (await hrDocuments()).find({ number: { $regex: `^HR-${year}/` } }, { projection: { number: 1 } }).sort({ number: -1 }).limit(1).next();
  const sequence = last ? Number(last.number.split("/")[1]) + 1 : 1;
  return `HR-${year}/${String(sequence).padStart(4, "0")}`;
}

export type HrDocumentListItem = { id: string; number: string; title: string; templateKey: string; employeeId: string; employeeName: string; createdAt: Date; createdBy: string; updatedAt: Date };

export async function listDocuments(employeeId?: ObjectId, limit = 200): Promise<HrDocumentListItem[]> {
  await ensureIndexes();
  const filter: Filter<HrDocumentRecord> = employeeId ? { employeeId } : {};
  const docs = await (await hrDocuments()).find(filter, { projection: { sealed: 0 } }).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map((doc) => ({
    id: String(doc._id),
    number: doc.number,
    title: doc.title,
    templateKey: doc.templateKey,
    employeeId: String(doc.employeeId),
    employeeName: doc.employeeName,
    createdAt: doc.createdAt,
    createdBy: doc.createdBy,
    updatedAt: doc.updatedAt,
  }));
}

export async function getDocument(id: ObjectId) {
  const doc = await (await hrDocuments()).findOne({ _id: id });
  if (!doc) return null;
  const content = openData<HrDocumentContent>(doc.sealed, { body: "", values: {} });
  return { ...doc, id: String(doc._id), employeeId: String(doc.employeeId), content };
}

/** Új dokumentum kezdőértékei: a nyilvántartás adatai és a sablon saját mezőinek alapértékei. */
export function initialValues(template: Pick<HrTemplate, "fields">, employee: EmployeeDocument) {
  const values = standardValues(employee);
  for (const field of template.fields) {
    if (field.default !== undefined) values[field.key] = field.default;
    else if (field.type === "date" && field.key === "megszunes_napja") values[field.key] = employee.exitDate ?? "";
    else values[field.key] ??= "";
  }
  return values;
}
