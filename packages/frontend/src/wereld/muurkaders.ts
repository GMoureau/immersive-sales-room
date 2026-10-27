// KPI-kaarten op de gebogen muur van de Verkoop-zaal, met slicers om een kanaal te kiezen.
// Brutomarge, Omzet en Nettowinst hangen boven de boom, de Top 10 en de filialen aan de buitenkant. Luchtig: per kaart één groot cijfer, één grafiek en een paar callouts; meer via een klik.
//  - Omzet YTD: lijngrafiek per maand die zich tekent (met vorig jaar en forecast)
//  - Brutomarge: donut met de marge in %, met een dunne ring voor de forecast
//  - Nettowinst: kolommen per maand die uit de grond groeien, met een streepje voor de forecast
//  - Filialen: donkere, brede kaart over twee rijen, met België in lichtpuntjes en gloeiende filialen
//  - Top 10 producten: een brede, gebogen kaart over twee rijen, met productfoto's
// De slicers staan als knoppen op de vloer, aan de voet van de muur.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { duur } from './scene';
import { textuur, tekst } from './decor';
import { kort, getal, procent, groeiTekst, tint, maandNamen, belgie } from './data';
import type { Sleutel, KanaalCijfers, Filiaal, TopProduct } from './data';
import { thema } from './thema';
import type { Doel, Status } from './types';

type Maand = KanaalCijfers['maanden'][number];
type MaandGetal = Exclude<keyof Maand, 'naam'>;

/** Wat er op een kaart aanklikbaar is: een bol (cirkel) of een rij/tegel (vak), in punten van de kaart. */
export interface Cirkel { naam: string; x: number; y: number; r: number; b?: undefined; h?: undefined }
export interface Vak { naam: string; x: number; y: number; b: number; h: number; r?: undefined }
export type Punt = Cirkel | Vak;

export type KaartId = 'omzet' | 'bruto' | 'netto' | 'filialen' | 'top10';

/** Een KPI-kaart op de muur (ook het doel in userData.doel). */
export interface Kader {
  kader: true;
  index: number;
  id: KaartId;
  groep: THREE.Group;
  vlak: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  lw: number;
  lh: number;
  voortgang: number;
  hover: boolean;
  gekozen: string | null;
  hoverNaam: string | null;
  punten: Punt[];
  lijst: () => Filiaal[] | TopProduct[];
  teken: () => void;
  vind: (uv: THREE.Vector2 | null | undefined) => string | null;
  kiesNaam: (naam: string | null) => void;
  hoverOp: (naam: string | null) => void;
  midden: () => THREE.Vector3;
}

/** Een slicerknop op de vloer (ook het doel in userData.doel). */
export interface Slicer {
  slicer: Sleutel;
  groep: THREE.Group;
  midden: () => THREE.Vector3;
  teken: (hover?: boolean) => void;
}

export interface Muurkaders {
  groep: THREE.Group;
  kaders: Kader[];
  slicers: Slicer[];
  cijfers: () => KanaalCijfers;
  readonly kanaal: Sleutel;
  speel: (vertraging?: number) => void;
  verschuif: (open: boolean) => void;
  kies: (sleutel: Sleutel) => void;
  hover: (doel: Doel | null) => void;
}

export interface Verschil { tekst: string; st: Status }

/** Tekent één kaart: canvas, cijfers van het gekozen kanaal, voortgang (0–1), aangewezen of niet, en de kaart zelf. */
export type Teken = (g: CanvasRenderingContext2D, k: KanaalCijfers, p: number, hover: boolean, kader: Kader) => void;

// De kaarten staan een stuk van de muur: een vlakke kaart op een ronde muur steekt anders met haar uiteinden erachter
const STRAAL = 12.45;
const SLICER_STRAAL = 12.2; // de slicers staan op de vloer, net voor de muur
const RIJ_BOVEN = 5.3;  // hoogte van het midden van de bovenste rij (en van Omzet, boven de boom)
const RIJ_ONDER = 2.7;  // en van de onderste rij: de blokken aan de buitenkant reiken tot hier
const MARGE = 36;       // ruimte rond de kaart voor de schaduw
// Een kaart wordt getekend in punten: een gewone kaart is 1500 × 1015 punten (3,4 × 2,3 m op de muur),
// plus de marge, en scherper gerenderd met factor S
const BREED = 1500;
const HOOG = 1015;
const S = 1.2;
const METER = 3.4 / BREED;
// De maat van de kaart die nu getekend wordt (verschilt per kaart; het tekenen gebeurt één kaart tegelijk)
let LW = BREED + 2 * MARGE;
let LH = HOOG + 2 * MARGE;
const statusCss: Record<Status, string> = { groen: '#15803d', oranje: '#b45309', rood: '#dc2626' };
// Op de donkere kaart lichtere varianten, zodat ze gloeien
const statusGloed: Record<Status, string> = { groen: '#34d399', oranje: '#fbbf24', rood: '#fb7185' };

// Kleuren van de lichte kaarten, en hun tegenhanger in de donkere modus (gekozen wanneer de muur gebouwd wordt)
const LICHT = {
  donker: false, tekst: '#0f1013', inkt: '#27282b', zacht: '#565759', stil: '#6d6d70', stil2: '#8a8a90', vorig: '#b4b4ba',
  lijn: '#f0eef5', lijn2: '#d9d6e2', baan: '#f1ecfa', balkBaan: '#e9e1f8', tegel: '#f8f5fd', tegelHover: '#f1e9fd', vlak: '#ffffff', slicer: '#27282b',
};
const DONKER = {
  donker: true, tekst: '#f2f0f7', inkt: '#ece8f5', zacht: '#c9c5d6', stil: '#a59fb8', stil2: '#8f8aa3', vorig: '#6f6a85',
  lijn: '#2a2836', lijn2: '#3a3747', baan: '#2a2836', balkBaan: '#2e2b3b', tegel: '#201e2a', tegelHover: '#2a2638', vlak: '#17161f', slicer: '#ece8f5',
};
let P = LICHT;
const stKleur = () => (P.donker ? statusGloed : statusCss);
const euroKort = (v: number) => `${v < 0 ? '−' : ''}€ ${kort(Math.abs(v))}`;
const nl = (v: number, d = 1) => v.toLocaleString('nl-BE', { minimumFractionDigits: d, maximumFractionDigits: d });
const zacht = (t: number) => 1 - (1 - t) ** 3;
const klem = (t: number) => Math.max(0, Math.min(1, t));

