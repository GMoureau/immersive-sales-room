// De lobby: een ruimte met muren, een bedrijfslogo en wat aankleding.
// De avatar zit in een loungezetel; in de achterwand zit een deur per domein, met een icoon en de naam op de deur.
// Het licht onder de deur toont de status. De deuren komen van de app (domeinen), met de status uit het model.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { gsap } from 'gsap';
import { kleur, materiaal, schaduw, gloedTextuur, duur, type Wereld } from './scene';
import { muurMat, metaal, textuur, tekst, iconen, maakPlant, maakLogo, maakWerf, type Werf } from './decor';
import type { Domein } from './domeinen';
import type { Avatar, CameraDoel, Ruimte } from './types';

type DeurStatus = Domein['status'];

/** The lobby as the app uses it: a room with doors, plus a hint and a reset. */
export interface Lobby extends Ruimte {
  hint: string;
  cameraDoel(): CameraDoel;
  hover(doel: Domein | null): void;
  klik(doel: Domein): Promise<void>;
  reset(): void;
  update(t: number): void;
}

export interface LobbyOpties {
  domeinen: readonly Domein[];
  opOpenen: (id: string) => void;
  schuif?: number;
}

interface Deur {
  domein: Domein;
  groep: THREE.Group;
  scharnier: THREE.Group;
  kader: THREE.MeshStandardMaterial;
  vlek: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  herteken: (uitleg: string) => void;
  werf?: Werf;
}

// 'binnenkort': een domein dat nog niet gebouwd is, zonder status
const statusKleur: Record<DeurStatus, number> = { groen: kleur.groen, oranje: kleur.oranje, rood: kleur.rood, binnenkort: 0xa3a3ad };
const statusTekst: Record<DeurStatus, string> = { groen: 'Loopt goed', oranje: 'Opletten', rood: 'Actie nodig', binnenkort: 'Binnenkort' };
const B = 1.9;            // breedte van een deur
const H = 3.2;            // hoogte van een deur
const KADER = 0.06;       // breedte van het kozijn
const TUSSEN = 4.2;       // afstand tussen de deuren
const BREEDTE = 18;       // breedte van de lobby
const HOOGTE = 5.2;       // hoogte van de muren
const DIEPTE = 13;        // hoe ver de zijmuren naar voren komen
const MUUR = 0.4;         // dikte van de achterwand
const STOEL = { x: 0, z: 6 };

// De voorkant van een deur: twee ingelegde panelen, een icoon, de naam, de status en een korte uitleg
function tekenDeur(canvas: HTMLCanvasElement, domein: Domein, uitleg: string): void {
  const g = canvas.getContext('2d')!;
  const W = canvas.width;
  g.fillStyle = '#f7f6fb';
  g.fillRect(0, 0, W, canvas.height);
  const paneel = (x: number, y: number, w: number, h: number): void => {
    g.lineWidth = 5;
    g.strokeStyle = '#e2dff0';
    g.strokeRect(x, y, w, h);
    g.strokeStyle = '#ffffff';
    g.beginPath();
    g.moveTo(x + 4, y + h - 4);
    g.lineTo(x + 4, y + 4);
    g.lineTo(x + w - 4, y + 4);
    g.stroke();
  };
  paneel(70, 70, W - 140, 470);
  paneel(70, 600, W - 140, 340);

  g.strokeStyle = '#881ee7';
  g.fillStyle = '#881ee7';
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  iconen[domein.id]?.(g, W / 2, 190);

  tekst(g, domein.naam, W / 2, 360, '400 78px Inter, sans-serif', '#0f1013', 'center');
  const label = statusTekst[domein.status];
  g.font = '500 34px Inter, sans-serif';
  const breedte = g.measureText(label).width + 34;
  g.fillStyle = `#${new THREE.Color(statusKleur[domein.status]).getHexString()}`;
  g.beginPath();
  g.arc(W / 2 - breedte / 2 + 9, 420, 10, 0, Math.PI * 2);
  g.fill();
  tekst(g, label, W / 2 - breedte / 2 + 30, 432, '500 34px Inter, sans-serif', '#0f1013');
  tekst(g, uitleg, W / 2, 490, '400 28px Inter, sans-serif', '#565759', 'center');
  if (domein.status === 'binnenkort') tekenAfzetlint(g, W, canvas.height);
}

