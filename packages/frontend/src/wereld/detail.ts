// De scherpe 2D-kaarten die openklappen als je op een station in de productruimte klikt.
// Gewone HTML en SVG bovenop de 3D (die wazig wordt), met bladeren tussen de vier stations.
import { periode, getal, kort, euro, euroKort, procent, groeiTekst, tint, maandNamen, perMaand } from './data';
import type { Fiche, Filiaal, KanaalCijfers, TopProduct } from './data';
import type { Status } from './types';

/** One detail card: the station number, the question in the header, an optional photo, and its content. */
export interface Kaart {
  nr: string;
  vraag: string;
  foto?: string;
  html: () => string;
}

/** The dialog layer that shows the cards and lets you page through them. */
export interface Detail {
  readonly isOpen: boolean;
  open(i: number): void;
  sluit(): void;
  vernietig(): void;
}

export interface DetailOpties {
  opWissel?: (i: number) => void;
  opSluiten?: () => void;
}

type Kanaal = keyof Fiche['stuksKanaal'];
type Totaal = KanaalCijfers['totaal'];
type Marge = { l: number; r: number; t: number; b: number };

const nl = (v: number, d = 1) => v.toLocaleString('nl-BE', { minimumFractionDigits: d, maximumFractionDigits: d });
// st: [Status] from the model for revenue against last year; other differences get a tint by their sign
const groei = (nu: number, vorig: number, st: Status | null = null) => {
  if (vorig <= 0) {
    const d = nu - vorig;
    return `<span class="groei ${d > 0 ? 'groen' : d < 0 ? 'rood' : 'oranje'}">${d >= 0 ? '▲ +' : '▼ −'}€ ${kort(Math.abs(d))}</span>`;
  }
  const g = nu / vorig - 1;
  return `<span class="groei ${st ?? tint(g)}">${groeiTekst(g)}</span>`;
};
const punten = (nu: number, vorig: number) => {
  const d = (nu - vorig) * 100;
  const st = d > 0.5 ? 'groen' : d < -0.5 ? 'rood' : 'oranje';
  return `<span class="groei ${st}">${d >= 0 ? '▲ +' : '▼ '}${nl(d)} ptn</span>`;
};

// --- 1. Alle kerncijfers, dit jaar tegenover vorig jaar ---
function kerncijfers(f: Fiche): string {
  const rangVerschil = f.rangVorig - f.rang;
  const rij = (naam: string, nu: string, vorig: string, verschil: string) => `<tr><th>${naam}</th><td>${nu}</td><td>${vorig}</td><td>${verschil}</td></tr>`;
  return `
    <p class="detail-intro">${f.naam} · ${f.groep} · ${f.subgroep} · ${periode}</p>
    <table class="detail-tabel">
      <thead><tr><th></th><th>Dit jaar</th><th>Vorig jaar</th><th>Verschil</th></tr></thead>
      <tbody>
        ${rij('Omzet', euro(f.omzet), euro(f.omzetVorig), groei(f.omzet, f.omzetVorig, f.status))}
        ${rij('Aantal stuks', getal(f.stuks), getal(f.stuksVorig), groei(f.stuks, f.stuksVorig))}
        ${rij('Gemiddelde verkoopprijs', euro(f.verkoopprijs), euro(f.verkoopprijsVorig), groei(f.verkoopprijs, f.verkoopprijsVorig))}
        ${rij('Marge %', procent(f.margePct), procent(f.margePctVorig), punten(f.margePct, f.margePctVorig))}
        ${rij('Marge per stuk', euro(f.margePerStuk), euro(f.margePerStukVorig), groei(f.margePerStuk, f.margePerStukVorig))}
        ${rij('Omzetrang', `${f.rang}e van ${f.aantalProducten}`, `${f.rangVorig}e`,
          `<span class="groei ${rangVerschil > 0 ? 'groen' : rangVerschil < 0 ? 'rood' : 'oranje'}">${rangVerschil > 0 ? `▲ ${rangVerschil} hoger` : rangVerschil < 0 ? `▼ ${-rangVerschil} lager` : '= gelijk'}</span>`)}
        ${rij('Omzetaandeel', procent(f.aandeel), '', '')}
      </tbody>
    </table>`;
}

// --- 2. Omzet per maand, met vorig jaar, en de beste en zwakste maand ---
function overTijd(f: Fiche): string {
  const maanden = perMaand(f);
  const beste = maanden.reduce((a, m) => (m.omzet > a.omzet ? m : a));
  const zwakste = maanden.reduce((a, m) => (m.omzet < a.omzet ? m : a));
  const beter = maanden.filter(m => m.omzet > m.vorig).length;
  return `
    <div class="detail-chips">
      ${chip('Omzet dit jaar', euroKort(f.omzet))}
      ${chip('Tegenover vorig jaar', groei(f.omzet, f.omzetVorig, f.status))}
      ${chip('Beste maand', `${beste.naam} · ${euroKort(beste.omzet)}`)}
      ${chip('Maanden beter dan vorig jaar', `${beter} van ${maanden.length}`)}
    </div>
    ${lijnGrafiek([
      { waarden: maanden.map(m => m.omzet), klasse: 'lijn' },
      { waarden: maanden.map(m => m.vorig), klasse: 'vorig' },
    ])}
    <p class="detail-legende"><i class="lijn"></i>dit jaar <i class="stip"></i>vorig jaar</p>
    <table class="detail-tabel">
      <thead><tr><th>Maand</th><th>Omzet</th><th>Vorig jaar</th><th>Verschil</th></tr></thead>
      <tbody>${maanden.map(m => `<tr><th>${m.naam}${m === beste ? ' <small>beste maand</small>' : m === zwakste ? ' <small>zwakste maand</small>' : ''}</th><td>€ ${getal(Math.round(m.omzet))}</td><td>€ ${getal(Math.round(m.vorig))}</td><td>${groei(m.omzet, m.vorig)}</td></tr>`).join('')}</tbody>
    </table>`;
}