// Verschil als percentage; bij een negatieve of nulbasis is een percentage zinloos, dan in euro.
// st: de [Status] uit het model als die er is (omzet tegenover vorig jaar), anders een tint volgens het teken.
export function verschil(nu: number, ander: number, st: Status | null = null): Verschil {
  if (ander > 0) {
    const g = nu / ander - 1;
    return { tekst: groeiTekst(g), st: st ?? tint(g) };
  }
  const d = nu - ander;
  return { tekst: `${d >= 0 ? '▲ +' : '▼ −'}€ ${kort(Math.abs(d))}`, st: d > 0 ? 'groen' : d < 0 ? 'rood' : 'oranje' };
}

function ronde(g: CanvasRenderingContext2D, x: number, y: number, b: number, h: number, r: number | number[]) {
  g.beginPath();
  g.roundRect(x, y, b, h, r);
}

// De kaart zelf: afgeronde hoeken en een zachte schaduw; violette rand bij aanwijzen.
// Licht: wit. Donker: bijna zwart met een paarse gloed van het logoverloop.
function kaart(g: CanvasRenderingContext2D, hover: boolean, donker = P.donker) {
  const b = LW;
  const h = LH;
  g.clearRect(0, 0, b, h);
  g.save();
  g.shadowColor = donker ? 'rgba(15, 16, 19, 0.35)' : 'rgba(15, 16, 19, 0.13)';
  g.shadowBlur = 44;
  g.shadowOffsetY = 14;
  if (donker) {
    const v = g.createLinearGradient(0, MARGE, 0, h - MARGE);
    v.addColorStop(0, '#1b1530');
    v.addColorStop(1, '#0c0b12');
    g.fillStyle = v;
  } else {
    g.fillStyle = '#ffffff';
  }
  ronde(g, MARGE, MARGE, b - 2 * MARGE, h - 2 * MARGE, 64);
  g.fill();
  g.restore();
  if (donker) {
    g.save();
    ronde(g, MARGE, MARGE, b - 2 * MARGE, h - 2 * MARGE, 64);
    g.clip();
    const gloed = (x: number, y: number, r: number, kleur: string) => {
      const v = g.createRadialGradient(x, y, 0, x, y, r);
      v.addColorStop(0, kleur);
      v.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = v;
      g.fillRect(0, 0, b, h);
    };
    gloed(b * 0.85, 120, 1000, 'rgba(158, 5, 205, 0.30)');
    gloed(b * 0.1, h * 0.35, 900, 'rgba(81, 4, 210, 0.22)');
    g.restore();
    g.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    g.lineWidth = 2;
    ronde(g, MARGE + 1, MARGE + 1, b - 2 * MARGE - 2, h - 2 * MARGE - 2, 63);
    g.stroke();
  }
  if (hover) {
    g.strokeStyle = donker ? '#b57cff' : '#881ee7';
    g.lineWidth = 8;
    ronde(g, MARGE, MARGE, b - 2 * MARGE, h - 2 * MARGE, 64);
    g.stroke();
  }
}

// Rond violet icoon, een grote duidelijke titel met de periode eronder, en rechts een chip met het gekozen kanaal
function kop(g: CanvasRenderingContext2D, icoon: string, titel: string, kanaal: string, donker = P.donker) {
  const verloop = g.createLinearGradient(110, 100, 210, 200);
  verloop.addColorStop(0, '#5104d2');
  verloop.addColorStop(1, '#9e05cd');
  g.fillStyle = verloop;
  g.beginPath();
  g.arc(160, 150, 50, 0, Math.PI * 2);
  g.fill();
  tekst(g, icoon, 160, 168, '600 50px Inter, sans-serif', '#ffffff', 'center');
  tekst(g, titel, 238, 168, '700 72px Inter, sans-serif', donker ? '#ffffff' : '#0f1013');
  tekst(g, 'YTD · januari – september 2026', 240, 218, '400 30px Inter, sans-serif', donker ? '#a59fb8' : '#6d6d70');
  g.font = '500 32px Inter, sans-serif';
  const b = g.measureText(kanaal).width + 48;
  const x = LW - 110 - b;
  g.fillStyle = donker ? 'rgba(181, 124, 255, 0.18)' : '#f1e9fd';
  ronde(g, x, 96, b, 60, 30);
  g.fill();
  tekst(g, kanaal, x + 24, 137, '500 32px Inter, sans-serif', donker ? '#d8b4fe' : '#881ee7');
}

// Een gekleurd pilletje: "▲ +3,8%  vs vorig jaar"
function callout(g: CanvasRenderingContext2D, x: number, y: number, v: Verschil, tegen: string, alfa = 1, donker = P.donker) {
  const t = `${v.tekst}  vs ${tegen}`;
  const kleur = (donker ? statusGloed : statusCss)[v.st];
  g.save();
  g.globalAlpha = alfa;
  g.font = '600 34px Inter, sans-serif';
  const b = g.measureText(t).width + 48;
  g.fillStyle = `${kleur}${donker ? '26' : '1c'}`;
  ronde(g, x, y, b, 62, 31);
  g.fill();
  tekst(g, t, x + 24, y + 43, '600 34px Inter, sans-serif', kleur);
  g.restore();
}

// Tekst over meerdere regels binnen een breedte; geeft het aantal gebruikte regels terug
function regels(g: CanvasRenderingContext2D, t: string, x: number, y: number, breedte: number, lijn: number, font: string, kleur: string, max = 3): number {
  g.font = font;
  const woorden = t.split(' ');
  const uit: string[] = [];
  let regel = '';
  for (const w of woorden) {
    const proef = regel ? `${regel} ${w}` : w;
    if (g.measureText(proef).width > breedte && regel) {
      uit.push(regel);
      regel = w;
    } else regel = proef;
  }
  uit.push(regel);
  if (uit.length > max) {
    uit.length = max;
    uit[max - 1] = `${uit[max - 1].replace(/\s+\S*$/, '')}…`;
  }
  uit.forEach((r, i) => tekst(g, r, x, y + i * lijn, font, kleur));
  return uit.length;
}

