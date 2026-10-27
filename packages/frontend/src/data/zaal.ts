// Turns the query results of the sales room into the shapes the 3D modules read
// (the same shapes the original demo built from its fictitious data).
// Nothing is aggregated here: every number comes from a measure in the model;
// this file only renames columns and links rows into a tree.
import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';

import { KANALEN, type Kanaal } from './dax';
import type { Status } from './kerncijfers';
import { getal, leesRijen } from './tabel';

type Rij = (kolom: string) => unknown;
type Sleutel = Kanaal | 'alle';

const tekst = (v: unknown) => (v === null || v === undefined ? null : String(v));
const n = (v: unknown) => getal(v) ?? 0;
const status = (v: unknown): Status | null => (v === 'groen' || v === 'oranje' || v === 'rood' ? v : null);
const kanaalSleutel = (r: Rij, totaal: string): Sleutel | null => {
  if (r(totaal) === true) return 'alle';
  const k = tekst(r('dim_kanaal[kanaal]'));
  return k && (KANALEN as readonly string[]).includes(k) ? (k as Kanaal) : null;
};

// --- Wall cards: per channel the months and the YTD total ---------------------------------

export interface Maandcijfers {
  naam: string;
  omzet: number;
  omzetVorig: number;
  omzetForecast: number;
  kost: number;
  bruto: number;
  brutoVorig: number;
  brutoForecast: number;
  kosten: number;
  kostenVorig: number;
  kostenForecast: number;
  netto: number;
  nettoVorig: number;
  nettoForecast: number;
  omzetCumul: number;
  omzetVorigCumul: number;
  omzetForecastCumul: number;
}

export interface KanaalCijfers {
  naam: string;
  maanden: Maandcijfers[];
  totaal: Maandcijfers & { groei: number | null; status: Status | null };
}

function maandcijfers(r: Rij, naam: string): Maandcijfers {
  return {
    naam,
    omzet: n(r('[Omzet]')),
    omzetVorig: n(r('[Omzet VJ]')),
    omzetForecast: n(r('[Omzet FC]')),
    kost: n(r('[Kostprijs]')),
    bruto: n(r('[Bruto]')),
    brutoVorig: n(r('[Bruto VJ]')),
    brutoForecast: n(r('[Bruto FC]')),
    kosten: n(r('[Kosten]')),
    kostenVorig: n(r('[Kosten VJ]')),
    kostenForecast: n(r('[Kosten FC]')),
    netto: n(r('[Netto]')),
    nettoVorig: n(r('[Netto VJ]')),
    nettoForecast: n(r('[Netto FC]')),
    omzetCumul: n(r('[Omzet cumul]')),
    omzetVorigCumul: n(r('[Omzet VJ cumul]')),
    omzetForecastCumul: n(r('[Omzet FC cumul]')),
  };
}

export function leesKerncijfersMaand(tabel: QueryTable): Record<Sleutel, KanaalCijfers> {
  const uit = {} as Record<Sleutel, KanaalCijfers>;
  const maanden = new Map<Sleutel, Array<[number, Maandcijfers]>>();
  for (const r of leesRijen(tabel)) {
    const k = kanaalSleutel(r, '[is_totaal]');
    if (!k) continue;
    if (r('[is_jaar]') === true) {
      uit[k] = {
        naam: k === 'alle' ? 'Alle kanalen' : k,
        maanden: [],
        totaal: { ...maandcijfers(r, 'YTD'), groei: getal(r('[Groei]')), status: status(r('[Status]')) },
      };
    } else {
      const nr = n(r('dim_datum[maand_nr]'));
      if (!maanden.has(k)) maanden.set(k, []);
      maanden.get(k)!.push([nr, maandcijfers(r, tekst(r('dim_datum[maandnaam]')) ?? String(nr))]);
    }
  }
  for (const [k, lijst] of maanden) {
    if (uit[k]) uit[k].maanden = lijst.sort((a, b) => a[0] - b[0]).map(([, m]) => m);
  }
  return uit;
}

// --- The decomposition tree -----------------------------------------------------------------

export interface Knoop {
  naam: string;
  stuks: number;
  vorigJaar: number;
  groei: number | null;
  status: Status | null;
  niveau: number;
  pad: string;
  ouder: Knoop | null;
  kinderen: Knoop[];
  productId?: number;
}

