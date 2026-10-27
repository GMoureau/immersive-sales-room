// De productruimte, gezien over de schouder van de avatar.
// Dezelfde ronde zaal als Verkoop, met vier genummerde stations in een vaste leesvolgorde:
// 1 recht voor je (hoe doet het product het?), 2 links (over de tijd), 3 rechts (waar verkocht?), 4 verder links (marge).
// Een klik op een station draait ernaartoe en klapt het open tot een scherpe 2D-kaart (detail.js).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { gsap } from 'gsap';
import { kleur, label, materiaal, schaduw, duur } from './scene';
import { thema } from './thema';
import { domeinen, periode, getal, kort, euro, euroKort, procent, groeiTekst, tint, perMaand } from './data';
import { maakZaal } from './kamer';
import { textuur, tekst } from './decor';
import { maakDetail, productKaarten } from './detail';
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Wereld } from './scene';
import type { Fiche } from './data';
import type { Ruimte, Status } from './types';

type Kanaal = keyof Fiche['stuksKanaal'];

/** A station as defined below: number, question, place in the room and size of the display board. */
export interface StationDef {
  nr: number;
  vraag: string;
  graden: number;
  afstand: number;
  breedte: number;
  hoogte: number;
}

/** A built station: what you hover and click (the board group with its glowing edge). */
export interface StationDoel extends StationDef {
  groep: THREE.Group;
  rand: THREE.Mesh<RoundedBoxGeometry, THREE.MeshStandardMaterial>;
}

/** The product room as app.ts uses it. */
export interface Product extends Ruimte {
  hint: string;
  hover(doel: StationDoel | null): void;
  klik(doel: StationDoel): Promise<void>;
  update(t: number): void;
  start(): void;
  opruimen(): void;
}

const SCHOUDER: [number, number] = [0, 0.8];
const statusKleur: Record<Status, number> = { groen: kleur.groen, oranje: kleur.oranje, rood: kleur.rood };
const statusCss: Record<Status, string> = { groen: '#15803d', oranje: '#b45309', rood: '#dc2626' };
const statusGloed: Record<Status, string> = { groen: '#34d399', oranje: '#fbbf24', rood: '#fb7185' };
// Kleuren van de schermen, licht en donker (gekozen wanneer de productruimte gebouwd wordt)
const LICHT = { donker: false, tekst: '#0f1013', inkt: '#27282b', zacht: '#565759', stil: '#6d6d70', tegel: '#f7f6fb', paneel: '#f7f3fd', vlak: '#ffffff' };
const DONKER = { donker: true, tekst: '#f2f0f7', inkt: '#ece8f5', zacht: '#c9c5d6', stil: '#a59fb8', tegel: '#201e2a', paneel: '#201e2a', vlak: '#141319' };
type Palet = typeof LICHT;
let P: Palet = LICHT;
const nl = (v: number, d = 1) => v.toLocaleString('nl-BE', { minimumFractionDigits: d, maximumFractionDigits: d });

// De vier stations: nummer, vraag, plaats in de zaal en maat van het displaybord
export const STATIONS: readonly StationDef[] = [
  { nr: 1, vraag: 'Hoe doet dit product het?', graden: 0, afstand: 10, breedte: 7.6, hoogte: 4.0 },
  { nr: 2, vraag: 'Hoe loopt het over de tijd?', graden: -50, afstand: 9, breedte: 7, hoogte: 3.4 },
  { nr: 3, vraag: 'Waar wordt het verkocht?', graden: 50, afstand: 9, breedte: 8, hoogte: 3.4 },
  { nr: 4, vraag: 'Wat verdien je eraan?', graden: -100, afstand: 8.5, breedte: 6.6, hoogte: 3.4 },
];

// Rond knopje met het nummer, en de vraag ernaast
function tekenTitel(g: CanvasRenderingContext2D, nr: number, vraag: string, x: number, y: number, schaal = 1) {
  g.fillStyle = '#881ee7';
  g.beginPath();
  g.arc(x + 42 * schaal, y - 16 * schaal, 42 * schaal, 0, Math.PI * 2);
  g.fill();
  tekst(g, String(nr), x + 42 * schaal, y + 2 * schaal, `600 ${52 * schaal}px Inter, sans-serif`, '#ffffff', 'center');
  tekst(g, vraag, x + 108 * schaal, y + 2 * schaal, `600 ${58 * schaal}px Inter, sans-serif`, P.tekst);
}