// --- 3. Per kanaal en per winkel: stuks, vorig jaar, groei ---
function waarVerkocht(f: Fiche): string {
  const kanalen = (Object.keys(f.stuksKanaal) as Kanaal[]).sort((a, b) => f.stuksKanaal[b] - f.stuksKanaal[a]);
  const maxWinkel = Math.max(...f.winkels.map(w => w.stuks));
  const winkels = [...f.winkels].sort((a, b) => b.stuks - a.stuks);
  return `
    <div class="detail-twee">
      <table class="detail-tabel">
        <thead><tr><th>Kanaal</th><th>Stuks</th><th>Vorig jaar</th><th>Groei</th><th>Prijs</th><th>Marge</th></tr></thead>
        <tbody>${kanalen.map(k => `<tr><th>${k}</th><td>${getal(f.stuksKanaal[k])}</td><td>${getal(f.stuksKanaalVorig[k])}</td><td>${groei(f.stuksKanaal[k], f.stuksKanaalVorig[k])}</td><td>${euro(f.prijs[k])}</td><td>${procent(f.margeKanaal[k])}</td></tr>`).join('')}</tbody>
      </table>
      <table class="detail-tabel">
        <thead><tr><th>Winkel</th><th>Stuks</th><th></th><th>Vorig jaar</th><th>Groei</th></tr></thead>
        <tbody>${winkels.map(w => `<tr><th>${w.centraal ? `${w.naam} <small>centraal magazijn</small>` : w.naam}</th><td>${getal(w.stuks)}</td><td class="balkcel"><i style="width:${(100 * w.stuks) / maxWinkel}%"></i></td><td>${getal(w.vorig)}</td><td>${groei(w.stuks, w.vorig)}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
}

// --- 4. Prijsopbouw per kanaal: catalogusprijs, korting, kostprijs en marge ---
function marge(f: Fiche): string {
  const kanalen = (Object.keys(f.stuksKanaal) as Kanaal[]).sort((a, b) => f.stuksKanaal[b] - f.stuksKanaal[a]);
  const schaal = (v: number) => (100 * v) / f.catalogusprijs;
  const rijen = kanalen.map(k => {
    const prijs = f.prijs[k];
    const kortingBedrag = f.catalogusprijs - prijs;
    const margeBedrag = f.margeStukKanaal[k];
    const aandeelStuks = f.stuksKanaal[k] / f.stuks;
    const aandeelMarge = f.brutomarge ? f.brutoKanaal[k] / f.brutomarge : 0;
    return `
      <div class="waterval">
        <div class="naam"><b>${k}</b><small>${procent(aandeelStuks)} van de stuks · ${procent(aandeelMarge)} van de marge</small></div>
        <div class="staaf">
          <i class="kost" style="width:${schaal(f.kostprijs)}%" title="Kostprijs">${euro(f.kostprijs)}</i>
          <i class="winst" style="width:${schaal(margeBedrag)}%" title="Marge">${euro(margeBedrag)} · ${procent(f.margeKanaal[k])}</i>
          ${kortingBedrag > 0.01 ? `<i class="korting" style="width:${schaal(kortingBedrag)}%" title="Korting">korting ${euro(kortingBedrag)}</i>` : ''}
        </div>
      </div>`;
  }).join('');
  return `
    <p class="detail-intro">Catalogusprijs ${euro(f.catalogusprijs)} per stuk. Gemiddeld verdien je <b>${euro(f.margePerStuk)}</b> per stuk (${procent(f.margePct)}).</p>
    <div class="waterval-legende"><span><i class="kost"></i>kostprijs</span><span><i class="winst"></i>marge</span><span><i class="korting"></i>korting t.o.v. catalogus</span></div>
    ${rijen}`;
}

const PRODUCT: Array<(f: Fiche) => string> = [kerncijfers, overTijd, waarVerkocht, marge];

// De vier kaarten van de productruimte, in de volgorde van de stations
// De productfoto komt mee in de kop van elke kaart
export const productKaarten = (f: Fiche, stations: ReadonlyArray<{ nr: string; vraag: string }>): Kaart[] => stations.map((s, i) => ({ nr: s.nr, vraag: s.vraag, foto: f.foto, html: () => PRODUCT[i](f) }));

// --- Kerncijfers van Verkoop (de kaders op de muur) ---