// A door that is not part of the demo: a striped barrier tape across the lower panel,
// with "UNDER CONSTRUCTION" and a line saying only Verkoop is open
function tekenAfzetlint(g: CanvasRenderingContext2D, W: number, H: number): void {
  g.save();
  g.translate(W / 2, H * 0.74);
  g.rotate(-0.22);
  const b = W * 1.5;
  const h = 120;
  g.beginPath();
  g.rect(-b / 2, -h / 2, b, h);
  g.clip();
  g.fillStyle = '#facc15';
  g.fillRect(-b / 2, -h / 2, b, h);
  g.fillStyle = '#0f1013';
  for (let x = -b / 2 - h; x < b / 2 + h; x += 70) {
    g.beginPath();
    g.moveTo(x, h / 2);
    g.lineTo(x + 35, h / 2);
    g.lineTo(x + 35 + h, -h / 2);
    g.lineTo(x + h, -h / 2);
    g.closePath();
    g.fill();
  }
  g.fillStyle = '#facc15';
  g.fillRect(-235, -38, 470, 76);
  tekst(g, 'UNDER CONSTRUCTION', 0, 14, '700 40px Inter, sans-serif', '#0f1013', 'center');
  g.restore();
  tekst(g, 'In deze demo werkt alleen Verkoop', W / 2, H * 0.74 + 150, '500 28px Inter, sans-serif', '#565759', 'center');
}

function maakDeur(domein: Domein): Deur {
  const groep = new THREE.Group();
  const sk = statusKleur[domein.status];

  // Fijn kozijn, net iets naar voren uit de muur
  const kader = materiaal(kleur.paarsDonker, 0.1);
  const stijl = new THREE.BoxGeometry(KADER, H + KADER, MUUR + 0.04);
  const links = new THREE.Mesh(stijl, kader);
  links.position.set(-B / 2 - KADER / 2, H / 2, -MUUR / 2 + 0.02);
  const rechts = new THREE.Mesh(stijl, kader);
  rechts.position.set(B / 2 + KADER / 2, H / 2, -MUUR / 2 + 0.02);
  const boven = new THREE.Mesh(new THREE.BoxGeometry(B + KADER * 2, KADER, MUUR + 0.04), kader);
  boven.position.set(0, H + KADER / 2, -MUUR / 2 + 0.02);
  groep.add(links, rechts, boven);

  // Deurblad met icoon en naam; draait rond een scharnier aan de linkerkant
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = Math.round((600 * H) / B);
  tekenDeur(canvas, domein, domein.uitleg);
  const tex = textuur(canvas);
  const zijkant = new THREE.MeshStandardMaterial({ color: 0xe4e2ec, roughness: 0.5 });
  const voorkant = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
  const scharnier = new THREE.Group();
  scharnier.position.set(-B / 2, 0, 0);
  scharnier.userData.doel = domein;
  scharnier.userData.themaVast = true; // het deurblad blijft licht, ook in de donkere modus
  const blad = new THREE.Mesh(new THREE.BoxGeometry(B, H, 0.05), [zijkant, zijkant, zijkant, zijkant, voorkant, zijkant]);
  blad.position.set(B / 2, H / 2, 0);
  // Strakke deurkruk: een rozet en een hendel naar het scharnier toe
  const rozet = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 24), metaal());
  rozet.rotation.x = Math.PI / 2;
  rozet.position.set(B - 0.16, H / 2 - 0.1, 0.032);
  const hendel = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.12, 4, 10), metaal());
  hendel.rotation.z = Math.PI / 2;
  hendel.position.set(B - 0.22, H / 2 - 0.1, 0.065);
  const steel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 10), metaal());
  steel.rotation.x = Math.PI / 2;
  steel.position.set(B - 0.16, H / 2 - 0.1, 0.05);
  scharnier.add(blad, rozet, steel, hendel);
  groep.add(scharnier);
  schaduw(groep);

  // Gekleurd licht dat onder de deur door schijnt, met een zachte vlek op de vloer
  const spleet = new THREE.Mesh(new THREE.BoxGeometry(B - 0.1, 0.025, 0.04), new THREE.MeshBasicMaterial({ color: sk }));
  spleet.position.set(0, 0.0125, 0.04);
  const vlek = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 2.6),
    new THREE.MeshBasicMaterial({ map: gloedTextuur(), color: sk, transparent: true, opacity: 0.4, depthWrite: false }),
  );
  vlek.rotation.x = -Math.PI / 2;
  vlek.position.set(0, 0.01, 0.8);
  groep.add(spleet, vlek);

  const herteken = (uitleg: string): void => { tekenDeur(canvas, domein, uitleg); tex.needsUpdate = true; };
  return { domein, groep, scharnier, kader, vlek, herteken };
}

