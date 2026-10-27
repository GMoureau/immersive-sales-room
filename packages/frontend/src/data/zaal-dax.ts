// DAX for the sales room. Every query is a small SUMMARIZECOLUMNS on
// sm_immersief_verkoop with the fixed YTD filter; the model does the aggregating.
import { PERIODE_YTD, type KanaalKeuze, kanaalFilter } from './dax';

const P = PERIODE_YTD;

const cumul = (measure: string) =>
  `CALCULATE(${measure}, FILTER(ALL(dim_datum[maand_nr], dim_datum[maandnaam]), dim_datum[maand_nr] <= MAX(dim_datum[maand_nr])))`;

/** Product filter for the product room. Only a validated integer reaches the query. */
export function productFilter(productId: number | null): string {
  if (productId === null) return '';
  if (!Number.isSafeInteger(productId)) throw new Error(`Ongeldig product_id: ${productId}`);
  return `TREATAS({${productId}}, dim_product[product_id]), `;
}

/** Wall cards: per channel (plus total) and per month (plus YTD), with last year and forecast. */
export const kerncijfersMaandQuery = () =>
  'EVALUATE SUMMARIZECOLUMNS(ROLLUPADDISSUBTOTAL(dim_kanaal[kanaal], "is_totaal"), ' +
  'ROLLUPADDISSUBTOTAL(ROLLUPGROUP(dim_datum[maand_nr], dim_datum[maandnaam]), "is_jaar"), ' +
  `${P}, ` +
  '"Omzet", [Omzet], "Omzet VJ", [Omzet VJ], "Omzet FC", [Omzet Forecast], "Groei", [Omzet groei %], "Status", [Status], ' +
  '"Kostprijs", [Kostprijs], "Bruto", [Brutomarge], "Bruto VJ", [Brutomarge VJ], "Bruto FC", [Brutomarge Forecast], ' +
  '"Kosten", [Bedrijfskosten], "Kosten VJ", [Bedrijfskosten VJ], "Kosten FC", [Bedrijfskosten Forecast], ' +
  '"Netto", [Nettowinst], "Netto VJ", [Nettowinst VJ], "Netto FC", [Nettowinst Forecast], ' +
  // Running total since January: every month up to and including this one (on the YTD row: the YTD itself)
  `"Omzet cumul", ${cumul('[Omzet]')}, "Omzet VJ cumul", ${cumul('[Omzet VJ]')}, "Omzet FC cumul", ${cumul('[Omzet Forecast]')})`;

/** Query 5.1 as a whole tree: Verkoop › Kanaal › Productgroep › Subgroep › Product, with subtotals. */
export const boomQuery = () =>
  'EVALUATE SUMMARIZECOLUMNS(ROLLUPADDISSUBTOTAL(dim_kanaal[kanaal], "t_kanaal", dim_product[productgroep], "t_groep", ' +
  'dim_product[subgroep], "t_sub", ROLLUPGROUP(dim_product[product], dim_product[product_id]), "t_product"), ' +
  `${P}, ` +
  '"Stuks", [Stuks], "Stuks VJ", [Stuks VJ], "Groei", [Stuks groei %], "Status", [Status])';

/** Query 5.3 per channel and for all channels together. */
export const filialenQuery = () =>
  'EVALUATE SUMMARIZECOLUMNS(ROLLUPADDISSUBTOTAL(dim_kanaal[kanaal], "is_totaal"), dim_filiaal[filiaal], dim_filiaal[lon], ' +
  `dim_filiaal[lat], dim_filiaal[is_centraal], ${P}, ` +
  '"Omzet", [Omzet], "Omzet VJ", [Omzet VJ], "Groei", [Omzet groei %], "Status", [Status], ' +
  '"Stuks", [Stuks], "Stuks VJ", [Stuks VJ], "Aandeel", [Aandeel omzet totaal])';

/** The three best-selling products per store, with their revenue (the top 3 of query 5.3). */
export const toppersQuery = () =>
  'EVALUATE FILTER(SUMMARIZECOLUMNS(ROLLUPADDISSUBTOTAL(dim_kanaal[kanaal], "is_totaal"), dim_filiaal[filiaal], ' +
  `dim_product[product], ${P}, ` +
  '"Omzet", [Omzet], "Rang", RANKX(ALL(dim_product[product]), [Omzet], , DESC, Dense)), ' +
  // Without the ISBLANK test every store/channel pair without sales ranks all products 1
  'NOT ISBLANK([Omzet]) && [Rang] <= 3)';