const NIVEAUS = [
  ['[t_kanaal]', 'dim_kanaal[kanaal]'],
  ['[t_groep]', 'dim_product[productgroep]'],
  ['[t_sub]', 'dim_product[subgroep]'],
  ['[t_product]', 'dim_product[product]'],
] as const;

export function leesBoom(tabel: QueryTable): Knoop {
  const knopen = new Map<string, Knoop>();
  const rijen = leesRijen(tabel).map((r) => {
    // The depth of a row is the number of levels that are not rolled up
    const niveau = NIVEAUS.findIndex(([t]) => r(t) === true);
    const diepte = niveau === -1 ? NIVEAUS.length : niveau;
    const namen = NIVEAUS.slice(0, diepte).map(([, kolom]) => tekst(r(kolom)));
    return { r, diepte, namen };
  });
  for (const { r, diepte, namen } of rijen.sort((a, b) => a.diepte - b.diepte)) {
    // Blank members (no channel, no product) are not part of the tree
    if (namen.some((x) => x === null)) continue;
    const pad = namen.join('/');
    const ouder = diepte === 0 ? null : (knopen.get(namen.slice(0, -1).join('/')) ?? null);
    if (diepte > 0 && !ouder) continue;
    const knoop: Knoop = {
      naam: diepte === 0 ? 'Verkoop' : namen[diepte - 1]!,
      stuks: n(r('[Stuks]')),
      vorigJaar: n(r('[Stuks VJ]')),
      groei: getal(r('[Groei]')),
      status: status(r('[Status]')),
      niveau: diepte,
      pad,
      ouder,
      kinderen: [],
      ...(diepte === NIVEAUS.length ? { productId: n(r('dim_product[product_id]')) } : {}),
    };
    ouder?.kinderen.push(knoop);
    knopen.set(pad, knoop);
  }
  const wortel = knopen.get('');
  if (!wortel) throw new Error('De boom heeft geen totaalrij');
  (function sorteer(k: Knoop) {
    k.kinderen.sort((a, b) => b.stuks - a.stuks);
    k.kinderen.forEach(sorteer);
  })(wortel);
  return wortel;
}

// --- Stores ------------------------------------------------------------------------------------

export interface Filiaal {
  naam: string;
  lon: number;
  lat: number;
  centraal: boolean;
  lx: number;
  lz: number;
  stuks: number;
  vorig: number;
  omzet: number;
  omzetVorig: number;
  groei: number | null;
  status: Status | null;
  aandeel: number;
  toppers: Array<{ naam: string; omzet: number }>;
}

// Labels of stores that lie close together shift a little on the map
const LABEL_OPZIJ: Record<string, [number, number]> = {
  Antwerpen: [-0.9, 0],
  Wijnegem: [0.8, -0.9],
};

export function leesFilialen(tabel: QueryTable, toppers: QueryTable): Record<Sleutel, Filiaal[]> {
  const top = new Map<string, Array<{ naam: string; omzet: number; rang: number }>>();
  for (const r of leesRijen(toppers)) {
    const k = kanaalSleutel(r, '[is_totaal]');
    const f = tekst(r('dim_filiaal[filiaal]'));
    const p = tekst(r('dim_product[product]'));
    if (!k || !f || !p) continue;
    const sleutel = `${k}/${f}`;
    if (!top.has(sleutel)) top.set(sleutel, []);
    top.get(sleutel)!.push({ naam: p, omzet: n(r('[Omzet]')), rang: n(r('[Rang]')) });
  }
  const uit: Record<Sleutel, Filiaal[]> = { alle: [], Retail: [], B2B: [], Webshop: [] };
  for (const r of leesRijen(tabel)) {
    const k = kanaalSleutel(r, '[is_totaal]');
    const naam = tekst(r('dim_filiaal[filiaal]'));
    if (!k || !naam) continue;
    const [lx, lz] = LABEL_OPZIJ[naam] ?? [0, 0];
    uit[k].push({
      naam,
      lon: n(r('dim_filiaal[lon]')),
      lat: n(r('dim_filiaal[lat]')),
      centraal: r('dim_filiaal[is_centraal]') === true,
      lx,
      lz,
      stuks: n(r('[Stuks]')),
      vorig: n(r('[Stuks VJ]')),
      omzet: n(r('[Omzet]')),
      omzetVorig: n(r('[Omzet VJ]')),
      groei: getal(r('[Groei]')),
      status: status(r('[Status]')),
      aandeel: n(r('[Aandeel]')),
      toppers: (top.get(`${k}/${naam}`) ?? [])
        .sort((a, b) => a.rang - b.rang)
        .map(({ naam: p, omzet }) => ({ naam: p, omzet })),
    });
  }
  for (const lijst of Object.values(uit)) lijst.sort((a, b) => b.omzet - a.omzet);
  return uit;
}