// Achterwand met drie deuropeningen, zijmuren en plinten
function maakMuren(domeinen: readonly Domein[]): THREE.Group {
  const muren = new THREE.Group();
  const vorm = new THREE.Shape();
  vorm.moveTo(-BREEDTE / 2, 0);
  vorm.lineTo(BREEDTE / 2, 0);
  vorm.lineTo(BREEDTE / 2, HOOGTE);
  vorm.lineTo(-BREEDTE / 2, HOOGTE);
  vorm.closePath();
  domeinen.forEach((_, i) => {
    const x = (i - (domeinen.length - 1) / 2) * TUSSEN;
    // Het gat is 1 cm ruimer dan de deur: zo zit de rand van de muur verstopt achter het kozijn.
    // Lagen ze exact op elkaar, dan flikkerde de spleet zwart-wit zodra de deur op een kier ging.
    const R = 0.01;
    const gat = new THREE.Path();
    gat.moveTo(x - B / 2 - R, 0);
    gat.lineTo(x - B / 2 - R, H + R);
    gat.lineTo(x + B / 2 + R, H + R);
    gat.lineTo(x + B / 2 + R, 0);
    gat.closePath();
    vorm.holes.push(gat);
  });
  const achter = new THREE.Mesh(new THREE.ExtrudeGeometry(vorm, { depth: MUUR, bevelEnabled: false }), muurMat());
  achter.position.z = -MUUR;

  const plint = materiaal(kleur.paarsDonker, 0.05);
  for (const kant of [-1, 1]) {
    const zij = new THREE.Mesh(new THREE.BoxGeometry(0.3, HOOGTE, DIEPTE), muurMat());
    zij.position.set(kant * (BREEDTE / 2 + 0.15), HOOGTE / 2, DIEPTE / 2 - MUUR);
    const zijPlint = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, DIEPTE), plint);
    zijPlint.position.set(kant * (BREEDTE / 2 - 0.015), 0.05, DIEPTE / 2 - MUUR);
    muren.add(zij, zijPlint);
  }
  // Plint langs de achterwand, onderbroken door de deuren
  const randen = [-BREEDTE / 2, ...domeinen.flatMap((_, i) => { const x = (i - 1) * TUSSEN; return [x - B / 2 - KADER, x + B / 2 + KADER]; }), BREEDTE / 2];
  for (let i = 0; i < randen.length; i += 2) {
    const b = randen[i + 1] - randen[i];
    const p = new THREE.Mesh(new THREE.BoxGeometry(b, 0.1, 0.03), plint);
    p.position.set(randen[i] + b / 2, 0.05, 0.015);
    muren.add(p);
  }
  muren.add(achter);
  return schaduw(muren);
}

// Waterkoeler met een blauwe fles bovenop
function maakWaterkoeler(x: number, z: number): THREE.Group {
  const koeler = new THREE.Group();
  const wit = new THREE.MeshStandardMaterial({ color: 0xfbfbfd, roughness: 0.35 });
  const romp = new THREE.Mesh(new RoundedBoxGeometry(0.38, 1.0, 0.38, 3, 0.04), wit);
  romp.position.y = 0.5;
  const paneel = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.32, 0.02, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x27282b, roughness: 0.4 }));
  paneel.position.set(0, 0.72, 0.19);
  const kraantjes = [[-0.07, 0xef4444], [0.07, 0x3b82f6]].map(([dx, k]) => {
    const kraan = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12), new THREE.MeshStandardMaterial({ color: k, roughness: 0.4 }));
    kraan.rotation.x = Math.PI / 2;
    kraan.position.set(dx, 0.8, 0.215);
    return kraan;
  });
  const lekbak = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.025, 0.08, 2, 0.008), metaal());
  lekbak.position.set(0, 0.6, 0.22);
  const kraag = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 32), wit);
  kraag.position.y = 1.025;
  const profiel = [[0, 0], [0.03, 0], [0.03, 0.06], [0.15, 0.13], [0.16, 0.18], [0.16, 0.5], [0.14, 0.55], [0, 0.56]].map(([a, b]) => new THREE.Vector2(a, b));
  const fles = new THREE.Mesh(new THREE.LatheGeometry(profiel, 40), new THREE.MeshStandardMaterial({ color: 0x9cc9f0, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.55 }));
  fles.position.y = 1.03;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.28, 32), new THREE.MeshStandardMaterial({ color: 0x5aa7e6, roughness: 0.1, transparent: true, opacity: 0.45 }));
  water.position.y = 1.03 + 0.32;
  const bekers = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.22, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.85 }));
  bekers.position.set(0.23, 0.62, 0.05);
  koeler.add(romp, paneel, ...kraantjes, lekbak, kraag, fles, water, bekers);
  koeler.position.set(x, 0, z);
  return schaduw(koeler);
}