// Een eenvoudige lijngrafiek per maand met meerdere reeksen
function lijnGrafiek(reeksen: Array<{ waarden: number[]; klasse: string }>, { hoogte = 260 }: { hoogte?: number } = {}): string {
  const B = 880;
  const H = hoogte;
  const p = { l: 64, r: 16, t: 16, b: 32 };
  const n = maandNamen.length;
  const alle = reeksen.flatMap(r => r.waarden);
  const min = Math.min(0, ...alle);
  const max = Math.max(...alle) * 1.08;
  const x = (i: number) => p.l + (i / (n - 1)) * (B - p.l - p.r);
  const y = (v: number) => H - p.b - ((v - min) / (max - min)) * (H - p.t - p.b);
  const raster = [0, 0.5, 1].map(t => {
    const v = min + (max - min) * t / 1.08;
    return `<line x1="${p.l}" x2="${B - p.r}" y1="${y(v)}" y2="${y(v)}" class="raster"/><text x="${p.l - 10}" y="${y(v) + 4}" class="as rechts">${euroKort(v)}</text>`;
  }).join('');
  const lijnen = reeksen.map(r => `<path d="${r.waarden.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" class="${r.klasse}"/>`).join('');
  const punten = reeksen[0].waarden.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" class="punt"/>`).join('');
  const maanden = maandNamen.map((m, i) => `<text x="${x(i)}" y="${H - 8}" class="as midden">${m}</text>`).join('');
  return `<svg class="detail-grafiek" viewBox="0 0 ${B} ${H}" role="img">${raster}${lijnen}${punten}${maanden}</svg>`;
}

// --- Grafieken voor de KPI-kaarten op de muur (Omzet, Brutomarge, Nettowinst) ---
// Elke grafiek bouwt zich op bij het openen (CSS-animaties in style.css), elke staaf en elk punt
// heeft een tooltip (<title>), en de tabel eronder geeft dezelfde cijfers voor wie wil narekenen.
// Kleuren (gecontroleerd op kleurenblindheid): dit jaar #881ee7, vorig jaar #a37fd9,
// brutomarge #5b2bb8, kostprijs #d27ad0, forecast in donkere inkt. Groen/rood alleen voor beter/slechter dan de forecast.
const KB = 880; // breedte van een KPI-grafiek
const svg = (H: number, inhoud: string, label: string) => `<svg class="detail-grafiek kpi" viewBox="0 0 ${KB} ${H}" role="img" aria-label="${label}">${inhoud}</svg>`;
const metTip = (t: string) => `<title>${t}</title>`;

// Een staaf vanaf de basislijn y0 tot y1, met een afgeronde kop (4 px) aan de kant weg van de basislijn
function staaf(x: number, y0: number, y1: number, b: number, klasse: string, i: number, tip: string): string {
  const op = y1 <= y0;
  const r = Math.min(4, b / 2, Math.abs(y0 - y1) / 2);
  const s = op ? 1 : -1;
  const d = `M${x},${y0} V${y1 + s * r} Q${x},${y1} ${x + r},${y1} H${x + b - r} Q${x + b},${y1} ${x + b},${y1 + s * r} V${y0} Z`;
  return `<path d="${d}" class="staaf-anim ${op ? '' : 'omlaag'} ${klasse}" style="--i:${i}">${metTip(tip)}</path>`;
}

// Recessief raster met bedragen links, en de maandnamen onderaan
function assen({ p, H, min, max, y, maanden = maandNamen, x }: { p: Marge; H: number; min: number; max: number; y: (v: number) => number; maanden?: string[]; x: (i: number) => number }): string {
  const stappen = [min, (min + max) / 2, max].filter((v, i, a) => a.indexOf(v) === i);
  const raster = stappen.map(v => `<line x1="${p.l}" x2="${KB - p.r}" y1="${y(v)}" y2="${y(v)}" class="raster"/><text x="${p.l - 10}" y="${y(v) + 4}" class="as rechts">${euroKort(v)}</text>`).join('');
  const onder = maanden.map((m, i) => `<text x="${x(i)}" y="${H - 8}" class="as midden">${m}</text>`).join('');
  return raster + onder;
}

// Omzet 1: per maand dit jaar naast vorig jaar, met een streepje voor de forecast
function omzetPerMaand(k: KanaalCijfers): string {
  const H = 260;
  const p = { l: 64, r: 16, t: 24, b: 30 };
  const max = Math.max(...k.maanden.flatMap(m => [m.omzet, m.omzetVorig, m.omzetForecast])) * 1.08;
  const vak = (KB - p.l - p.r) / k.maanden.length;
  const x = (i: number) => p.l + vak * (i + 0.5);
  const y = (v: number) => H - p.b - (v / max) * (H - p.t - p.b);
  const b = vak * 0.3;
  const beste = k.maanden.reduce((a, m) => (m.omzet > a.omzet ? m : a));
  const marks = k.maanden.map((m, i) => {
    const tip = `${m.naam}: ${euro(m.omzet)} · vorig jaar ${euro(m.omzetVorig)} · forecast ${euro(m.omzetForecast)}`;
    return `<g>${staaf(x(i) - b - 1, y(0), y(m.omzet), b, 'nu', i, tip)}${staaf(x(i) + 1, y(0), y(m.omzetVorig), b, 'vorig-staaf', i, tip)}
      <line x1="${x(i) - b - 5}" x2="${x(i) + b + 5}" y1="${y(m.omzetForecast)}" y2="${y(m.omzetForecast)}" class="plan-streep verschijn" style="--i:${i}"/>
      ${m === beste ? `<text x="${x(i) - b / 2 - 1}" y="${y(m.omzet) - 8}" class="waarde verschijn" style="--i:${i}">${euroKort(m.omzet)}</text>` : ''}</g>`;
  }).join('');
  return svg(H, assen({ p, H, min: 0, max: max / 1.08, y, x }) + marks, 'Omzet per maand, dit jaar naast vorig jaar, met de forecast');
}