// --- Top 10 ------------------------------------------------------------------------------------

export interface TopProduct {
  productId: number;
  naam: string;
  groep: string;
  subgroep: string;
  omzet: number;
  omzetVorig: number;
  stuks: number;
  groei: number | null;
  status: Status | null;
  rang: number;
  aandeel: number;
  foto: string;
}

export function leesTop10(tabel: QueryTable, foto: (naam: string, url: string | null, subgroep: string | null) => string): TopProduct[] {
  return leesRijen(tabel)
    .filter((r) => r('dim_product[product_id]') !== null)
    .map((r) => {
      const naam = tekst(r('dim_product[product]')) ?? '';
      return {
        productId: n(r('dim_product[product_id]')),
        naam,
        groep: tekst(r('dim_product[productgroep]')) ?? '',
        subgroep: tekst(r('dim_product[subgroep]')) ?? '',
        omzet: n(r('[Omzet]')),
        omzetVorig: n(r('[Omzet VJ]')),
        stuks: n(r('[Stuks]')),
        groei: getal(r('[Groei]')),
        status: status(r('[Status]')),
        rang: n(r('[Rang]')),
        aandeel: n(r('[Aandeel]')),
        foto: foto(naam, tekst(r('dim_product[foto_url]')), tekst(r('dim_product[subgroep]'))),
      };
    })
    .sort((a, b) => a.rang - b.rang);
}

// --- Product room ------------------------------------------------------------------------------

export interface FicheTabellen {
  kern: QueryTable;
  kanaal: QueryTable;
  maand: QueryTable;
  filiaal: QueryTable;
}

export interface Fiche {
  productId: number;
  naam: string;
  groep: string;
  subgroep: string;
  catalogusprijs: number;
  kostprijs: number;
  foto: string;
  omzet: number;
  omzetVorig: number;
  stuks: number;
  stuksVorig: number;
  groeiOmzet: number | null;
  groeiStuks: number | null;
  status: Status | null;
  verkoopprijs: number;
  verkoopprijsVorig: number;
  brutomarge: number;
  margePerStuk: number;
  margePerStukVorig: number;
  margePct: number;
  margePctVorig: number;
  aandeel: number;
  rang: number;
  rangVorig: number;
  aantalProducten: number;
  stuksKanaal: Record<Kanaal, number>;
  stuksKanaalVorig: Record<Kanaal, number>;
  prijs: Record<Kanaal, number>;
  margeKanaal: Record<Kanaal, number>;
  brutoKanaal: Record<Kanaal, number>;
  margeStukKanaal: Record<Kanaal, number>;
  maanden: Array<{ naam: string; omzet: number; vorig: number }>;
  winkels: Array<{ naam: string; centraal: boolean; stuks: number; vorig: number }>;
}

const perKanaal = (waarde = 0) =>
  Object.fromEntries(KANALEN.map((k) => [k, waarde])) as Record<Kanaal, number>;