function ronde(g: CanvasRenderingContext2D, x: number, y: number, b: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, b, h, r);
}

// Het hoofdscherm van station 1: links de productfoto, rechts de naam en vier KPI-tegels (2 × 2),
// elk tegenover vorig jaar. img = de foto zodra die geladen is (tot dan alleen de schijf).
function tekenHoofdscherm(c: HTMLCanvasElement, f: Fiche, img: HTMLImageElement | null) {
  c.width = 2048;
  c.height = 1078;
  const g = c.getContext('2d')!;
  g.fillStyle = P.vlak;
  g.fillRect(0, 0, c.width, c.height);
  tekenTitel(g, 1, 'Hoe doet dit product het?', 70, 110, 0.8);

  // Foto op een zachte schijf in een lichtpaars vlak
  g.fillStyle = P.paneel;
  ronde(g, 70, 180, 460, 830, 40);
  g.fill();
  g.save();
  g.shadowColor = 'rgba(81, 4, 210, 0.16)';
  g.shadowBlur = 40;
  g.shadowOffsetY = 12;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(300, 560, 190, 0, Math.PI * 2);
  g.fill();
  g.restore();
  if (img) {
    const m = 330 / Math.max(img.naturalWidth, img.naturalHeight);
    g.drawImage(img, 300 - (img.naturalWidth * m) / 2, 560 - (img.naturalHeight * m) / 2, img.naturalWidth * m, img.naturalHeight * m);
  }
  tekst(g, f.subgroep, 300, 850, '500 38px Inter, sans-serif', '#881ee7', 'center');
  tekst(g, `${euro(f.catalogusprijs)} per stuk`, 300, 905, '400 34px Inter, sans-serif', P.stil, 'center');

  // Naam: zo groot als past op één regel
  const x0 = 590;
  const breed = c.width - x0 - 70;
  g.font = '600 84px Inter, sans-serif';
  const grootte = Math.max(54, Math.min(84, Math.floor((84 * breed) / g.measureText(f.naam).width)));
  tekst(g, f.naam, x0, 250, `600 ${grootte}px Inter, sans-serif`, P.tekst);
  tekst(g, `${f.groep} · ${f.subgroep} · ${periode}`, x0 + 2, 312, '400 38px Inter, sans-serif', P.zacht);

  const verschilPunten = (f.margePct - f.margePctVorig) * 100;
  const rangVerschil = f.rangVorig - f.rang;
  const tegels: Array<{ naam: string; waarde: string; groei: string; st: Status; vorig: string }> = [
    { naam: 'Omzet', waarde: euroKort(f.omzet), groei: groeiTekst(f.groeiOmzet), st: f.status ?? 'oranje', vorig: euroKort(f.omzetVorig) },
    { naam: 'Aantal stuks', waarde: getal(f.stuks), groei: groeiTekst(f.groeiStuks), st: tint(f.groeiStuks), vorig: getal(f.stuksVorig) },
    {
      naam: 'Marge %', waarde: procent(f.margePct), vorig: procent(f.margePctVorig),
      groei: `${verschilPunten >= 0 ? '▲ +' : '▼ '}${nl(verschilPunten)} ptn`,
      st: verschilPunten > 0.5 ? 'groen' : verschilPunten < -0.5 ? 'rood' : 'oranje',
    },
    {
      naam: 'Omzetrang', waarde: `${f.rang}e`, vorig: `${f.rangVorig}e van ${f.aantalProducten}`,
      groei: rangVerschil > 0 ? `▲ ${rangVerschil} plaats${rangVerschil > 1 ? 'en' : ''} hoger` : rangVerschil < 0 ? `▼ ${-rangVerschil} plaats${rangVerschil < -1 ? 'en' : ''} lager` : '= zelfde plaats',
      st: rangVerschil > 0 ? 'groen' : rangVerschil < 0 ? 'rood' : 'oranje',
    },
  ];
  const b = (breed - 40) / 2;
  const h = 295;
  tegels.forEach((t, i) => {
    const x = x0 + (i % 2) * (b + 40);
    const y = 380 + Math.floor(i / 2) * (h + 40);
    g.fillStyle = P.tegel;
    ronde(g, x, y, b, h, 32);
    g.fill();
    g.fillStyle = (P.donker ? statusGloed : statusCss)[t.st];
    ronde(g, x, y + 30, 10, h - 60, 5);
    g.fill();
    tekst(g, t.naam, x + 50, y + 72, '500 40px Inter, sans-serif', P.inkt);
    tekst(g, t.waarde, x + 46, y + 196, '300 112px Inter, sans-serif', P.tekst);
    tekst(g, t.groei, x + 50, y + 256, '600 36px Inter, sans-serif', (P.donker ? statusGloed : statusCss)[t.st]);
    tekst(g, `vorig jaar ${t.vorig}`, x + b - 40, y + 256, '400 32px Inter, sans-serif', P.stil, 'right');
  });
}