// --- Omzet YTD: lijngrafiek die zich van januari naar september tekent ---
function tekenOmzet(g: CanvasRenderingContext2D, k: KanaalCijfers, p: number, hover: boolean) {
  kaart(g, hover);
  const t = k.totaal;
  kop(g, '€', 'Omzet', k.naam);
  tekst(g, euroKort(t.omzet * zacht(Math.min(1, p * 1.3))), 104, 400, '300 140px Inter, sans-serif', P.tekst);
  callout(g, 780, 268, verschil(t.omzet, t.omzetVorig, t.status), 'vorig jaar', Math.min(1, p * 2));
  callout(g, 780, 346, verschil(t.omzet, t.omzetForecast), 'forecast', Math.min(1, Math.max(0, p * 2 - 0.3)));

  const x0 = 140;
  const y0 = 470;
  const b = LW - x0 - 140;
  const h = 360;
  const reeks = (s: MaandGetal) => k.maanden.map(m => m[s]);
  const alle = [...reeks('omzet'), ...reeks('omzetVorig'), ...reeks('omzetForecast')];
  const min = Math.min(...alle) * 0.85;
  const max = Math.max(...alle) * 1.05;
  const n = maandNamen.length;
  const x = (i: number) => x0 + (i / (n - 1)) * b;
  const y = (v: number) => y0 + h - ((v - min) / (max - min)) * h;

  g.strokeStyle = P.lijn;
  g.lineWidth = 3;
  for (const f of [0, 0.5, 1]) {
    g.beginPath();
    g.moveTo(x0, y0 + h * f);
    g.lineTo(x0 + b, y0 + h * f);
    g.stroke();
  }
  // Vorig jaar en forecast verschijnen zacht
  const lijn = (waarden: number[], kleur: string, dikte: number, streep: number[], alfa: number) => {
    g.save();
    g.globalAlpha = alfa;
    g.strokeStyle = kleur;
    g.lineWidth = dikte;
    g.setLineDash(streep);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.beginPath();
    waarden.forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v))));
    g.stroke();
    g.restore();
  };
  lijn(reeks('omzetVorig'), P.vorig, 6, [18, 14], Math.min(1, p * 1.5));
  lijn(reeks('omzetForecast'), P.inkt, 5, [2, 14], Math.min(1, p * 1.5));

  // Dit jaar: tot waar de animatie gekomen is, met een zacht vlak eronder
  const nu = reeks('omzet');
  const kop2 = zacht(p) * (n - 1);
  const punten: Array<[number, number]> = [];
  for (let i = 0; i <= Math.floor(kop2); i++) punten.push([x(i), y(nu[i])]);
  const rest = kop2 - Math.floor(kop2);
  if (rest > 0 && Math.floor(kop2) < n - 1) {
    const i = Math.floor(kop2);
    punten.push([x(i) + (x(i + 1) - x(i)) * rest, y(nu[i] + (nu[i + 1] - nu[i]) * rest)]);
  }
  const vlak = g.createLinearGradient(0, y0, 0, y0 + h);
  vlak.addColorStop(0, 'rgba(136, 30, 231, 0.22)');
  vlak.addColorStop(1, 'rgba(136, 30, 231, 0)');
  g.fillStyle = vlak;
  g.beginPath();
  g.moveTo(punten[0][0], y0 + h);
  punten.forEach(([px, py]) => g.lineTo(px, py));
  g.lineTo(punten.at(-1)![0], y0 + h);
  g.fill();
  g.strokeStyle = '#881ee7';
  g.lineWidth = 11;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  punten.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.stroke();
  const [hx, hy] = punten.at(-1)!;
  g.fillStyle = P.vlak;
  g.beginPath();
  g.arc(hx, hy, 17, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#881ee7';
  g.lineWidth = 8;
  g.stroke();

  maandNamen.forEach((m, i) => tekst(g, m, x(i), y0 + h + 50, '400 30px Inter, sans-serif', P.stil, 'center'));
  // Legende
  const item = (dx: number, kleur: string, streep: number[], label: string) => {
    g.save();
    g.strokeStyle = kleur;
    g.lineWidth = 6;
    g.setLineDash(streep);
    g.beginPath();
    g.moveTo(140 + dx, 958);
    g.lineTo(190 + dx, 958);
    g.stroke();
    g.restore();
    tekst(g, label, 204 + dx, 969, '400 30px Inter, sans-serif', P.zacht);
  };
  item(0, '#881ee7', [], 'dit jaar');
  item(250, P.vorig, [18, 14], 'vorig jaar');
  item(540, P.inkt, [2, 14], 'forecast');
}

// --- Brutomarge: donut met de marge in %, dunne buitenring voor de forecast ---
function tekenBruto(g: CanvasRenderingContext2D, k: KanaalCijfers, p: number, hover: boolean) {
  kaart(g, hover);
  const t = k.totaal;
  kop(g, '%', 'Brutomarge', k.naam);
  const pct = t.bruto / t.omzet;
  const pctPlan = t.brutoForecast / t.omzetForecast;
  const cx = 420;
  const cy = 610;
  const r = 215;
  const start = -Math.PI / 2;
  // Spoor
  g.strokeStyle = P.baan;
  g.lineWidth = 64;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  // Marge, die zich rond vult
  g.strokeStyle = '#881ee7';
  g.lineCap = 'round';
  g.beginPath();
  g.arc(cx, cy, r, start, start + Math.PI * 2 * pct * zacht(p));
  g.stroke();
  // Forecast als dunne ring erbuiten
  g.save();
  g.globalAlpha = Math.min(1, p * 1.5);
  g.strokeStyle = P.inkt;
  g.lineWidth = 8;
  g.lineCap = 'butt';
  g.beginPath();
  g.arc(cx, cy, r + 58, start, start + Math.PI * 2 * pctPlan);
  g.stroke();
  g.restore();
  g.lineCap = 'butt';
  tekst(g, `${nl(pct * 100 * zacht(p))}%`, cx, cy + 26, '300 104px Inter, sans-serif', P.tekst, 'center');
  tekst(g, 'van de omzet', cx, cy + 82, '400 32px Inter, sans-serif', P.stil, 'center');

  const x = 780;
  tekst(g, euroKort(t.bruto * zacht(p)), x, 470, '300 96px Inter, sans-serif', P.tekst);
  tekst(g, 'brutomarge YTD', x + 4, 522, '400 32px Inter, sans-serif', P.stil);
  callout(g, x, 570, verschil(t.bruto, t.brutoForecast), 'forecast', Math.min(1, p * 2));
  g.save();
  g.globalAlpha = Math.min(1, p * 1.5);
  g.strokeStyle = P.inkt;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(x, 712);
  g.lineTo(x + 46, 712);
  g.stroke();
  g.restore();
  tekst(g, `forecast ${procent(pctPlan)}`, x + 62, 724, '400 32px Inter, sans-serif', P.zacht);
}