// Abstract kunstwerk voor een zijmuur: een paar vormen die aan grafieken doen denken
function maakKunst(kant: number): THREE.Group {
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 800;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fafafc';
  g.fillRect(0, 0, 600, 800);
  const tinten = ['#5104d2', '#881ee7', '#9e05cd', '#8fd6b4'];
  [380, 260, 520, 180].forEach((h, i) => {
    g.fillStyle = tinten[i];
    g.fillRect(80 + i * 115, 700 - h, 80, h);
  });
  g.strokeStyle = '#0f1013';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(420, 200, 110, Math.PI * 0.9, Math.PI * 2.1);
  g.stroke();
  const kunst = new THREE.Group();
  const lijst = new THREE.Mesh(new RoundedBoxGeometry(1.8, 2.4, 0.06, 2, 0.015), materiaal(kleur.paarsDonker, 0.05));
  const doek = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 2.24), new THREE.MeshStandardMaterial({ map: textuur(c), roughness: 0.9 }));
  doek.position.z = 0.032;
  kunst.add(schaduw(lijst), doek);
  kunst.position.set(kant * (BREEDTE / 2 - 0.04), 2.5, 2.6);
  kunst.rotation.y = -kant * Math.PI / 2;
  return kunst;
}

// Loungezetel met afgeronde kussens en naden; de rugleuning staat achter de avatar
function maakZetel(): THREE.Group {
  const zetel = new THREE.Group();
  const stof = materiaal(0x5b2bc9, 0.04);
  stof.roughness = 0.9;
  const kussen = materiaal(0x7b4fe0, 0.04);
  kussen.roughness = 0.95;
  const onderstel = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.2, 0.88, 3, 0.04), stof);
  onderstel.position.set(0, 0.22, 0.12);
  const achterkant = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.66, 0.12, 3, 0.04), stof);
  achterkant.position.set(0, 0.58, 0.52);
  zetel.add(onderstel, achterkant);
  for (const kant of [-1, 1]) {
    const zit = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.13, 0.72, 4, 0.05), kussen);
    zit.position.set(kant * 0.205, 0.385, 0.08);
    const rug = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.42, 0.14, 4, 0.06), kussen);
    rug.position.set(kant * 0.205, 0.68, 0.42);
    rug.rotation.x = -0.14;
    const leuning = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.4, 0.88, 3, 0.05), stof);
    leuning.position.set(kant * 0.475, 0.42, 0.12);
    zetel.add(zit, rug, leuning);
  }
  for (const [x, z] of [[-0.46, -0.24], [0.46, -0.24], [-0.46, 0.5], [0.46, 0.5]]) {
    const poot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.014, 0.12, 12), metaal());
    poot.position.set(x, 0.06, z);
    zetel.add(poot);
  }
  return schaduw(zetel);
}

// Rond tapijt met een fijn patroon en een duidelijke boord
function maakTapijt(): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f0fc';
  g.fillRect(0, 0, 1024, 1024);
  g.translate(512, 512);
  g.fillStyle = '#c4a3f3';
  g.beginPath();
  g.arc(0, 0, 512, 0, Math.PI * 2);
  g.arc(0, 0, 470, 0, Math.PI * 2, true);
  g.fill();
  g.strokeStyle = '#9e05cd';
  g.lineWidth = 3;
  for (const r of [450, 300, 150]) {
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  }
  // Fijne stippen in ringen
  g.fillStyle = '#ddd0f5';
  for (let r = 180; r < 440; r += 34) {
    const n = Math.floor((2 * Math.PI * r) / 26);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.beginPath();
      g.arc(Math.cos(a) * r, Math.sin(a) * r, 3.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  const boven = new THREE.MeshStandardMaterial({ map: textuur(c), roughness: 1 });
  const rand = new THREE.MeshStandardMaterial({ color: 0xc4a3f3, roughness: 1 });
  const tapijt = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.02, 96), [rand, boven, rand]);
  tapijt.position.set(STOEL.x, 0.01, STOEL.z);
  tapijt.receiveShadow = true;
  return tapijt;
}