// Omzet 2: het totaal sinds januari tegenover de forecast en vorig jaar (eigen grafiek, want een andere schaal)
function omzetCumulatief(k: KanaalCijfers): string {
  const H = 220;
  const p = { l: 64, r: 120, t: 16, b: 30 };
  // Het lopende totaal komt uit het model ("Omzet cumul" per maand)
  const reeks = (sleutel: 'omzetCumul' | 'omzetForecastCumul' | 'omzetVorigCumul') => k.maanden.map(m => m[sleutel]);
  const reeksen = { nu: reeks('omzetCumul'), plan: reeks('omzetForecastCumul'), vorig: reeks('omzetVorigCumul') };
  const max = Math.max(...Object.values(reeksen).flat()) * 1.06;
  const x = (i: number) => p.l + (i / (k.maanden.length - 1)) * (KB - p.l - p.r);
  const y = (v: number) => H - p.b - (v / max) * (H - p.t - p.b);
  const pad = (r: number[]) => r.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const n = k.maanden.length - 1;
  const vlak = `${pad(reeksen.nu)} L${x(n)},${y(0)} L${x(0)},${y(0)} Z`;
  // Labels rechts aan het einde van elke lijn, een beetje uit elkaar geschoven als ze botsen
  const eind = ([['nu', 'dit jaar'], ['plan', 'forecast'], ['vorig', 'vorig jaar']] as const).map(([s, naam]) => ({ s, naam, y: y(reeksen[s][n]) })).sort((a, b) => a.y - b.y);
  eind.forEach((e, i) => { if (i && e.y - eind[i - 1].y < 15) e.y = eind[i - 1].y + 15; });
  const labels = eind.map(e => `<text x="${x(n) + 10}" y="${e.y + 4}" class="eind verschijn" style="--i:12">${e.naam} ${euroKort(reeksen[e.s][n])}</text>`).join('');
  const punten = reeksen.nu.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="5" class="punt-nu verschijn" style="--i:${i + 4}">${metTip(`${k.maanden[i].naam}: ${euro(v)} sinds januari · forecast ${euro(reeksen.plan[i])}`)}</circle>`).join('');
  return svg(H, `
    <defs><linearGradient id="omzetVlak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#881ee7" stop-opacity=".28"/><stop offset="1" stop-color="#881ee7" stop-opacity="0"/></linearGradient></defs>
    ${assen({ p, H, min: 0, max: max / 1.06, y, x })}
    <path d="${vlak}" fill="url(#omzetVlak)" class="verschijn" style="--i:6"/>
    <path d="${pad(reeksen.vorig)}" pathLength="1" class="lijn-anim lijn-vorig"/>
    <path d="${pad(reeksen.plan)}" class="lijn-plan verschijn" style="--i:8"/>
    <path d="${pad(reeksen.nu)}" pathLength="1" class="lijn-anim lijn-nu"/>
    ${punten}${labels}`, 'Omzet opgeteld sinds januari, tegenover forecast en vorig jaar');
}

// Brutomarge 1: een halve meter met de marge in %, en een naald voor de forecast
function margeMeter(t: Totaal): string {
  const pct = t.bruto / t.omzet;
  const plan = t.brutoForecast / t.omzetForecast;
  const cx = 150;
  const cy = 150;
  const r = 110;
  const punt = (f: number): [number, number] => [cx - r * Math.cos(Math.PI * f), cy - r * Math.sin(Math.PI * f)];
  const [ex, ey] = punt(pct);
  const [px, py] = punt(plan);
  const [px2, py2] = [cx - (r + 22) * Math.cos(Math.PI * plan), cy - (r + 22) * Math.sin(Math.PI * plan)];
  return `<svg class="detail-grafiek meter" viewBox="-30 -24 360 222" role="img" aria-label="Brutomarge ${procent(pct)}, forecast ${procent(plan)}">
    <defs><linearGradient id="meterVerloop" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5104d2"/><stop offset=".55" stop-color="#881ee7"/><stop offset="1" stop-color="#9e05cd"/></linearGradient></defs>
    <path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}" class="meter-baan"/>
    <path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${ex.toFixed(1)},${ey.toFixed(1)}" pathLength="1" class="lijn-anim meter-vulling" stroke="url(#meterVerloop)"/>
    <line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${px2.toFixed(1)}" y2="${py2.toFixed(1)}" class="plan-streep verschijn" style="--i:10">${metTip(`forecast ${procent(plan)}`)}</line>
    <text x="${(px2 + 6).toFixed(1)}" y="${(py2 - 4).toFixed(1)}" class="as verschijn" style="--i:10">forecast ${procent(plan)}</text>
    <text x="${cx}" y="${cy - 18}" class="meter-getal">${procent(pct)}</text>
    <text x="${cx}" y="${cy + 4}" class="as midden">brutomarge</text>
    <text x="${cx - r}" y="${cy + 32}" class="as midden">0%</text><text x="${cx + r}" y="${cy + 32}" class="as midden">100%</text>
  </svg>`;
}

// Brutomarge 2: per maand de omzet opgedeeld in kostprijs (onder) en brutomarge (boven);
// het marge-% staat alleen bij de zwakste en de sterkste maand (de rest via de tooltip en de tabel)
function margeOpbouw(k: KanaalCijfers): string {
  const H = 250;
  const p = { l: 64, r: 16, t: 28, b: 30 };
  const max = Math.max(...k.maanden.map(m => m.omzet)) * 1.1;
  const vak = (KB - p.l - p.r) / k.maanden.length;
  const x = (i: number) => p.l + vak * (i + 0.5);
  const y = (v: number) => H - p.b - (v / max) * (H - p.t - p.b);
  const b = vak * 0.5;
  const marge = k.maanden.map(m => m.bruto / m.omzet);
  const uitschieters = [marge.indexOf(Math.min(...marge)), marge.indexOf(Math.max(...marge))];
  const marks = k.maanden.map((m, i) => {
    const tip = `${m.naam}: omzet ${euro(m.omzet)} = kostprijs ${euro(m.kost)} + brutomarge ${euro(m.bruto)} (${procent(m.bruto / m.omzet)})`;
    return `${staaf(x(i) - b / 2, y(0), y(m.kost), b, 'kost', i, tip)}${staaf(x(i) - b / 2, y(m.kost) - 2, y(m.omzet), b, 'bruto', i, tip)}
      ${uitschieters.includes(i) ? `<text x="${x(i)}" y="${y(m.omzet) - 8}" class="waarde verschijn" style="--i:${i}">${procent(marge[i])} marge</text>` : ''}`;
  }).join('');
  return svg(H, assen({ p, H, min: 0, max: max / 1.1, y, x }) + marks, 'Omzet per maand opgedeeld in kostprijs en brutomarge');
}

// Nettowinst 1: waterval van omzet naar nettowinst, met een streepje voor de forecast bij elke trede
function nettoWaterval(t: Totaal): string {
  const H = 270;
  const p = { l: 64, r: 16, t: 26, b: 30 };
  const treden: Array<{ naam: string; van: number; tot: number; plan: number; soort: string; bedrag?: number }> = [
    { naam: 'Omzet', van: 0, tot: t.omzet, plan: t.omzetForecast, soort: 'totaal' },
    { naam: '− Kostprijs', van: t.omzet, tot: t.bruto, plan: t.brutoForecast, soort: 'min', bedrag: t.kost },
    { naam: '= Brutomarge', van: 0, tot: t.bruto, plan: t.brutoForecast, soort: 'tussen' },
    { naam: '− Bedrijfskosten', van: t.bruto, tot: t.netto, plan: t.nettoForecast, soort: 'min', bedrag: t.kosten },
    { naam: '= Nettowinst', van: 0, tot: t.netto, plan: t.nettoForecast, soort: 'totaal' },
  ];
  const alle = treden.flatMap(s => [s.van, s.tot, s.plan]);
  const min = Math.min(0, ...alle);
  const max = Math.max(...alle) * 1.08;
  const vak = (KB - p.l - p.r) / treden.length;
  const x = (i: number) => p.l + vak * (i + 0.5);
  const y = (v: number) => H - p.b - ((v - min) / (max - min)) * (H - p.t - p.b);
  const b = vak * 0.46;
  const marks = treden.map((s, i) => {
    const bedrag = s.bedrag ?? s.tot;
    const tip = `${s.naam.replace(/^[−=] /, '')}: ${euro(bedrag)}${s.soort === 'min' ? '' : ` · forecast ${euro(s.plan)}`}`;
    const verbinding = i < treden.length - 1 ? `<line x1="${x(i) + b / 2}" x2="${x(i + 1) - b / 2}" y1="${y(s.tot)}" y2="${y(s.tot)}" class="verbinding verschijn" style="--i:${i + 2}"/>` : '';
    const plan = s.soort === 'min' ? '' : `<line x1="${x(i) - b / 2 - 6}" x2="${x(i) + b / 2 + 6}" y1="${y(s.plan)}" y2="${y(s.plan)}" class="plan-streep verschijn" style="--i:${i + 2}"/>`;
    const top = Math.min(y(s.van), y(s.tot));
    return `${staaf(x(i) - b / 2, y(s.van), y(s.tot), b, s.soort, i * 2, tip)}${plan}${verbinding}
      <text x="${x(i)}" y="${top - 8}" class="waarde verschijn" style="--i:${i * 2}">${s.soort === 'min' ? '−' : ''}${euroKort(bedrag)}</text>
      <text x="${x(i)}" y="${H - 8}" class="as midden">${s.naam}</text>`;
  }).join('');
  const raster = [min, max / 1.08].map(v => `<line x1="${p.l}" x2="${KB - p.r}" y1="${y(v)}" y2="${y(v)}" class="raster"/><text x="${p.l - 10}" y="${y(v) + 4}" class="as rechts">${euroKort(v)}</text>`).join('');
  return svg(H, raster + marks, 'Waterval van omzet naar nettowinst, met de forecast');
}

// Nettowinst 2: per maand het verschil met de forecast; groen erboven, rood eronder, met ▲/▼ bij de grootste uitschieters
function nettoTegenoverPlan(k: KanaalCijfers): string {
  const H = 210;
  const p = { l: 64, r: 16, t: 22, b: 30 };
  const verschil = k.maanden.map(m => m.netto - m.nettoForecast);
  // Alleen ruimte boven of onder de nullijn waar er staven zijn (plus wat lucht voor de labels)
  const lucht = (Math.max(0, ...verschil) - Math.min(0, ...verschil)) * 0.22 || 1;
  const boven = Math.max(0, ...verschil) + lucht;
  const onderGrens = Math.min(0, ...verschil) - lucht;
  const vak = (KB - p.l - p.r) / k.maanden.length;
  const x = (i: number) => p.l + vak * (i + 0.5);
  const y = (v: number) => p.t + ((boven - v) / (boven - onderGrens)) * (H - p.t - p.b);
  const b = vak * 0.5;
  const uitschieters = [verschil.indexOf(Math.max(...verschil)), verschil.indexOf(Math.min(...verschil))];
  const marks = verschil.map((v, i) => {
    const m = k.maanden[i];
    const tip = `${m.naam}: nettowinst ${euro(m.netto)} · forecast ${euro(m.nettoForecast)} · ${v >= 0 ? 'beter' : 'slechter'} met ${euro(Math.abs(v))}`;
    const label = uitschieters.includes(i) ? `<text x="${x(i)}" y="${v >= 0 ? y(v) - 8 : y(v) + 16}" class="waarde ${v >= 0 ? 'goed' : 'slecht'} verschijn" style="--i:${i}">${v >= 0 ? '▲ +' : '▼ −'}${euroKort(Math.abs(v))}</text>` : '';
    return staaf(x(i) - b / 2, y(0), y(v), b, v >= 0 ? 'beter' : 'slechter', i, tip) + label;
  }).join('');
  const nul = `<line x1="${p.l}" x2="${KB - p.r}" y1="${y(0)}" y2="${y(0)}" class="nul"/><text x="${p.l - 10}" y="${y(0) + 4}" class="as rechts">forecast</text>`;
  const onder = maandNamen.map((mn, i) => `<text x="${x(i)}" y="${H - 8}" class="as midden">${mn}</text>`).join('');
  return svg(H, nul + marks + onder, 'Nettowinst per maand tegenover de forecast');
}

const legende = (...items: Array<[string, string]>) => `<p class="detail-legende kpi">${items.map(([klasse, tekst]) => `<span><i class="${klasse}"></i>${tekst}</span>`).join('')}</p>`;
const verschilCel = (nu: number, ander: number) => groei(nu, ander);
const chip = (titel: string, waarde: string | number) => `<div><small>${titel}</small><b>${waarde}</b></div>`;
const kop = (tekst: string) => `<h3 class="detail-kop">${tekst}</h3>`;

function omzetKaart(k: KanaalCijfers): string {
  const t = k.totaal;
  return `
    <div class="detail-chips">
      ${chip('Omzet YTD', euroKort(t.omzet))}
      ${chip('Tegenover vorig jaar', groei(t.omzet, t.omzetVorig, t.status))}
      ${chip('Tegenover forecast', groei(t.omzet, t.omzetForecast))}
      ${chip('Forecast YTD', euroKort(t.omzetForecast))}
    </div>
    ${kop('Per maand')}
    ${omzetPerMaand(k)}
    ${legende(['blok nu', 'dit jaar'], ['blok vorig', 'vorig jaar'], ['streep', 'forecast'])}
    ${kop('Opgeteld sinds januari: op schema?')}
    ${omzetCumulatief(k)}
    <table class="detail-tabel">
      <thead><tr><th>Maand</th><th>Omzet</th><th>Vorig jaar</th><th>Verschil</th><th>Forecast</th><th>Verschil</th></tr></thead>
      <tbody>${k.maanden.map(m => `<tr><th>${m.naam}</th><td>${euro(m.omzet)}</td><td>${euro(m.omzetVorig)}</td><td>${verschilCel(m.omzet, m.omzetVorig)}</td><td>${euro(m.omzetForecast)}</td><td>${verschilCel(m.omzet, m.omzetForecast)}</td></tr>`).join('')}</tbody>
    </table>`;
}

function brutoKaart(k: KanaalCijfers): string {
  const t = k.totaal;
  return `
    <div class="detail-meter-rij">
      ${margeMeter(t)}
      <div class="detail-chips twee">
        ${chip('Brutomarge YTD', euroKort(t.bruto))}
        ${chip('Tegenover forecast', groei(t.bruto, t.brutoForecast))}
        ${chip('Tegenover vorig jaar', groei(t.bruto, t.brutoVorig))}
        ${chip('Kostprijs YTD', euroKort(t.kost))}
      </div>
    </div>
    <p class="detail-intro">Brutomarge = omzet min de kostprijs van de verkochte producten. De maanden met de laagste en de hoogste marge staan erbij.</p>
    ${kop('Elke maand: waar gaat de omzet naartoe?')}
    ${margeOpbouw(k)}
    ${legende(['blok bruto', 'brutomarge'], ['blok kost', 'kostprijs'])}
    <table class="detail-tabel">
      <thead><tr><th>Maand</th><th>Brutomarge</th><th>%</th><th>Forecast</th><th>% forecast</th><th>Verschil</th></tr></thead>
      <tbody>${k.maanden.map(m => `<tr><th>${m.naam}</th><td>${euro(m.bruto)}</td><td>${procent(m.bruto / m.omzet)}</td><td>${euro(m.brutoForecast)}</td><td>${procent(m.brutoForecast / m.omzetForecast)}</td><td>${verschilCel(m.bruto, m.brutoForecast)}</td></tr>`).join('')}</tbody>
    </table>`;
}

function nettoKaart(k: KanaalCijfers): string {
  const t = k.totaal;
  // Van omzet naar nettowinst, dit jaar en volgens de forecast
  const stap = (naam: string, nu: number, plan: number, klasse: string) => `<tr class="${klasse}"><th>${naam}</th><td>${euro(nu)}</td><td>${euro(plan)}</td><td>${klasse === 'kost' ? groei(plan, nu) : groei(nu, plan)}</td></tr>`;
  return `
    <div class="detail-chips">
      ${chip('Nettowinst YTD', euroKort(t.netto))}
      ${chip('Netto % van de omzet', procent(t.netto / t.omzet))}
      ${chip('Tegenover forecast', groei(t.netto, t.nettoForecast))}
      ${chip('Tegenover vorig jaar', groei(t.netto, t.nettoVorig))}
    </div>
    ${kop('Van omzet naar nettowinst')}
    ${nettoWaterval(t)}
    ${legende(['blok nu', 'totaal'], ['blok tussen', 'brutomarge'], ['blok kost', 'kosten eraf'], ['streep', 'forecast'])}
    ${kop('Elke maand tegenover de forecast')}
    ${nettoTegenoverPlan(k)}
    ${legende(['blok beter', 'beter dan forecast'], ['blok slechter', 'slechter dan forecast'])}
    <table class="detail-tabel stappen">
      <thead><tr><th></th><th>Dit jaar</th><th>Forecast</th><th>Verschil</th></tr></thead>
      <tbody>
        ${stap('Omzet', t.omzet, t.omzetForecast, '')}
        ${stap('− Kostprijs verkochte producten', t.kost, t.omzetForecast - t.brutoForecast, 'kost')}
        ${stap('= Brutomarge', t.bruto, t.brutoForecast, 'tussen')}
        ${stap('− Bedrijfskosten', t.kosten, t.kostenForecast, 'kost')}
        ${stap('= Nettowinst', t.netto, t.nettoForecast, 'totaal')}
      </tbody>
    </table>`;
}

// haal(): geeft de kerncijfers van het gekozen kanaal (de slicers op de muur bepalen welk)
// --- Filialen: alle winkels (en het centraal magazijn) naast elkaar ---
function filialenKaart(k: KanaalCijfers, lijst: Filiaal[]): string {
  // Samen = de omzet van het kanaal, uit het model
  const totaal = k.totaal.omzet;
  const totaalVorig = k.totaal.omzetVorig;
  const max = Math.max(...lijst.map(f => f.omzet));
  return `
    <div class="detail-chips">
      ${chip('Omzet YTD', euroKort(totaal))}
      ${chip('Tegenover vorig jaar', groei(totaal, totaalVorig, k.totaal.status))}
      ${chip('Filialen', lijst.length)}
    </div>
    <p class="detail-intro">Omzet per filiaal, ${periode}. Brussel is het centrale magazijn dat B2B en de webshop bedient.</p>
    <table class="detail-tabel">
      <thead><tr><th>Filiaal</th><th>Omzet</th><th></th><th>Vorig jaar</th><th>Groei</th><th>Stuks</th><th>Aandeel</th><th>Best verkocht</th></tr></thead>
      <tbody>${lijst.map(f => `<tr><th>${f.centraal ? `${f.naam} <small>centraal magazijn</small>` : f.naam}</th><td>€ ${getal(Math.round(f.omzet))}</td><td class="balkcel"><i style="width:${(100 * f.omzet) / max}%"></i></td><td>€ ${getal(Math.round(f.omzetVorig))}</td><td>${groei(f.omzet, f.omzetVorig, f.status)}</td><td>${getal(f.stuks)}</td><td>${procent(f.aandeel)}</td><td>${f.toppers[0]?.naam ?? '–'}</td></tr>`).join('')}</tbody>
    </table>`;
}

// --- Top 10 producten op omzet, met foto ---
function top10Kaart(_k: KanaalCijfers, lijst: TopProduct[]): string {
  const max = Math.max(...lijst.map(r => r.omzet));
  return `
    <p class="detail-intro">De tien producten met de meeste omzet, ${periode}. Klik op een tegel aan de muur om naar de productfiche te gaan.</p>
    <table class="detail-tabel top10">
      <thead><tr><th>#</th><th>Product</th><th>Omzet</th><th></th><th>Vorig jaar</th><th>Groei</th><th>Stuks</th><th>Aandeel</th></tr></thead>
      <tbody>${lijst.map(r => `<tr><td>${r.rang}</td><th><img src="${r.foto}" alt="" width="40" height="40">${r.naam} <small>${r.groep} · ${r.subgroep}</small></th><td>€ ${getal(Math.round(r.omzet))}</td><td class="balkcel"><i style="width:${(100 * r.omzet) / max}%"></i></td><td>€ ${getal(Math.round(r.omzetVorig))}</td><td>${groei(r.omzet, r.omzetVorig, r.status)}</td><td>${getal(r.stuks)}</td><td>${procent(r.aandeel)}</td></tr>`).join('')}</tbody>
    </table>`;
}

// haalFilialen() en haalTop10(): de filialen en de topproducten van datzelfde kanaal
export const kernKaarten = (haal: () => KanaalCijfers, haalFilialen: () => Filiaal[], haalTop10: () => TopProduct[]): Kaart[] => [
  { nr: '€', get vraag() { return `Omzet YTD · ${haal().naam}`; }, html: () => omzetKaart(haal()) },
  { nr: '%', get vraag() { return `Brutomarge · ${haal().naam}`; }, html: () => brutoKaart(haal()) },
  { nr: '=', get vraag() { return `Nettowinst · ${haal().naam}`; }, html: () => nettoKaart(haal()) },
  { nr: '◉', get vraag() { return `Filialen · ${haal().naam}`; }, html: () => filialenKaart(haal(), haalFilialen()) },
  { nr: '★', get vraag() { return `Top 10 producten · ${haal().naam}`; }, html: () => top10Kaart(haal(), haalTop10()) },
];

// kaarten: een lijst van { nr, vraag, html() }. opWissel(i) wordt opgeroepen bij openen en bladeren.
export function maakDetail(kaarten: readonly Kaart[], { opWissel, opSluiten }: DetailOpties): Detail {
  const stations = kaarten;
  const laag = document.createElement('div');
  laag.className = 'detail-laag';
  laag.hidden = true;
  laag.innerHTML = `
    <article class="detail-kaart" role="dialog" aria-modal="true" aria-labelledby="detail-titel">
      <header>
        <span class="nr"></span>
        <img class="foto" alt="" hidden>
        <h2 id="detail-titel"></h2>
        <button type="button" class="sluit" aria-label="Sluiten">✕</button>
      </header>
      <div class="inhoud"></div>
      <footer>
        <button type="button" class="vorige"></button>
        <span class="stippen"></span>
        <button type="button" class="volgende"></button>
      </footer>
    </article>`;
  document.body.append(laag);
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => laag.querySelector<T>(s)!;
  let huidig = -1;

  function toon(i: number) {
    huidig = (i + stations.length) % stations.length;
    const s = stations[huidig];
    $('.nr').textContent = s.nr;
    $('.foto').hidden = !s.foto;
    if (s.foto) $<HTMLImageElement>('.foto').src = s.foto;
    $('#detail-titel').textContent = s.vraag;
    $('.inhoud').innerHTML = s.html();
    const v = stations[(huidig + stations.length - 1) % stations.length];
    const n = stations[(huidig + 1) % stations.length];
    $('.vorige').textContent = `‹ ${v.nr} · ${v.vraag}`;
    $('.volgende').textContent = `${n.nr} · ${n.vraag} ›`;
    $('.stippen').innerHTML = stations.map((_, j) => `<i class="${j === huidig ? 'aan' : ''}"></i>`).join('');
    opWissel?.(huidig);
  }

  function sluit() {
    if (laag.hidden) return;
    laag.classList.remove('open');
    setTimeout(() => { laag.hidden = true; }, 200);
    huidig = -1;
    opSluiten?.();
  }

  const opToets = (e: KeyboardEvent) => {
    if (laag.hidden) return;
    if (e.key === 'Escape') sluit();
    if (e.key === 'ArrowRight') toon(huidig + 1);
    if (e.key === 'ArrowLeft') toon(huidig - 1);
  };
  addEventListener('keydown', opToets);
  $('.sluit').onclick = sluit;
  $('.vorige').onclick = () => toon(huidig - 1);
  $('.volgende').onclick = () => toon(huidig + 1);
  // Klikken naast de kaart sluit ze ook
  laag.addEventListener('click', e => { if (e.target === laag) sluit(); });

  return {
    get isOpen() { return !laag.hidden; },
    open(i: number) {
      laag.hidden = false;
      toon(i);
      requestAnimationFrame(() => laag.classList.add('open'));
      $('.sluit').focus();
    },
    sluit,
    vernietig() {
      removeEventListener('keydown', opToets);
      laag.remove();
    },
  };
}