/** Query 5.4 for one channel ("Alle" = no filter). */
export const top10Query = (kanaal: KanaalKeuze) =>
  'EVALUATE TOPN(10, SUMMARIZECOLUMNS(dim_product[product_id], dim_product[product], dim_product[productgroep], ' +
  `dim_product[subgroep], dim_product[foto_url], ${kanaalFilter(kanaal)}${P}, ` +
  '"Omzet", [Omzet], "Omzet VJ", [Omzet VJ], "Groei", [Omzet groei %], "Status", [Status], "Stuks", [Stuks], ' +
  '"Aandeel", [Aandeel omzet totaal], "Rang", [Omzetrang], "Rang VJ", [Omzetrang VJ]), [Omzet], DESC) ' +
  'ORDER BY [Omzet] DESC';

/** Query 5.5, key figures. Without a product it returns every product (used to export the sample data). */
export const ficheKernQuery = (productId: number | null) =>
  'EVALUATE SUMMARIZECOLUMNS(dim_product[product_id], dim_product[product], dim_product[productgroep], ' +
  'dim_product[subgroep], dim_product[catalogusprijs], dim_product[kostprijs_per_stuk], dim_product[foto_url], ' +
  `${productFilter(productId)}${P}, ` +
  '"Omzet", [Omzet], "Omzet VJ", [Omzet VJ], "Stuks", [Stuks], "Stuks VJ", [Stuks VJ], ' +
  '"Omzet groei", [Omzet groei %], "Stuks groei", [Stuks groei %], "Status", [Status], ' +
  '"Gem prijs", DIVIDE([Omzet], [Stuks]), "Gem prijs VJ", DIVIDE([Omzet VJ], [Stuks VJ]), "Brutomarge", [Brutomarge], ' +
  '"Marge per stuk", DIVIDE([Brutomarge], [Stuks]), "Marge per stuk VJ", DIVIDE([Brutomarge VJ], [Stuks VJ]), ' +
  '"BM %", [Brutomarge %], "BM % VJ", DIVIDE([Brutomarge VJ], [Omzet VJ]), ' +
  '"Aandeel", [Aandeel omzet totaal], "Rang", [Omzetrang], "Rang VJ", [Omzetrang VJ], ' +
  // Products sold in the period, so rank 35 reads as "35th of N"; IF keeps unsold products out
  '"Aantal producten", IF(NOT ISBLANK([Omzet]), CALCULATE(DISTINCTCOUNT(fact_verkoop[product_id]), REMOVEFILTERS(dim_product))))';

/** Query 5.5, units, price and margin per channel. */
export const ficheKanaalQuery = (productId: number | null) =>
  `EVALUATE SUMMARIZECOLUMNS(dim_product[product_id], dim_kanaal[kanaal], ${productFilter(productId)}${P}, ` +
  '"Stuks", [Stuks], "Stuks VJ", [Stuks VJ], "Prijs", DIVIDE([Omzet], [Stuks]), "BM %", [Brutomarge %], ' +
  '"Bruto", [Brutomarge], "Marge per stuk", DIVIDE([Brutomarge], [Stuks]))';

/** Query 5.5, revenue per month against last year. */
export const ficheMaandQuery = (productId: number | null) =>
  'EVALUATE SUMMARIZECOLUMNS(dim_product[product_id], dim_datum[maand_nr], dim_datum[maandnaam], ' +
  `${productFilter(productId)}${P}, "Omzet", [Omzet], "Omzet VJ", [Omzet VJ]) ORDER BY dim_datum[maand_nr]`;

/** Query 5.5, units per store against last year. */
export const ficheFiliaalQuery = (productId: number | null) =>
  'EVALUATE SUMMARIZECOLUMNS(dim_product[product_id], dim_filiaal[filiaal], dim_filiaal[is_centraal], ' +
  `${productFilter(productId)}${P}, "Stuks", [Stuks], "Stuks VJ", [Stuks VJ])`;

/** Everything the room needs on entry, by name; the product room loads its own four queries. */
export const zaalQueries = () => ({
  kerncijfers: kerncijfersMaandQuery(),
  boom: boomQuery(),
  filialen: filialenQuery(),
  toppers: toppersQuery(),
  top10Alle: top10Query('Alle'),
  top10Retail: top10Query('Retail'),
  top10B2B: top10Query('B2B'),
  top10Webshop: top10Query('Webshop'),
});

export const ficheQueries = (productId: number | null) => ({
  kern: ficheKernQuery(productId),
  kanaal: ficheKanaalQuery(productId),
  maand: ficheMaandQuery(productId),
  filiaal: ficheFiliaalQuery(productId),
});