// Bijzettafeltje met een lampje
function maakBijzettafel(x: number, z: number): THREE.Group {
  const tafel = new THREE.Group();
  const blad = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.29, 0.035, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
  blad.position.y = 0.52;
  const randje = new THREE.Mesh(new THREE.TorusGeometry(0.297, 0.006, 6, 64), metaal());
  randje.rotation.x = Math.PI / 2;
  randje.position.y = 0.538;
  const voet = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 12), metaal());
  voet.position.y = 0.26;
  const sokkel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.025, 32), metaal());
  sokkel.position.y = 0.0125;
  const lampVoet = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.22, 24), metaal());
  lampVoet.position.set(0.06, 0.65, 0);
  const kap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 24), new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffe2a8, emissiveIntensity: 0.8 }));
  kap.position.set(0.06, 0.86, 0);
  tafel.add(blad, randje, voet, sokkel, lampVoet, kap);
  tafel.position.set(x, 0, z);
  return schaduw(tafel);
}

// schuif: de camera schuift zoveel naar links, zodat de lobby rechts in beeld staat (voor een hero met tekst links)
export function maakLobby(wereld: Wereld, avatar: Avatar, { domeinen, opOpenen, schuif = 0 }: LobbyOpties): Lobby {
  const groep = new THREE.Group();
  // Het bedrijfslogo links van de eerste deur
  const logo = maakLogo();
  logo.position.set(-6.9, 2.75, 0);
  groep.add(maakMuren(domeinen), logo, maakKunst(-1), maakKunst(1), maakWaterkoeler(-8.2, 0.75));
  // Drie planten samen in de rechterhoek, in verschillende groottes
  groep.add(maakPlant(7.4, 1.0, 1, 1.05), maakPlant(8.35, 1.95, 2, 0.8), maakPlant(8.3, 0.6, 3, 0.62));
  const zetel = maakZetel();
  zetel.position.set(STOEL.x, 0, STOEL.z);
  // De zetel staat omgedraaid: de avatar kijkt de bezoeker aan, met de deuren achter zich
  zetel.rotation.y = Math.PI;
  groep.add(maakTapijt(), zetel, maakBijzettafel(STOEL.x + 1.15, STOEL.z + 0.1));

  const deuren = domeinen.map((d, i) => {
    const deur = maakDeur(d);
    deur.groep.position.x = (i - (domeinen.length - 1) / 2) * TUSSEN;
    // Achter een deur die nog niet klaar is, ligt een werf
    if (!d.open) {
      deur.werf = maakWerf(B, H);
      deur.groep.add(deur.werf.groep);
    }
    groep.add(deur.groep);
    return deur;
  });
  const deurVan = (doel: Domein): Deur => deuren.find(d => d.domein === doel)!;
  let bezig = false;
  const wacht = (s: number): Promise<void> => new Promise(r => setTimeout(r, duur(s) * 1000));

  // Een deur die nog niet klaar is: de avatar gaat kijken, opent de deur en ziet de werf
  // ("Under construction"), krabt in zijn krullen en gaat terug in de zetel zitten
  async function bezoekWerf(deur: Deur): Promise<void> {
    bezig = true;
    const x = deur.groep.position.x;
    const kant = x < 0 ? -1 : 1; // links of rechts rond de zetel, naar de kant van de deur
    gsap.to(deur.scharnier.rotation, { y: 0, duration: duur(0.2), overwrite: true });
    await avatar.staOp();
    avatar.kijkNaar(null);
    const omweg = [
      new THREE.Vector3(STOEL.x, 0, STOEL.z + 0.85),
      new THREE.Vector3(STOEL.x + kant * 1.25, 0, STOEL.z + 0.4),
      new THREE.Vector3(STOEL.x + kant * 1.25, 0, STOEL.z - 1.1),
    ];
    await avatar.loop([...omweg, new THREE.Vector3(x + 0.1, 0, 1.7)]);

    // Deur open, het lint spant zich over de opening
    const werf = deur.werf!; // deze deur is niet open, dus er ligt een werf achter
    werf.groep.visible = true;
    await gsap.to(deur.scharnier.rotation, { y: 1.6, duration: duur(0.7), ease: 'power2.inOut' });
    werf.linten.forEach((lint, i) => gsap.to(lint.scale, { x: 1, duration: duur(0.45), delay: duur(i * 0.15), ease: 'back.out(1.6)' }));
    avatar.kijkNaar(werf.bordje.getWorldPosition(new THREE.Vector3()));
    await wacht(0.7);
    avatar.reageer('rood'); // krabt in zijn krullen
    await wacht(2.6);

    // Lint weg, deur dicht, terug naar de zetel
    avatar.kijkNaar(null);
    werf.linten.forEach(lint => gsap.to(lint.scale, { x: 0.001, duration: duur(0.25) }));
    await gsap.to(deur.scharnier.rotation, { y: 0, duration: duur(0.6), delay: duur(0.15), ease: 'power2.inOut' });
    werf.groep.visible = false;
    await avatar.loop([...omweg].reverse().concat(new THREE.Vector3(STOEL.x, 0, STOEL.z + 0.35)));
    avatar.richt(0);
    await wacht(0.35);
    avatar.zet(STOEL.x, STOEL.z, 0);
    avatar.zitNeer();
    bezig = false;
  }

  return {
    groep,
    mist: 0.02,
    hint: 'In deze demo is alleen Verkoop open. Het licht onder de deur toont hoe het ervoor staat.',
    klikbaar: deuren.map(d => d.scharnier),

    // Schuin achter de avatar, met de deuren en het logo in beeld.
    // Op een smal, staand scherm gaat de camera verder achteruit zodat de drie deuren toch passen.
    cameraDoel() {
      const p = avatar.positie;
      const halveBreedte = Math.atan(Math.tan(THREE.MathUtils.degToRad(wereld.camera.fov / 2)) * wereld.camera.aspect);
      const extra = Math.max(0, 6.2 / Math.tan(halveBreedte) - 12.8);
      return { pos: [p.x * 0.6 + 1.4 - schuif, 3.9 + extra * 0.45, p.z + 6.8 + extra], kijk: [p.x * 0.7 - schuif, 1.7 - extra * 0.1, p.z - 4] };
    },

    hover(doel: Domein | null) {
      if (bezig) return;
      for (const d of deuren) {
        const aan = d.domein === doel;
        gsap.to(d.scharnier.rotation, { y: aan ? 0.14 : 0, duration: duur(0.5), ease: 'power2.out', overwrite: true });
        gsap.to(d.kader, { emissiveIntensity: aan ? 0.6 : 0.1, duration: duur(0.4), overwrite: true });
      }
    },

    async klik(doel: Domein) {
      if (bezig) return;
      const deur = deurVan(doel);
      if (!doel.open) return bezoekWerf(deur);
      bezig = true;
      const x = deur.groep.position.x;
      gsap.to(deur.scharnier.rotation, { y: 0, duration: duur(0.2), overwrite: true });
      await avatar.staOp();
      avatar.kijkNaar(null);
      // Uit de zetel naar voren, er links omheen, en dan naar de deur
      await avatar.loop([
        new THREE.Vector3(STOEL.x, 0, STOEL.z + 0.85),
        new THREE.Vector3(STOEL.x - 1.25, 0, STOEL.z + 0.4),
        new THREE.Vector3(STOEL.x - 1.25, 0, STOEL.z - 1.1),
        new THREE.Vector3(x, 0, 1.8),
        new THREE.Vector3(x + 0.1, 0, 0.8),
      ]);
      await gsap.to(deur.scharnier.rotation, { y: 1.6, duration: duur(0.7), ease: 'power2.inOut' });
      await avatar.loop([new THREE.Vector3(x + 0.1, 0, -1.4)]);
      bezig = false;
      opOpenen(doel.id);
    },

    // Terug naar het begin: deuren dicht, avatar in de zetel
    reset() {
      for (const d of deuren) {
        d.scharnier.rotation.y = 0;
        d.kader.emissiveIntensity = 0.1;
        d.herteken(d.domein.uitleg);
        if (d.werf) {
          d.werf.groep.visible = false;
          d.werf.linten.forEach(lint => { lint.scale.x = 0.001; });
        }
      }
      avatar.zet(STOEL.x, STOEL.z, 0);
      avatar.zitNeer();
    },

    update(t: number) {
      deuren.forEach((d, i) => { d.vlek.material.opacity = 0.32 + 0.1 * Math.sin(t * 1.5 + i * 2); });
      // Zolang hij zit, kijkt hij de bezoeker aan; de camera volgt de muis, dus zijn blik ook
      if (!bezig) avatar.kijkNaar(wereld.camera.position);
    },
  };
}
