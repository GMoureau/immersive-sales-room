// DAX queries for sm_immersief_verkoop. The model aggregates; the app only
// sends small SUMMARIZECOLUMNS queries built from the fixed pieces below.
// Names and measures follow the data layer handover, nothing is invented here.

/** Year-to-date: January to September 2026, compared with the same months last year. */
export const PERIODE_YTD =
  'TREATAS({2026}, dim_datum[jaar]), FILTER(VALUES(dim_datum[maand_nr]), dim_datum[maand_nr] <= 9)';

export const KANALEN = ['Retail', 'B2B', 'Webshop'] as const;
export type Kanaal = (typeof KANALEN)[number];
export type KanaalKeuze = Kanaal | 'Alle';

/**
 * Channel filter on dim_kanaal[kanaal]. "Alle" means no filter. Only values
 * from the fixed list reach the query text, so user input never becomes DAX.
 */
export function kanaalFilter(kanaal: KanaalKeuze): string {
  if (kanaal === 'Alle') return '';
  if (!KANALEN.includes(kanaal)) throw new Error(`Onbekend kanaal: ${kanaal}`);
  return `TREATAS({"${kanaal}"}, dim_kanaal[kanaal]), `;
}

/** Control query 5.2: key figures per channel plus the total row. */
export function kerncijfersQuery(): string {
  return (
    'EVALUATE SUMMARIZECOLUMNS(ROLLUPADDISSUBTOTAL(dim_kanaal[kanaal], "is_totaal"), ' +
    `${PERIODE_YTD}, ` +
    '"Omzet", [Omzet], "Omzet VJ", [Omzet VJ], "Groei", [Omzet groei %], "Status", [Status], ' +
    '"Omzet FC", [Omzet Forecast], "BM %", [Brutomarge %], "Bedrijfskosten", [Bedrijfskosten], ' +
    '"Netto", [Nettowinst], "Netto VJ", [Nettowinst VJ], "Netto FC", [Nettowinst Forecast])'
  );
}

/** Row cap per query: an overflow fails loudly instead of returning a partial answer. */
export const RIJGRENS = 500;
