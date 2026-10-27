// The data the 3D modules read. In the demo this file made up fictitious numbers;
// here it holds what the app loaded from the semantic model (or the sample data).
// vulData() fills it before the sales room is built. The shapes stay those of the demo.

import type { Fiche, Filiaal, KanaalCijfers, Knoop, TopProduct, Zaal } from '@/data/zaal';

import type { Domein } from './domeinen';

export type Sleutel = 'alle' | 'Retail' | 'B2B' | 'Webshop';
export type { Fiche, Filiaal, KanaalCijfers, Knoop, TopProduct };

export const periode = 'januari tot september 2026'; // jaar tot nu (YTD)
export const niveauNamen = ['Verkoop', 'Kanaal', 'Productgroep', 'Subgroep', 'Product'];
export const kanaalLijst = ['Retail', 'B2B', 'Webshop'];

// Filled by vulData(); the objects stay the same, so imports keep pointing at the right data
export const domeinen: Domein[] = [];
export const boom: Knoop = { naam: 'Verkoop', stuks: 0, vorigJaar: 0, groei: null, status: null, niveau: 0, pad: '', ouder: null, kinderen: [] };
export const kerncijfers = {} as Record<Sleutel, KanaalCijfers>;
export const filialen = {} as Record<Sleutel, Filiaal[]>;
export const top10 = {} as Record<Sleutel, TopProduct[]>;
export const maandNamen: string[] = [];

export function vulData({ domeinen: deuren, zaal }: { domeinen: readonly Domein[]; zaal: Zaal }): void {
  domeinen.splice(0, domeinen.length, ...deuren);
  // The tree root is reused: its children point back to it as their parent
  for (const kind of zaal.boom.kinderen) kind.ouder = boom;
  Object.assign(boom, { ...zaal.boom, ouder: null });
  Object.assign(kerncijfers, zaal.kerncijfers);
  Object.assign(filialen, zaal.filialen);
  Object.assign(top10, zaal.top10);
  maandNamen.splice(0, maandNamen.length, ...(zaal.kerncijfers.alle?.maanden.map(m => m.naam) ?? []));
}

// Simplified outline of Belgium (longitude, latitude)
export const belgie: Array<[number, number]> = [
  [2.54, 51.09], [3.37, 51.37], [3.83, 51.21], [4.24, 51.37], [4.43, 51.47], [4.78, 51.50], [5.04, 51.47],
  [5.24, 51.27], [5.56, 51.22], [5.85, 51.15], [5.64, 50.85], [5.69, 50.76], [6.02, 50.75], [6.27, 50.62],
  [6.40, 50.32], [6.13, 50.13], [5.75, 49.80], [5.82, 49.55], [5.47, 49.50], [4.85, 49.79], [4.80, 49.95],
  [4.87, 50.15], [4.16, 49.98], [4.13, 50.27], [3.70, 50.30], [3.28, 50.53], [3.02, 50.77], [2.63, 50.81],
];

// --- Number formatting (Belgian notation) ---
const nl = (v: number, d = 0) => v.toLocaleString('nl-BE', { minimumFractionDigits: d, maximumFractionDigits: d });
export const getal = (v: number) => nl(Math.round(v));
export const kort = (v: number): string => (Math.abs(v) >= 1e6 ? `${nl(v / 1e6, 2)}M` : Math.abs(v) >= 1000 ? `${nl(v / 1000, Math.abs(v) >= 100000 ? 0 : 1)}K` : nl(Math.round(v)));
export const euro = (v: number) => `€ ${nl(v, 2)}`;
export const euroKort = (v: number) => `€ ${kort(v)}`;
export const procent = (v: number) => `${nl(v * 100, 1)}%`;
export const groeiTekst = (g: number | null | undefined) => (g === null || g === undefined || !Number.isFinite(g) ? '–' : `${g >= 0 ? '▲ +' : '▼ '}${nl(g * 100, 1)}%`);

// The status of a branch, store, product or channel is [Status] from the model (entity.status).
// A plain difference (against forecast, per month, per channel) only gets a tint by its sign.
export const tint = (g: number | null | undefined): 'groen' | 'oranje' | 'rood' => (g && g > 0 ? 'groen' : g && g < 0 ? 'rood' : 'oranje');

// The product room: perMaand reads the monthly revenue the product sheet brought along
export const perMaand = (f: Fiche) => f.maanden;