// Station 3, rechts: de ranking van de filialen voor dit product (stuks YTD en groei), op een donker paneel
function tekenFilialen(f: Fiche) {
  const c = Object.assign(document.createElement('canvas'), { width: 1480, height: 1040 });
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, c.height);
  v.addColorStop(0, '#1b1530');
  v.addColorStop(1, '#0c0b12');
  g.fillStyle = v;
  ronde(g, 0, 0, c.width, c.height, 48);
  g.fill();
  g.save();
  ronde(g, 0, 0, c.width, c.height, 48);
  g.clip();
  const gloed = g.createRadialGradient(c.width * 0.85, 60, 0, c.width * 0.85, 60, 800);
  gloed.addColorStop(0, 'rgba(158, 5, 205, 0.30)');
  gloed.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = gloed;
  g.fillRect(0, 0, c.width, c.height);
  g.restore();
  const gloedKleur: Record<Status, string> = { groen: '#34d399', oranje: '#fbbf24', rood: '#fb7185' };
  tekst(g, 'Per filiaal', 70, 110, '600 60px Inter, sans-serif', '#ffffff');
  tekst(g, 'stuks YTD · groei t.o.v. vorig jaar', 72, 162, '400 34px Inter, sans-serif', '#a59fb8');
  const rij = [...f.winkels].sort((a, b) => b.stuks - a.stuks);
  const max = Math.max(...rij.map(w => w.stuks), 1);
  const bx = 470;
  const bb = 470;
  rij.forEach((w, i) => {
    const y = 270 + i * 98;
    const groei = w.stuks / w.vorig - 1;
    const kleur = gloedKleur[tint(groei)];
    tekst(g, `${i + 1}`, 70, y, '500 34px Inter, sans-serif', '#7f7896');
    tekst(g, w.naam, 125, y, '500 42px Inter, sans-serif', '#ece8f5');
    g.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ronde(g, bx, y - 24, bb, 18, 9);
    g.fill();
    const balk = g.createLinearGradient(bx, 0, bx + bb, 0);
    balk.addColorStop(0, '#881ee7');
    balk.addColorStop(1, kleur);
    g.fillStyle = balk;
    ronde(g, bx, y - 24, Math.max(18, (bb * w.stuks) / max), 18, 9);
    g.fill();
    tekst(g, getal(w.stuks), 1170, y, '500 42px Inter, sans-serif', '#ffffff', 'right');
    tekst(g, groeiTekst(groei), c.width - 70, y, '600 36px Inter, sans-serif', kleur, 'right');
  });
  return c;
}