// --- Nettowinst: kolommen per maand die één voor één groeien, met een streepje voor de forecast ---
function tekenNetto(g: CanvasRenderingContext2D, k: KanaalCijfers, p: number, hover: boolean) {
  kaart(g, hover);
  const t = k.totaal;
  kop(g, '=', 'Nettowinst', k.naam);
  tekst(g, euroKort(t.netto * zacht(Math.min(1, p * 1.3))), 104, 380, '300 120px Inter, sans-serif', P.tekst);
  tekst(g, `${procent(t.netto / t.omzet)} van de omzet`, 110, 432, '400 32px Inter, sans-serif', P.stil);
  callout(g, 780, 290, verschil(t.netto, t.nettoForecast), 'forecast', Math.min(1, p * 2));

  const x0 = 120;
  const b = LW - 2 * x0;
  const y0 = 500;
  const h = 350;
  const waarden = k.maanden.map(m => m.netto);
  const plannen = k.maanden.map(m => m.nettoForecast);
  const max = Math.max(0, ...waarden, ...plannen);
  const min = Math.min(0, ...waarden, ...plannen);
  const y = (v: number) => y0 + h - ((v - min) / (max - min || 1)) * h;
  const n = waarden.length;
  const stap = b / n;
  const kolom = stap * 0.56;
  // Nullijn
  g.strokeStyle = P.lijn2;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x0, y(0));
  g.lineTo(x0 + b, y(0));
  g.stroke();
  waarden.forEach((v, i) => {
    const groei = zacht(Math.max(0, Math.min(1, p * 1.6 - i * 0.07)));
    const cx = x0 + stap * i + stap / 2;
    const top = y(v * groei);
    const st = verschil(v, plannen[i]).st;
    g.fillStyle = stKleur()[st];
    g.globalAlpha = 0.9;
    const y1 = Math.min(top, y(0));
    const hoogte = Math.abs(top - y(0));
    ronde(g, cx - kolom / 2, y1, kolom, Math.max(hoogte, 2), [14, 14, 4, 4]);
    g.fill();
    g.globalAlpha = 1;
    // Forecast-streepje
    if (groei > 0.6) {
      g.strokeStyle = P.inkt;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(cx - kolom / 2 - 10, y(plannen[i]));
      g.lineTo(cx + kolom / 2 + 10, y(plannen[i]));
      g.stroke();
    }
    tekst(g, maandNamen[i], cx, y0 + h + 52, '400 28px Inter, sans-serif', P.stil, 'center');
  });
}


// Waar het naamlabel staat tegenover het bolletje, waar filialen dicht bij elkaar liggen: [opzij, boven]
// (in punten bij een kaartschaal van 264; ze schalen mee met de kaart)
const LABELS: Record<string, [number, boolean]> = { Antwerpen: [-70, true], Wijnegem: [60, true], Hasselt: [-20, false], Maastricht: [40, false] };
// Wijnegem ligt vlak naast Antwerpen; op de kaart schuift het een beetje op zodat beide bolletjes klikbaar blijven
const OPZIJ: Record<string, [number, number]> = { Wijnegem: [0.13, -0.09] };