/** One product's sheet; the tables may hold every product (sample data), only `productId` is kept. */
export function leesFiche(
  t: FicheTabellen,
  productId: number,
  foto: (naam: string, url: string | null, subgroep: string | null) => string
): Fiche {
  const vanProduct = (tabel: QueryTable) =>
    leesRijen(tabel).filter((r) => getal(r('dim_product[product_id]')) === productId);
  const kern = vanProduct(t.kern)[0];
  if (!kern) throw new Error(`Product ${productId} heeft geen verkoop in deze periode`);
  const naam = tekst(kern('dim_product[product]')) ?? '';

  const stuksKanaal = perKanaal();
  const stuksKanaalVorig = perKanaal();
  const prijs = perKanaal();
  const margeKanaal = perKanaal();
  const brutoKanaal = perKanaal();
  const margeStukKanaal = perKanaal();
  for (const r of vanProduct(t.kanaal)) {
    const k = tekst(r('dim_kanaal[kanaal]')) as Kanaal | null;
    if (!k || !(KANALEN as readonly string[]).includes(k)) continue;
    stuksKanaal[k] = n(r('[Stuks]'));
    stuksKanaalVorig[k] = n(r('[Stuks VJ]'));
    prijs[k] = n(r('[Prijs]'));
    margeKanaal[k] = n(r('[BM %]'));
    brutoKanaal[k] = n(r('[Bruto]'));
    margeStukKanaal[k] = n(r('[Marge per stuk]'));
  }

  return {
    productId,
    naam,
    groep: tekst(kern('dim_product[productgroep]')) ?? '',
    subgroep: tekst(kern('dim_product[subgroep]')) ?? '',
    catalogusprijs: n(kern('dim_product[catalogusprijs]')),
    kostprijs: n(kern('dim_product[kostprijs_per_stuk]')),
    foto: foto(naam, tekst(kern('dim_product[foto_url]')), tekst(kern('dim_product[subgroep]'))),
    omzet: n(kern('[Omzet]')),
    omzetVorig: n(kern('[Omzet VJ]')),
    stuks: n(kern('[Stuks]')),
    stuksVorig: n(kern('[Stuks VJ]')),
    groeiOmzet: getal(kern('[Omzet groei]')),
    groeiStuks: getal(kern('[Stuks groei]')),
    status: status(kern('[Status]')),
    verkoopprijs: n(kern('[Gem prijs]')),
    verkoopprijsVorig: n(kern('[Gem prijs VJ]')),
    brutomarge: n(kern('[Brutomarge]')),
    margePerStuk: n(kern('[Marge per stuk]')),
    margePerStukVorig: n(kern('[Marge per stuk VJ]')),
    margePct: n(kern('[BM %]')),
    margePctVorig: n(kern('[BM % VJ]')),
    aandeel: n(kern('[Aandeel]')),
    rang: n(kern('[Rang]')),
    rangVorig: n(kern('[Rang VJ]')),
    aantalProducten: n(kern('[Aantal producten]')),
    stuksKanaal,
    stuksKanaalVorig,
    prijs,
    margeKanaal,
    brutoKanaal,
    margeStukKanaal,
    maanden: vanProduct(t.maand)
      .sort((a, b) => n(a('dim_datum[maand_nr]')) - n(b('dim_datum[maand_nr]')))
      .map((r) => ({
        naam: tekst(r('dim_datum[maandnaam]')) ?? '',
        omzet: n(r('[Omzet]')),
        vorig: n(r('[Omzet VJ]')),
      })),
    winkels: vanProduct(t.filiaal)
      .filter((r) => tekst(r('dim_filiaal[filiaal]')) !== null)
      .map((r) => ({
        naam: tekst(r('dim_filiaal[filiaal]'))!,
        centraal: r('dim_filiaal[is_centraal]') === true,
        stuks: n(r('[Stuks]')),
        vorig: n(r('[Stuks VJ]')),
      }))
      // The central warehouse first, then the stores from best to worst, as in the demo
      .sort((a, b) => Number(b.centraal) - Number(a.centraal) || b.stuks - a.stuks),
  };
}

// --- Everything for the room -----------------------------------------------------------------

export interface ZaalTabellen {
  kerncijfers: QueryTable;
  boom: QueryTable;
  filialen: QueryTable;
  toppers: QueryTable;
  top10Alle: QueryTable;
  top10Retail: QueryTable;
  top10B2B: QueryTable;
  top10Webshop: QueryTable;
}

export interface Zaal {
  kerncijfers: Record<Sleutel, KanaalCijfers>;
  boom: Knoop;
  filialen: Record<Sleutel, Filiaal[]>;
  top10: Record<Sleutel, TopProduct[]>;
}

export function leesZaal(t: ZaalTabellen, foto: (naam: string, url: string | null, subgroep: string | null) => string): Zaal {
  return {
    kerncijfers: leesKerncijfersMaand(t.kerncijfers),
    boom: leesBoom(t.boom),
    filialen: leesFilialen(t.filialen, t.toppers),
    top10: {
      alle: leesTop10(t.top10Alle, foto),
      Retail: leesTop10(t.top10Retail, foto),
      B2B: leesTop10(t.top10B2B, foto),
      Webshop: leesTop10(t.top10Webshop, foto),
    },
  };
}