export function maakProduct(wereld: Wereld, f: Fiche): Product {
  P = thema.donker ? DONKER : LICHT;
  // De avatar staat er altijd al voor een ruimte gebouwd wordt (app.ts maakt eerst de wereld en de avatar)
  const avatar = wereld.avatar!;
  const groep = new THREE.Group();
  // De deur 'verkoop' bestaat altijd
  groep.add(maakZaal(domeinen.find(d => d.id === 'verkoop')!, { bord: false }));
  const rijzers: THREE.Group[] = [];   // groepen die uit de vloer groeien
  const labels: CSS2DObject[] = [];    // labels die na de opbouw verschijnen
  const stations: StationDoel[] = [];

  function lbl(html: string, klasse: string, ouder: THREE.Object3D, x: number, y: number, z: number) {
    const l = label(html, klasse);
    l.position.set(x, y, z);
    ouder.add(l);
    labels.push(l);
    return l;
  }

  function blok(ouder: THREE.Object3D, b: number, h: number, y0: number, mat: THREE.Material, rond = false) {
    const geo = rond ? new THREE.CylinderGeometry(b / 2, b / 2, h, 32) : new THREE.BoxGeometry(b, h, b);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y0 + h / 2;
    ouder.add(schaduw(m));
    return m;
  }

  // Een zuil die uit de vloer groeit, met optioneel de zuil van vorig jaar en een statusring
  function zuil(
    ouder: THREE.Object3D, x: number, z: number, b: number, h: number, html: string,
    { rond = false, mat = materiaal(kleur.paars, 0.12), hVorig = null, st = null, klasse = 'waarde', lx = 0, lz = 0 }:
      { rond?: boolean; mat?: THREE.Material; hVorig?: number | null; st?: Status | null; klasse?: string; lx?: number; lz?: number } = {},
  ) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    ouder.add(g);
    blok(g, b, h, 0, mat, rond);
    if (hVorig !== null) {
      const vorig = new THREE.Mesh(
        rond ? new THREE.CylinderGeometry(b / 2 + 0.06, b / 2 + 0.06, hVorig, 32, 1, true) : new THREE.BoxGeometry(b + 0.12, hVorig, b + 0.12),
        new THREE.MeshStandardMaterial({ color: kleur.paarsLicht, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      );
      vorig.position.y = hVorig / 2;
      g.add(vorig);
    }
    if (st) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(b * 0.62, b * 0.62 + 0.12, 40), new THREE.MeshBasicMaterial({ color: statusKleur[st], side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.012;
      g.add(ring);
    }
    lbl(html, klasse, g, lx, Math.max(h, hVorig ?? 0) + 0.35, lz);
    rijzers.push(g);
    return g;
  }

  // Een station: een staand displaybord met een lichte rand, op twee pootjes. Alles erin is één klikbaar geheel.
  function station(s: StationDef) {
    const hoek = THREE.MathUtils.degToRad(s.graden);
    const g = new THREE.Group();
    g.position.set(s.afstand * Math.sin(hoek), 0, -s.afstand * Math.cos(hoek));
    g.rotation.y = -hoek;
    const doel: StationDoel = {
      ...s, groep: g,
      rand: new THREE.Mesh(
        new RoundedBoxGeometry(s.breedte + 0.14, s.hoogte + 0.14, 0.05, 3, 0.07),
        new THREE.MeshStandardMaterial({ color: 0xe7dcfb, emissive: 0x881ee7, emissiveIntensity: 0, roughness: 0.6 }),
      ),
    };
    g.userData.doel = doel;
    const y = 0.35 + s.hoogte / 2;
    doel.rand.position.set(0, y, -0.62);
    const bord = new THREE.Mesh(new RoundedBoxGeometry(s.breedte, s.hoogte, 0.08, 3, 0.05), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }));
    bord.position.set(0, y, -0.57);
    g.add(schaduw(doel.rand), schaduw(bord));
    for (const kant of [-1, 1]) {
      const poot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), materiaal(kleur.paarsDonker, 0.05));
      poot.position.set(kant * (s.breedte / 2 - 0.5), 0.18, -0.6);
      g.add(schaduw(poot));
    }
    if (s.nr !== 1) {
      const c = document.createElement('canvas');
      c.width = 2000;
      c.height = 160;
      tekenTitel(c.getContext('2d')!, s.nr, s.vraag, 30, 112, 1);
      const titel = new THREE.Mesh(new THREE.PlaneGeometry(s.breedte - 0.5, ((s.breedte - 0.5) * 160) / 2000), new THREE.MeshBasicMaterial({ map: textuur(c), transparent: true }));
      titel.position.set(0, 0.35 + s.hoogte - 0.32, -0.52);
      g.add(titel);
    }
    groep.add(g);
    stations.push(doel);
    return g;
  }

  // --- 1. Hoofdscherm, recht voor je ---
  const s1 = station(STATIONS[0]);
  const schermCanvas = document.createElement('canvas');
  tekenHoofdscherm(schermCanvas, f, null);
  const schermTex = textuur(schermCanvas);
  const scherm = new THREE.Mesh(
    new THREE.PlaneGeometry(STATIONS[0].breedte - 0.1, STATIONS[0].hoogte - 0.1),
    new THREE.MeshBasicMaterial({ map: schermTex }),
  );
  // De productfoto: zodra ze geladen is, het scherm opnieuw tekenen
  const foto = Object.assign(new Image(), { src: f.foto });
  foto.onload = () => {
    tekenHoofdscherm(schermCanvas, f, foto);
    schermTex.needsUpdate = true;
  };
  scherm.position.set(0, 0.35 + STATIONS[0].hoogte / 2, -0.52);
  s1.add(scherm);

  // --- 2. Over de tijd: omzet per maand als een reliëf in het verloop van het logo ---
  // Bij binnenkomen rijzen de maanden één voor één op (van januari naar september), daarna tekent
  // een gloeiende lijn zich over de top en popt per maand een lichtpunt met het bedrag op.
  // Vorig jaar is een doorschijnend lint ervoor; af en toe glijdt een glinstering over de lijn.
  const s2 = station(STATIONS[1]);
  const relief = new THREE.Group();
  const W = 6;
  relief.position.set(-W / 2, 0, -0.1);
  s2.add(relief);
  const maandCijfers = perMaand(f);
  const waarden = maandCijfers.map(m => m.omzet);
  const vorige = maandCijfers.map(m => m.vorig);
  const max = Math.max(...waarden, ...vorige);
  const BASIS = 0.5; // het reliëf staat op een sokkel, zodat de maandnamen er vrij onder staan
  const xVan = (i: number) => ((i + 0.5) / waarden.length) * W;   // elke maand in het midden van haar vak
  // De schaal start niet op nul maar net onder de zwakste maand, zodat de verschillen tussen maanden goed zichtbaar zijn
  // (de bedragen staan erbij, dus je leest de echte waarden)
  const laag = Math.min(...waarden, ...vorige) * 0.6;
  const yVan = (v: number) => BASIS + 0.25 + (1.45 * (v - laag)) / (max - laag);
  const D = 0.3;
  const zacht = (t: number) => 1 - (1 - t) ** 3;
  const klem = (t: number) => Math.max(0, Math.min(1, t));
  const N = 140; // aantal sneden over de breedte
  const kromme = (reeks: number[]) => new THREE.CatmullRomCurve3(reeks.map((v, i) => new THREE.Vector3(xVan(i), yVan(v), 0)), false, 'centripetal');
  const nu = kromme(waarden);
  const toen = kromme(vorige);
  const sneden = nu.getPoints(N);

  // Het reliëf zelf: per snede drie hoogtes (voet, schouder, top) voor- en achteraan, plus een bovenvlak.
  // De kleuren per hoogte geven het verloop: blauwviolet onderaan, magenta, en een roze glans bovenaan.
  const kleurVoet = new THREE.Color(0x2a07c9);
  const kleurMidden = new THREE.Color(0xa10fe0);
  const kleurTop = new THREE.Color(0xff8de0);
  const per = 3 * 2 + 2; // vooraan 3, achteraan 3, bovenvlak 2
  const posities = new Float32Array((N + 1) * per * 3);
  const kleuren = new Float32Array((N + 1) * per * 3);
  const index: number[] = [];
  const rijKleur = [kleurVoet, kleurMidden, kleurTop, kleurVoet, kleurMidden, kleurTop, kleurTop, kleurTop];
  for (let i = 0; i <= N; i++) rijKleur.forEach((c, j) => c.toArray(kleuren, (i * per + j) * 3));
  for (let i = 0; i < N; i++) {
    const a = i * per;
    const b = (i + 1) * per;
    for (const [o, omgekeerd] of [[0, false], [3, true]] as const) {
      for (let r = 0; r < 2; r++) {
        const v = [a + o + r, b + o + r, b + o + r + 1, a + o + r + 1];
        index.push(...(omgekeerd ? [v[0], v[2], v[1], v[0], v[3], v[2]] : [v[0], v[1], v[2], v[0], v[2], v[3]]));
      }
    }
    index.push(a + 6, b + 6, b + 7, a + 6, b + 7, a + 7); // bovenvlak
  }
  // Zijkanten links en rechts
  for (const [s, omgekeerd] of [[0, false], [N * per, true]] as const) {
    for (let r = 0; r < 2; r++) {
      const v = [s + r, s + r + 1, s + 3 + r + 1, s + 3 + r];
      index.push(...(omgekeerd ? [v[0], v[2], v[1], v[0], v[3], v[2]] : [v[0], v[1], v[2], v[0], v[2], v[3]]));
    }
  }
  const reliefGeo = new THREE.BufferGeometry();
  reliefGeo.setAttribute('position', new THREE.BufferAttribute(posities, 3));
  reliefGeo.setAttribute('color', new THREE.BufferAttribute(kleuren, 3));
  reliefGeo.setIndex(index);
  // themaVast: het verloop zit in de kleuren per punt; een donkere basiskleur zou het geheel dof maken
  const reliefMesh = schaduw(new THREE.Mesh(reliefGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.3, metalness: 0.1, emissive: 0x2a0a6a, emissiveIntensity: 0.15,
  })));
  reliefMesh.userData.themaVast = true;
  relief.add(reliefMesh);

  // De gloeiende lijn over de top, die zich na het oprijzen tekent
  const topLijn = new THREE.CatmullRomCurve3(sneden.map(p => new THREE.Vector3(p.x, p.y, D)));
  const lijnGeo = new THREE.TubeGeometry(topLijn, N * 2, 0.026, 8, false);
  lijnGeo.setDrawRange(0, 0);
  relief.add(new THREE.Mesh(lijnGeo, new THREE.MeshBasicMaterial({ color: 0xffd9f7 })));

  // Vorig jaar: een doorschijnend lint vóór het reliëf
  const lintPunten = toen.getPoints(N);
  const lintPos: number[] = [];
  lintPunten.forEach(p => lintPos.push(p.x, p.y - 0.022, D + 0.12, p.x, p.y + 0.022, D + 0.12));
  const lintIndex: number[] = [];
  for (let i = 0; i < N; i++) lintIndex.push(i * 2, i * 2 + 2, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 1);
  const lintGeo = new THREE.BufferGeometry();
  lintGeo.setAttribute('position', new THREE.Float32BufferAttribute(lintPos, 3));
  lintGeo.setIndex(lintIndex);
  const lint = new THREE.Mesh(lintGeo, new THREE.MeshBasicMaterial({ color: 0xe6d8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  relief.add(lint);

  // Een zachte lichtvlek, voor de maandpunten en de glinstering
  const vlek = (() => {
    const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
    const g = c.getContext('2d')!;
    const v = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    v.addColorStop(0, 'rgba(255, 255, 255, 1)');
    v.addColorStop(0.3, 'rgba(255, 190, 245, 0.75)');
    v.addColorStop(1, 'rgba(255, 120, 230, 0)');
    g.fillStyle = v;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const gloedMat = () => new THREE.SpriteMaterial({ map: vlek, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });

  // Per maand: een lichtpunt op de lijn met het bedrag erboven, en de maandnaam eronder
  const punten = waarden.map((v, i) => {
    const bol = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bol.userData.themaVast = true; // een lichtpunt blijft wit
    bol.position.set(xVan(i), yVan(v), D);
    bol.scale.setScalar(0.001);
    const halo = new THREE.Sprite(gloedMat());
    halo.position.copy(bol.position);
    halo.scale.setScalar(0.24);
    relief.add(bol, halo);
    // Het bedrag verschijnt pas als zijn punt oppopt (dus niet via lbl, dat alle labels samen laat verschijnen)
    const bedrag = label(euroKort(v), 'as bedrag');
    bedrag.position.set(xVan(i), yVan(v) + 0.2, D);
    bedrag.element.style.opacity = '0';
    relief.add(bedrag);
    lbl(maandCijfers[i].naam, 'as', relief, xVan(i), BASIS - 0.12, D);
    return { bol, halo, bedrag };
  });
  lbl(`<span class="legende"><i class="lijn"></i>dit jaar ${euroKort(f.omzet)} <i class="glas"></i>vorig jaar ${euroKort(f.omzetVorig)}</span>`, 'as', relief, W / 2, 2.8, D);

  // De glinstering die af en toe over de lijn glijdt
  const glinster = new THREE.Sprite(gloedMat());
  glinster.scale.setScalar(0.55);
  relief.add(glinster);

  // Opbouw: p gaat van 0 naar 1; de maanden rijzen als een golf van links naar rechts
  const opbouw = { p: 0, lijn: 0 };
  const x0 = sneden[0].x;
  const x1 = sneden[N].x;
  function bouwReliëf() {
    sneden.forEach((s, i) => {
      const t = (s.x - x0) / (x1 - x0);
      const groei = zacht(klem(opbouw.p * 1.8 - t * 0.8));
      const top = BASIS + (s.y - BASIS) * groei;
      const schouder = BASIS + (top - BASIS) * 0.55;
      const ys = [BASIS, schouder, top, BASIS, schouder, top, top, top];
      const zs = [D, D, D, 0, 0, 0, D, 0];
      ys.forEach((y, j) => posities.set([s.x, y, zs[j]], (i * per + j) * 3));
    });
    reliefGeo.attributes.position.needsUpdate = true;
    reliefGeo.computeVertexNormals();
    reliefGeo.computeBoundingSphere();
  }
  bouwReliëf();

  function speelTijd() {
    opbouw.p = 0;
    opbouw.lijn = 0;
    bouwReliëf();
    lijnGeo.setDrawRange(0, 0);
    lint.material.opacity = 0;
    punten.forEach(({ bol, halo, bedrag }) => {
      bol.scale.setScalar(0.001);
      halo.material.opacity = 0;
      bedrag.element.style.opacity = '0';
    });
    gsap.to(opbouw, { p: 1, duration: duur(2.2), delay: duur(0.4), ease: 'none', onUpdate: bouwReliëf });
    gsap.to(opbouw, {
      lijn: 1, duration: duur(1.4), delay: duur(1.9), ease: 'power2.inOut',
      onUpdate: () => lijnGeo.setDrawRange(0, Math.floor((lijnGeo.index!.count * opbouw.lijn) / 6) * 6),
    });
    gsap.to(lint.material, { opacity: 0.8, duration: duur(0.8), delay: duur(2.6) });
    punten.forEach(({ bol, halo, bedrag }, i) => {
      const wanneer = 2.0 + (i / (punten.length - 1)) * 1.3;
      gsap.to(bol.scale, { x: 1, y: 1, z: 1, duration: duur(0.45), delay: duur(wanneer), ease: 'back.out(3)' });
      gsap.to(halo.material, { opacity: 0.75, duration: duur(0.45), delay: duur(wanneer) });
      gsap.to(bedrag.element, { opacity: 1, duration: duur(0.4), delay: duur(wanneer + 0.1) });
    });
  }

  // Elk beeldje: de glinstering glijdt elke 6 seconden in 2 seconden over de lijn
  function glinsterOp(t: number) {
    const f = ((t % 6) / 2);
    glinster.visible = opbouw.lijn >= 1 && f < 1;
    if (!glinster.visible) return;
    glinster.position.copy(topLijn.getPointAt(f));
    glinster.material.opacity = Math.sin(Math.PI * f);
  }

  // --- 3. Waar verkocht: stuks per kanaal en de winkelkaart ---
  const s3 = station(STATIONS[2]);
  const kanaalNamen = (Object.keys(f.stuksKanaal) as Kanaal[]).sort((x, y) => f.stuksKanaal[y] - f.stuksKanaal[x]);
  const maxKanaal = Math.max(...kanaalNamen.flatMap(k => [f.stuksKanaal[k], f.stuksKanaalVorig[k]]), 1);
  kanaalNamen.forEach((k, i) => {
    const v = f.stuksKanaal[k];
    const vv = f.stuksKanaalVorig[k];
    const g = v / vv - 1;
    const st = tint(g);
    zuil(s3, -3.15 + i * 1.2, 0, 0.62, 0.15 + (1.7 * v) / maxKanaal,
      `<span class="getal">${kort(v)}</span><span class="groei ${st}">${groeiTekst(g)}</span><small>${k}</small>`,
      { hVorig: 0.15 + (1.7 * vv) / maxKanaal, st });
  });
  // Rechts: een donker paneel met de ranking per filiaal, in dezelfde stijl als de filialenkaart in Verkoop
  const paneel = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2.6), new THREE.MeshBasicMaterial({ map: textuur(tekenFilialen(f)), transparent: true }));
  paneel.position.set(1.95, 0.35 + 1.45, -0.5);
  s3.add(paneel);

  // --- 4. Marge: vitrine met het product en de prijsopbouw per stuk ---
  const s4 = station(STATIONS[3]);
  const sokkel = schaduw(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.9, 64), new THREE.MeshStandardMaterial({ color: 0xfbf9fa, roughness: 0.5 })));
  sokkel.position.set(-2.1, 0.45, 0);
  const rand = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.015, 8, 96), new THREE.MeshBasicMaterial({ color: kleur.paars }));
  rand.rotation.x = Math.PI / 2;
  rand.position.set(-2.1, 0.9, 0);
  // Het product zelf zweeft boven de sokkel: de productfoto, altijd naar je toe gedraaid
  const fotoTex = new THREE.TextureLoader().load(f.foto, t => {
    // Breedte en hoogte volgen de verhouding van de foto
    potje.scale.set(1.1 * (t.image.width / t.image.height), 1.1, 1);
  });
  fotoTex.colorSpace = THREE.SRGBColorSpace;
  const potje = new THREE.Sprite(new THREE.SpriteMaterial({ map: fotoTex, transparent: true }));
  potje.scale.set(1.1, 1.1, 1);
  potje.position.set(-2.1, 1.5, 0);
  s4.add(sokkel, rand, potje);
  const pk = 2.3 / f.catalogusprijs;
  const kostH = f.kostprijs * pk;
  const margeH = f.margePerStuk * pk;
  zuil(s4, -0.4, 0, 0.6, kostH, `<small>Kostprijs</small><span class="getal">${euro(f.kostprijs)}</span>`, { mat: materiaal(0xddd3f3, 0.05) });
  const verkoop = zuil(s4, 0.8, 0, 0.6, kostH, `<small>Verkoopprijs gem.</small><span class="getal">${euro(f.verkoopprijs)}</span>`, { mat: materiaal(0xddd3f3, 0.05) });
  // Het label van de zuil is er altijd (zuil maakt het via lbl)
  verkoop.children.find(c => (c as THREE.Object3D & { isCSS2DObject?: boolean }).isCSS2DObject)!.position.y = kostH + margeH + 0.35;
  blok(verkoop, 0.6, margeH, kostH, materiaal(kleur.paars, 0.2));
  lbl(`Marge ${euro(f.margePerStuk)}`, 'marge', verkoop, 0, kostH + margeH / 2, 0.4);
  const catMat = new THREE.MeshStandardMaterial({ color: kleur.paarsLicht, emissive: kleur.paarsLicht, emissiveIntensity: 0.1, transparent: true, opacity: 0.25 });
  const cat = zuil(s4, 2.0, 0, 0.6, f.catalogusprijs * pk, `<small>Catalogusprijs</small><span class="getal">${euro(f.catalogusprijs)}</span>`, { mat: catMat });
  const randen = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.6, f.catalogusprijs * pk, 0.6)), new THREE.LineBasicMaterial({ color: kleur.paars }));
  randen.position.y = (f.catalogusprijs * pk) / 2;
  cat.add(randen);

  // --- Inzoomen: draai naar het station, laat de avatar het aanwijzen en open de 2D-kaart ---
  const yawVoor = (s: StationDoel) => Math.atan2(s.groep.position.x - SCHOUDER[0], SCHOUDER[1] - s.groep.position.z);
  const midden = (s: StationDoel) => s.groep.localToWorld(new THREE.Vector3(0, 1.8, -0.5));
  // De kaarten tonen het nummer als tekst
  const detail = maakDetail(productKaarten(f, STATIONS.map(s => ({ ...s, nr: String(s.nr) }))), {
    opWissel: i => {
      wereld.draaiNaar(yawVoor(stations[i]));
      avatar.kijkNaar(midden(stations[i]));
    },
    opSluiten: () => avatar.kijkNaar(null),
  });
  let gehoverd: StationDoel | null = null;
  let bezig = false;

  return {
    groep,
    mist: 0.01,
    schouder: SCHOUDER,
    pitch: -0.06,
    hint: 'Klik op een station om in te zoomen. Sleep om rond te kijken.',
    klikbaar: stations.map(s => s.groep),

    hover(doel) {
      if (gehoverd) gsap.to(gehoverd.rand.material, { emissiveIntensity: 0, duration: duur(0.3) });
      gehoverd = doel;
      if (doel) gsap.to(doel.rand.material, { emissiveIntensity: 0.6, duration: duur(0.3) });
      if (!detail.isOpen) avatar.kijkNaar(doel ? midden(doel) : null);
    },

    async klik(doel) {
      if (bezig || detail.isOpen) return;
      bezig = true;
      wereld.draaiNaar(yawVoor(doel));
      await avatar.wijs(midden(doel));
      await new Promise(res => setTimeout(res, duur(0.35) * 1000));
      detail.open(stations.indexOf(doel));
      bezig = false;
    },

    start() {
      rijzers.forEach((g, i) => {
        g.scale.y = 0.001;
        gsap.to(g.scale, { y: 1, duration: duur(0.9), delay: duur(0.3 + i * 0.05), ease: 'power3.out' });
      });
      labels.forEach((l, i) => {
        l.element.style.opacity = '0';
        gsap.to(l.element, { opacity: 1, duration: duur(0.6), delay: duur(1.0 + i * 0.02) });
      });
      // Station 2 bouwt zich op: de maanden rijzen, de lijn tekent zich, de punten poppen op
      speelTijd();
      // De avatar reageert op hoe het product het doet
      gsap.delayedCall(duur(1.6), () => {
        avatar.reageer(f.status ?? 'oranje');
      });
    },

    // Opruimen bij het verlaten van de ruimte: de 2D-kaart mag niet blijven hangen
    opruimen() {
      detail.vernietig();
    },

    update(t) {
      potje.position.y = 1.5 + Math.sin(t * 1.2) * 0.04;
      glinsterOp(t);
    },
  };
}