// --- Filialen: donker en liggend, over beide rijen. Links België in lichtpuntjes met een gloeiende bol per filiaal,
// rechts de ranking van alle filialen, of de cijfers van het filiaal dat je aanklikte ---
function tekenFilialen(g: CanvasRenderingContext2D, k: KanaalCijfers, p: number, hover: boolean, kader: Kader) {
  kaart(g, hover, true);
  kop(g, '◉', 'Filialen', k.naam, true);
  const lijst = kader.lijst() as Filiaal[]; // de filialenkaart krijgt altijd de lijst van filialen

  // Kaartgebied links; België en alle filialen passen erin
  const gx0 = 70;
  const gy0 = 280;
  const gb = 1680;
  const gh = 1840;
  const lons = [...belgie.map(q => q[0]), ...lijst.map(f => f.lon)];
  const lats = [...belgie.map(q => q[1]), ...lijst.map(f => f.lat)];
  const lonMin = Math.min(...lons, 2.0) - 0.12;
  const lonMax = Math.max(...lons) + 0.12;
  const latMin = Math.min(...lats) - 0.1;
  const latMax = Math.max(...lats) + 0.1;
  const cos = 0.636; // lengtegraden zijn op onze breedte korter dan breedtegraden
  const schaal = Math.min(gb / ((lonMax - lonMin) * cos), gh / (latMax - latMin));
  const ox = gx0 + (gb - (lonMax - lonMin) * cos * schaal) / 2;
  const oy = gy0 + (gh - (latMax - latMin) * schaal) / 2;
  const X = (lon: number) => ox + (lon - lonMin) * cos * schaal;
  const Y = (lat: number) => oy + (latMax - lat) * schaal;
  const maat = schaal / 449; // bollen en letters groeien mee met de kaart

  // België als een raster van fijne lichtpuntjes, met een gloeiende rand
  const land = new Path2D();
  belgie.forEach(([lon, lat], i) => (i ? land.lineTo(X(lon), Y(lat)) : land.moveTo(X(lon), Y(lat))));
  land.closePath();
  g.save();
  g.fillStyle = 'rgba(136, 30, 231, 0.10)';
  g.fill(land);
  g.shadowColor = 'rgba(181, 124, 255, 0.9)';
  g.shadowBlur = 30;
  g.strokeStyle = 'rgba(196, 161, 255, 0.55)';
  g.lineWidth = 4;
  g.stroke(land);
  g.restore();
  const stap = 22;
  const m = g.getTransform(); // isPointInPath rekent in pixels van het canvas, niet in punten
  g.fillStyle = 'rgba(196, 161, 255, 0.38)';
  for (let y = gy0; y < gy0 + gh; y += stap) {
    for (let x = gx0 + ((y / stap) % 2) * (stap / 2); x < gx0 + gb; x += stap) {
      if (!g.isPointInPath(land, x * m.a, y * m.d)) continue;
      g.beginPath();
      g.arc(x, y, 3.4, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Bollen: grootte = omzet, kleur = groei tegenover vorig jaar; ze ploppen één voor één op met een lichtkrans
  const maxOmzet = Math.max(...lijst.map(f => f.omzet));
  const gekozen = lijst.find(q => q.naam === kader.gekozen) ?? (lijst.length === 1 ? lijst[0] : null);
  kader.punten = [];
  lijst.forEach((f, i) => {
    const s = zacht(klem(p * 1.8 - i * 0.12));
    const volle = (22 + 46 * Math.sqrt(f.omzet / maxOmzet)) * maat;
    const r = volle * s;
    const [ox2, oy2] = OPZIJ[f.naam] ?? [0, 0];
    const x = X(f.lon) + ox2 * schaal;
    const y = Y(f.lat) + oy2 * schaal;
    const kleur = statusGloed[f.status ?? 'oranje'];
    kader.punten.push({ naam: f.naam, x, y, r: volle + 14 });
    if (r < 0.5) return;
    g.save();
    g.globalAlpha = gekozen && gekozen !== f ? 0.4 : 1;
    // Lichtkrans
    const krans = g.createRadialGradient(x, y, r * 0.4, x, y, r * 2.3);
    krans.addColorStop(0, `${kleur}77`);
    krans.addColorStop(1, `${kleur}00`);
    g.fillStyle = krans;
    g.beginPath();
    g.arc(x, y, r * 2.3, 0, Math.PI * 2);
    g.fill();
    // De bol zelf: licht in het midden, verzadigd aan de rand
    const bol = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    bol.addColorStop(0, '#ffffff');
    bol.addColorStop(0.35, kleur);
    bol.addColorStop(1, `${kleur}cc`);
    g.fillStyle = bol;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    if (kader.hoverNaam === f.naam || gekozen === f) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(x, y, r + (gekozen === f ? 16 : 0), 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  });
  // Namen pas na alle bollen, zodat geen bol een naam bedekt
  const font = `500 ${Math.round(34 * maat)}px Inter, sans-serif`;
  lijst.forEach((f, i) => {
    const s = zacht(klem(p * 1.8 - i * 0.12));
    const { x, y, r } = kader.punten[i] as Cirkel; // de eerste punten zijn de bollen, één per filiaal
    const [dx, boven] = LABELS[f.naam] ?? [0, false];
    g.save();
    g.globalAlpha = s * (gekozen && gekozen !== f ? 0.5 : 1);
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(12, 11, 18, 0.85)';
    g.lineJoin = 'round';
    g.font = font;
    g.textAlign = 'center';
    const lx = x + (dx * schaal) / 264;
    const ly = boven ? y - r - 6 : y + r + 30 * maat;
    const naam = f.naam;
    g.strokeText(naam, lx, ly);
    tekst(g, naam, lx, ly, font, '#ece8f5', 'center');
    g.restore();
  });

  // Scheidingslijn tussen kaart en paneel
  g.fillStyle = 'rgba(255, 255, 255, 0.08)';
  g.fillRect(1790, 280, 2, LH - 400);
  const x0 = 1880;
  const rechts = LW - 120;
  const groot = (x: number, y: number) => {
    const v = g.createLinearGradient(x, y - 160, x + 800, y);
    v.addColorStop(0, '#c4a1ff');
    v.addColorStop(1, '#f0abfc');
    return v;
  };

  if (gekozen) {
    // --- De cijfers van één filiaal ---
    const f = gekozen;
    const kleur = statusGloed[f.status ?? 'oranje'];
    tekst(g, f.naam, x0, 380, '700 84px Inter, sans-serif', '#ffffff');
    tekst(g, f.centraal ? 'Centraal magazijn · B2B en webshop' : 'Winkel · retail', x0 + 2, 440, '400 36px Inter, sans-serif', '#a59fb8');
    tekst(g, euroKort(f.omzet * zacht(klem(p * 1.4))), x0 - 8, 660, '200 200px Inter, sans-serif', groot(x0, 660));
    tekst(g, 'omzet YTD', x0 + 2, 722, '400 36px Inter, sans-serif', '#a59fb8');
    callout(g, x0, 764, verschil(f.omzet, f.omzetVorig, f.status), 'vorig jaar', klem(p * 2), true);
    tekst(g, getal(f.stuks), x0, 1000, '300 92px Inter, sans-serif', '#ffffff');
    tekst(g, 'stuks', x0 + 2, 1050, '400 34px Inter, sans-serif', '#a59fb8');
    tekst(g, procent(f.aandeel), x0 + 600, 1000, '300 92px Inter, sans-serif', '#ffffff');
    tekst(g, lijst.length > 1 ? 'van de omzet' : 'van de omzet van dit kanaal', x0 + 602, 1050, '400 34px Inter, sans-serif', '#a59fb8');
    // Best verkocht, met een balkje
    tekst(g, 'Best verkocht', x0, 1210, '600 40px Inter, sans-serif', '#d8d3e6');
    const max = f.toppers[0]?.omzet || 1;
    f.toppers.forEach((t, j) => {
      const y = 1300 + j * 110;
      const naam = t.naam.length > 34 ? `${t.naam.slice(0, 33)}…` : t.naam;
      tekst(g, `${j + 1}`, x0, y, '600 38px Inter, sans-serif', kleur);
      tekst(g, naam, x0 + 60, y, '400 38px Inter, sans-serif', '#ece8f5');
      tekst(g, euroKort(t.omzet), rechts, y, '500 38px Inter, sans-serif', '#ffffff', 'right');
      g.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ronde(g, x0 + 60, y + 22, rechts - x0 - 60, 10, 5);
      g.fill();
      g.fillStyle = kleur;
      ronde(g, x0 + 60, y + 22, ((rechts - x0 - 60) * t.omzet * zacht(klem(p * 1.5))) / max, 10, 5);
      g.fill();
    });
    if (lijst.length > 1) tekst(g, 'Klik nog eens op de bol om terug naar de ranking te gaan', x0, LH - 110, '400 32px Inter, sans-serif', '#7f7896');
  } else {
    // --- Ranking van alle filialen; ook de rijen zijn klikbaar ---
    tekst(g, 'Ranking filialen', x0, 380, '600 64px Inter, sans-serif', '#ffffff');
    tekst(g, 'Klik op een bol of een rij voor de cijfers', x0 + 2, 440, '400 36px Inter, sans-serif', '#a59fb8');
    const bx = x0 + 380;
    const bb = rechts - bx - 400;
    lijst.forEach((f, i) => {
      const y = 570 + i * 120;
      const s = zacht(klem(p * 1.6 - i * 0.08));
      if (kader.hoverNaam === f.naam) {
        g.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ronde(g, x0 - 30, y - 64, rechts - x0 + 60, 100, 24);
        g.fill();
      }
      kader.punten.push({ naam: f.naam, x: x0 - 30, y: y - 64, b: rechts - x0 + 60, h: 100 });
      const kleur = statusGloed[f.status ?? 'oranje'];
      tekst(g, `${i + 1}`, x0, y, '500 36px Inter, sans-serif', '#7f7896');
      tekst(g, f.naam, x0 + 60, y, '500 44px Inter, sans-serif', '#ece8f5');
      g.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ronde(g, bx, y - 26, bb, 20, 10);
      g.fill();
      const balk = g.createLinearGradient(bx, 0, bx + bb, 0);
      balk.addColorStop(0, '#881ee7');
      balk.addColorStop(1, kleur);
      g.fillStyle = balk;
      ronde(g, bx, y - 26, Math.max(20, (bb * f.omzet * s) / maxOmzet), 20, 10);
      g.fill();
      tekst(g, euroKort(f.omzet), rechts - 190, y, '500 42px Inter, sans-serif', '#ffffff', 'right');
      tekst(g, groeiTekst(f.groei), rechts, y, '600 36px Inter, sans-serif', kleur, 'right');
    });
    // Het totaal van alle filialen in dit kanaal: de omzet van het kanaal zelf, uit het model
    const totaal = k.totaal.omzet;
    const vorig = k.totaal.omzetVorig;
    g.fillStyle = 'rgba(255, 255, 255, 0.08)';
    g.fillRect(x0, 1560, rechts - x0, 2);
    tekst(g, 'Samen', x0, 1660, '400 36px Inter, sans-serif', '#a59fb8');
    tekst(g, euroKort(totaal * zacht(klem(p * 1.4))), x0 - 8, 1850, '200 180px Inter, sans-serif', groot(x0, 1850));
    callout(g, x0, 1900, verschil(totaal, vorig, k.totaal.status), 'vorig jaar', klem(p * 2), true);
    tekst(g, 'grootte = omzet · kleur = groei t.o.v. vorig jaar', x0, LH - 110, '400 32px Inter, sans-serif', '#7f7896');
  }
}

// Productfoto's voor de Top 10: één keer laden; als een foto binnen is, wordt de kaart opnieuw getekend
type Foto = HTMLImageElement & { wachtenden: Array<() => void> };
const fotos: Record<string, Foto> = {};
function foto(src: string, klaar: () => void): HTMLImageElement | null {
  if (!fotos[src]) {
    fotos[src] = Object.assign(new Image(), { src, wachtenden: [] });
    fotos[src].onload = () => fotos[src].wachtenden.forEach(f => f());
  }
  const img = fotos[src];
  if (!img.complete) img.wachtenden.push(klaar);
  return img.complete && img.naturalWidth ? img : null;
}

// --- Top 10 producten: twee rijen van vijf hoge tegels met foto, rang, omzet en groei; klik = naar het product ---
function tekenTop10(g: CanvasRenderingContext2D, k: KanaalCijfers, p: number, hover: boolean, kader: Kader) {
  kaart(g, hover);
  kop(g, '★', 'Top 10 producten', k.naam);
  g.font = '700 72px Inter, sans-serif';
  tekst(g, 'op omzet', 238 + g.measureText('Top 10 producten').width + 22, 168, '400 40px Inter, sans-serif', P.stil);
  const lijst = kader.lijst() as TopProduct[]; // de Top 10-kaart krijgt altijd de lijst van producten
  const maxAandeel = Math.max(...lijst.map(r => r.aandeel));
  // Twee rijen van vijf hoge tegels: bovenaan de foto, daaronder naam, omzet, groei en aandeel
  const x0 = 100;
  const tussen = 40;
  const tb = (LW - 2 * x0 - 4 * tussen) / 5;
  const th = (LH - 268 - 110 - tussen) / 2;
  kader.punten = [];
  lijst.forEach((r, i) => {
    const x = x0 + (i % 5) * (tb + tussen);
    const y = 268 + Math.floor(i / 5) * (th + tussen);
    const s = zacht(klem(p * 1.7 - i * 0.07));
    const dy = (1 - s) * 40;
    kader.punten.push({ naam: r.naam, x, y, b: tb, h: th });
    g.save();
    g.globalAlpha = s;
    // Tegel
    g.fillStyle = kader.hoverNaam === r.naam ? P.tegelHover : P.tegel;
    ronde(g, x, y + dy, tb, th, 48);
    g.fill();
    if (kader.hoverNaam === r.naam) {
      g.strokeStyle = '#881ee7';
      g.lineWidth = 6;
      g.stroke();
    }
    // Foto op een witte schijf
    const fx = x + tb / 2;
    const fy = y + 300 + dy;
    g.save();
    g.shadowColor = 'rgba(81, 4, 210, 0.16)';
    g.shadowBlur = 40;
    g.shadowOffsetY = 10;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(fx, fy, 215, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const img = foto(r.foto, () => kader.teken());
    if (img) {
      const m = 340 / Math.max(img.naturalWidth, img.naturalHeight);
      g.drawImage(img, fx - (img.naturalWidth * m) / 2, fy - (img.naturalHeight * m) / 2, img.naturalWidth * m, img.naturalHeight * m);
    }
    // Rang
    const verloop = g.createLinearGradient(x + 20, y + 20, x + 100, y + 100);
    verloop.addColorStop(0, '#5104d2');
    verloop.addColorStop(1, '#9e05cd');
    g.fillStyle = verloop;
    g.beginPath();
    g.arc(x + 64, y + 64 + dy, 38, 0, Math.PI * 2);
    g.fill();
    tekst(g, `${r.rang}`, x + 64, y + 79 + dy, '700 40px Inter, sans-serif', '#ffffff', 'center');
    // Naam, soort, omzet, groei en aandeel
    const tx = x + 44;
    const tw = tb - 88;
    regels(g, r.naam, tx, y + 600 + dy, tw, 54, '600 44px Inter, sans-serif', P.tekst, 2);
    tekst(g, r.subgroep, tx, y + 718 + dy, '400 32px Inter, sans-serif', P.stil2);
    tekst(g, euroKort(r.omzet), tx - 3, y + 815 + dy, '300 84px Inter, sans-serif', P.tekst);
    tekst(g, groeiTekst(r.groei), x + tb - 44, y + 815 + dy, '600 34px Inter, sans-serif', stKleur()[r.status ?? 'oranje'], 'right');
    g.fillStyle = P.balkBaan;
    ronde(g, tx, y + th - 56 + dy, tw, 14, 7);
    g.fill();
    g.fillStyle = '#881ee7';
    ronde(g, tx, y + th - 56 + dy, Math.max(14, (tw * r.aandeel) / maxAandeel), 14, 7);
    g.fill();
    g.restore();
  });
}

// Een kaart is even breed als het stuk muur tussen twee hoeken; zo sluit de Top 10 precies aan
// bij de buitenranden van Omzet en Brutomarge (met de tussenruimte erbij)
const hoekBreedte = (graden: number) => (THREE.MathUtils.degToRad(graden) * STRAAL) / METER;
const KAART_HOEK = THREE.MathUtils.radToDeg((BREED * METER) / STRAAL);

// Boven de boom hangen drie kaarten naast elkaar: Brutomarge, Omzet en Nettowinst.
// Aan de buitenkant twee even grote blokken over twee rijen, die op 32° van het midden beginnen:
// links de Top 10, rechts de filialenkaart.
const BLOK = 17 + KAART_HOEK;        // breedte van een blok in graden: twee kaarten plus de tussenruimte
const BLOK_MIDDEN = 32 + BLOK / 2;
const BLOK_Y = (RIJ_BOVEN + RIJ_ONDER) / 2;
const BLOK_HOOG = (RIJ_BOVEN - RIJ_ONDER) / METER + HOOG;
// open: hoe de kaart opschuift zodra de boom openklapt (graden opzij, meter omhoog), zodat de boom kan ademen
interface KaartPlan { id: KaartId; graden: number; y: number; breed: number; hoog: number; gebogen?: boolean; open: [number, number]; teken: Teken }
const KAARTEN: KaartPlan[] = [
  { id: 'omzet', graden: 0, y: RIJ_BOVEN, breed: BREED, hoog: HOOG, open: [0, 0.5], teken: tekenOmzet },
  { id: 'bruto', graden: -17, y: RIJ_BOVEN, breed: BREED, hoog: HOOG, open: [-3, 0.5], teken: tekenBruto },
  { id: 'netto', graden: 17, y: RIJ_BOVEN, breed: BREED, hoog: HOOG, open: [3, 0.5], teken: tekenNetto },
  { id: 'filialen', graden: BLOK_MIDDEN, y: BLOK_Y, breed: hoekBreedte(BLOK), hoog: BLOK_HOOG, gebogen: true, open: [10, 0], teken: tekenFilialen },
  { id: 'top10', graden: -BLOK_MIDDEN, y: BLOK_Y, breed: hoekBreedte(BLOK), hoog: BLOK_HOOG, gebogen: true, open: [-10, 0], teken: tekenTop10 },
];
// De slicers staan onder de filialenkaart en schuiven met haar mee
const SLICER_OPEN: [number, number] = [10, 0];
export const SLICERS: Array<{ sleutel: Sleutel; label: string }> = [
  { sleutel: 'alle', label: 'Alle' },
  { sleutel: 'Retail', label: 'Retail' },
  { sleutel: 'B2B', label: 'B2B' },
  { sleutel: 'Webshop', label: 'Webshop' },
];

// Plaats een groep op de gebogen muur, met de voorkant naar het midden van de zaal
function opMuur(g: THREE.Object3D, graden: number, y: number, straal = STRAAL) {
  const hoek = THREE.MathUtils.degToRad(graden);
  g.position.set(straal * Math.sin(hoek), y, -straal * Math.cos(hoek));
  g.rotation.y = -hoek;
}

// Een vlak dat meebuigt met de ronde muur (voor de brede Top 10-kaart): de randen komen naar de kijker toe
function gebogenVlak(b: number, h: number, straal: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(b, h, 64, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const a = pos.getX(i) / straal;
    pos.setX(i, straal * Math.sin(a));
    pos.setZ(i, straal * (1 - Math.cos(a)));
  }
  geo.computeVertexNormals();
  return geo;
}

export function maakMuurkaders(
  alleCijfers: Record<Sleutel, KanaalCijfers>,
  alleFilialen: Record<Sleutel, Filiaal[]>,
  alleTop10: Record<Sleutel, TopProduct[]>
): Muurkaders {
  P = thema.donker ? DONKER : LICHT;
  const groep = new THREE.Group();
  let kanaal: Sleutel = 'alle';
  const cijfers = () => alleCijfers[kanaal];
  const lijsten: Partial<Record<KaartId, () => Filiaal[] | TopProduct[]>> = { filialen: () => alleFilialen[kanaal], top10: () => alleTop10[kanaal] };

  // Waar elke kaart en slicer staat, en hoe ver ze opschuiven als de boom open is
  const plaatsen: Array<{ g: THREE.Group; graden: number; y: number; open: [number, number]; straal: number }> = [];
  const stand = { open: 0 };
  const herplaats = () => plaatsen.forEach(q => opMuur(q.g, q.graden + q.open[0] * stand.open, q.y + q.open[1] * stand.open, q.straal));

  // --- De kaarten ---
  const kaders = KAARTEN.map((d, i) => {
    const g = new THREE.Group();
    opMuur(g, d.graden, d.y);
    plaatsen.push({ g, graden: d.graden, y: d.y, open: d.open, straal: STRAAL });
    const lw = Math.round(d.breed + 2 * MARGE);
    const lh = Math.round(d.hoog + 2 * MARGE);
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(lw * S), height: Math.round(lh * S) });
    const tex = textuur(canvas);
    const geo = d.gebogen ? gebogenVlak(lw * METER, lh * METER, STRAAL) : new THREE.PlaneGeometry(lw * METER, lh * METER);
    const vlak = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    vlak.position.z = 0.03;
    g.add(vlak);
    const kader: Kader = {
      kader: true, index: i, id: d.id, groep: g, vlak, lw, lh, voortgang: 0, hover: false, gekozen: null, hoverNaam: null, punten: [],
      lijst: lijsten[d.id] ?? (() => []),
      teken: () => {
        const ctx = canvas.getContext('2d')!;
        LW = lw;
        LH = lh;
        ctx.setTransform(S, 0, 0, S, 0, 0);
        d.teken(ctx, cijfers(), kader.voortgang, kader.hover, kader);
        tex.needsUpdate = true;
      },
      // Wat ligt er op deze plek van de kaart (uv = plek op het oppervlak, van 0 tot 1)? Een bol, een rij of een tegel.
      // (Een vak heeft altijd een breedte; zonder breedte is het een bol, dus r bestaat.)
      vind: uv => {
        if (!uv) return null;
        const x = uv.x * lw;
        const y = (1 - uv.y) * lh;
        return kader.punten.find(q => (q.b ? x >= q.x && x <= q.x + q.b && y >= q.y && y <= q.y + q.h : Math.hypot(q.x - x, q.y - y) <= q.r!))?.naam ?? null;
      },
      kiesNaam: naam => {
        kader.gekozen = naam;
        kader.teken();
      },
      hoverOp: naam => {
        if (kader.hoverNaam === naam) return;
        kader.hoverNaam = naam;
        kader.teken();
      },
      midden: () => g.localToWorld(new THREE.Vector3(0, 0, 0)),
    };
    g.userData.doel = kader;
    kader.teken();
    groep.add(g);
    return kader;
  });

  // --- Slicers: vier knoppen op de vloer aan de voet van de muur, onder de kaart van België ---
  // Elke knop is een lage witte sokkel met een pil erop, waarvan het bovenvlak schuin naar de kijker kijkt.
  const sokkelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const slicers = SLICERS.map((s, i) => {
    const g = new THREE.Group();
    const breedte = 1.0;
    const graden = BLOK_MIDDEN + THREE.MathUtils.radToDeg(((i - 1.5) * (breedte + 0.18)) / SLICER_STRAAL);
    opMuur(g, graden, 0, SLICER_STRAAL);
    plaatsen.push({ g, graden, y: 0, open: SLICER_OPEN, straal: SLICER_STRAAL });
    const sokkel = new THREE.Mesh(new RoundedBoxGeometry(breedte + 0.12, 0.7, 0.45, 3, 0.05), sokkelMat);
    sokkel.position.y = 0.35;
    sokkel.castShadow = true;
    sokkel.receiveShadow = true;
    const knopGroep = new THREE.Group();
    knopGroep.position.set(0, 0.72, 0.02);
    knopGroep.rotation.x = -0.6; // het bovenvlak kantelt naar de kijker toe
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5 });
    // Een echte pil: een afgeronde rechthoek met volledig ronde uiteinden, een beetje uitgezet
    const vorm = new THREE.Shape();
    vorm.absarc(-breedte / 2 + 0.19, 0, 0.19, Math.PI / 2, Math.PI * 1.5, false);
    vorm.absarc(breedte / 2 - 0.19, 0, 0.19, -Math.PI / 2, Math.PI / 2, false);
    const pilGeo = new THREE.ExtrudeGeometry(vorm, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 24 });
    const pil = new THREE.Mesh(pilGeo, mat);
    pil.castShadow = true;
    const c = Object.assign(document.createElement('canvas'), { width: 440, height: 152 });
    const tex = textuur(c);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(breedte, 0.38), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    label.position.z = 0.07;
    knopGroep.add(pil, label);
    g.add(sokkel, knopGroep);
    const knop: Slicer = {
      slicer: s.sleutel, groep: g, midden: () => knopGroep.localToWorld(new THREE.Vector3()),
      teken: (hover = false) => {
        const actief = s.sleutel === kanaal;
        // Licht: witte knoppen die iets oplichten, zodat ze niet grijs ogen in de schaduw. Donker: donkere knoppen.
        const rust = P.donker ? 0x25232f : 0xffffff;
        mat.color.set(actief ? 0x881ee7 : hover ? (P.donker ? 0x3a3150 : 0xf1e9fd) : rust);
        mat.emissive.set(actief ? 0x881ee7 : rust);
        mat.emissiveIntensity = actief ? 0.25 : P.donker ? 0.15 : 0.35;
        const ctx = c.getContext('2d')!;
        ctx.clearRect(0, 0, c.width, c.height);
        tekst(ctx, s.label, c.width / 2, 104, '700 74px Inter, sans-serif', actief ? '#ffffff' : P.slicer, 'center');
        tex.needsUpdate = true;
      },
    };
    g.userData.doel = knop;
    knop.teken();
    groep.add(g);
    return knop;
  });

  // Alle kaarten opnieuw opbouwen (bij binnenkomen of na een andere slicer)
  function speel(vertraging = 0) {
    kaders.forEach((kader, i) => {
      gsap.killTweensOf(kader);
      kader.voortgang = 0;
      kader.teken();
      gsap.to(kader, { voortgang: 1, duration: duur(1.6), delay: duur(vertraging + i * 0.15), ease: 'none', onUpdate: kader.teken });
    });
  }

  return {
    groep,
    kaders,
    slicers,
    cijfers,
    get kanaal() { return kanaal; },
    speel,
    // Schuif alles opzij en omhoog (de boom klapt open) of terug naar zijn plaats (alleen de stam staat er)
    verschuif(open: boolean) {
      gsap.to(stand, { open: open ? 1 : 0, duration: duur(1.0), ease: 'power2.inOut', overwrite: true, onUpdate: herplaats });
    },
    kies(sleutel: Sleutel) {
      if (sleutel === kanaal) return;
      kanaal = sleutel;
      // Een gekozen filiaal dat in dit kanaal niet bestaat, wordt losgelaten
      for (const kader of kaders) if (kader.gekozen && !kader.lijst().some(f => f.naam === kader.gekozen)) kader.gekozen = null;
      slicers.forEach(s => s.teken());
      speel();
    },
    // Aanwijzen: violette rand op een kaart, zachte kleur op een knop
    hover(doel: Doel | null) {
      for (const kader of kaders) {
        const aan = kader === doel;
        if (kader.hover !== aan) {
          kader.hover = aan;
          kader.teken();
        }
      }
      slicers.forEach(s => s.teken(s === doel));
    },
  };
}
