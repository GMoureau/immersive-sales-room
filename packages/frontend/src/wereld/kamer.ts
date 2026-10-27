// Een ronde zaal voor een domein (Verkoop, later Financiën en HR): een gebogen muur rondom,
// de deur waar je binnenkwam achter je, een naambord met icoon, een lichtring en een podium onder de grafieken.
// De kijker staat in het midden; de grafieken staan in een boog voor hem.
import * as THREE from 'three';
import { kleur, materiaal, schaduw } from './scene';
import { muurMat, metaal, textuur, tekst, iconen, maakPlant, maakLogo } from './decor';
import type { Domein } from './domeinen';

/** What a room needs from its domain: the id (for the icon) and the name (default title). */
export type ZaalDomein = Pick<Domein, 'id' | 'naam'>;

export interface ZaalOpties {
  titel?: string;
  bord?: { graden: number; y: number } | false;
}

const STRAAL = 13;   // straal van de muur
const HOOGTE = 7.2;  // hoogte van de muur (hoog genoeg voor de KPI-kaders boven de grafieken)

// Naambord: icoon en naam van het domein, bovenaan de muur recht voor je
// Icoon en naam getekend op een canvas, in een gegeven vulling (verloop voor de voorkant, effen voor de diepte)
function tekenNaambord(c: HTMLCanvasElement, domein: ZaalDomein, titel: string, vulling: string | CanvasGradient): void {
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = vulling;
  g.fillStyle = vulling;
  g.lineWidth = 13;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.save();
  g.translate(-40, 0);
  g.scale(1.6, 1.6);
  iconen[domein.id]?.(g, 130, 112);
  g.restore();
  // Lange titels krijgen een kleiner lettertype, zodat ze op het bord passen
  g.font = '700 190px Inter, sans-serif';
  const grootte = Math.min(190, Math.floor((190 * 1040) / g.measureText(titel).width));
  tekst(g, titel, 330, 175 + grootte * 0.37, `700 ${grootte}px Inter, sans-serif`, vulling);
}

// 3D-letterbord: de voorkant in het verloop van het illustrated-logo, daarachter een donkerviolette diepte
// (een stapel dunne lagen, alsof de letters uit een blok gefreesd zijn), een stukje van de muur met een zachte schaduw
function maakNaambord(domein: ZaalDomein, titel: string = domein.naam): THREE.Group {
  const bord = new THREE.Group();
  const maak = () => Object.assign(document.createElement('canvas'), { width: 1400, height: 360 });
  const voor = maak();
  const verloop = voor.getContext('2d')!.createLinearGradient(0, 0, 1400, 0);
  verloop.addColorStop(0, '#5104d2');
  verloop.addColorStop(0.55, '#881ee7');
  verloop.addColorStop(1, '#9e05cd');
  tekenNaambord(voor, domein, titel, verloop);
  const masker = maak();
  tekenNaambord(masker, domein, titel, '#ffffff');
  const maskerTex = textuur(masker);
  const vlak = new THREE.PlaneGeometry(3.9, 1.0);

  const voorkant = new THREE.Mesh(vlak, new THREE.MeshBasicMaterial({ map: textuur(voor), transparent: true, alphaTest: 0.35 }));
  bord.add(voorkant);
  const diepte = 14;
  for (let i = 1; i <= diepte; i++) {
    const k = new THREE.Color(0x4a12a8).lerp(new THREE.Color(0x22064f), i / diepte);
    const laag = new THREE.Mesh(vlak, new THREE.MeshBasicMaterial({ map: maskerTex, color: k, transparent: true, alphaTest: 0.35 }));
    laag.position.z = -i * 0.007;
    bord.add(laag);
  }
  // Zachte schaduw op de muur, iets lager en naar rechts
  const schaduwVlak = new THREE.Mesh(vlak, new THREE.MeshBasicMaterial({ map: maskerTex, color: 0x000000, transparent: true, opacity: 0.05, depthWrite: false }));
  schaduwVlak.position.set(0.025, -0.035, -0.17);
  schaduwVlak.scale.setScalar(1.015);
  bord.add(schaduwVlak);

  bord.position.set(0.25, 5.7, -STRAAL + 0.2);
  return bord;
}

// De deur waar je binnenkwam, achter je in de muur, met "Lobby" erop
function maakTerugdeur(): THREE.Group {
  const deur = new THREE.Group();
  const B = 1.9;
  const H = 3.2;
  const kader = materiaal(kleur.paarsDonker, 0.1);
  for (const x of [-B / 2 - 0.03, B / 2 + 0.03]) {
    const stijl = new THREE.Mesh(new THREE.BoxGeometry(0.06, H + 0.06, 0.12), kader);
    stijl.position.set(x, H / 2, 0);
    deur.add(stijl);
  }
  const boven = new THREE.Mesh(new THREE.BoxGeometry(B + 0.12, 0.06, 0.12), kader);
  boven.position.set(0, H + 0.03, 0);
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 1010;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f7f6fb';
  g.fillRect(0, 0, 600, 1010);
  g.strokeStyle = '#e2dff0';
  g.lineWidth = 5;
  g.strokeRect(70, 70, 460, 470);
  g.strokeRect(70, 600, 460, 340);
  // Pijl naar links: terug naar de lobby
  g.strokeStyle = '#881ee7';
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(340, 190);
  g.lineTo(250, 190);
  g.moveTo(285, 150);
  g.lineTo(245, 190);
  g.lineTo(285, 230);
  g.stroke();
  tekst(g, 'Lobby', 300, 360, '400 78px Inter, sans-serif', '#0f1013', 'center');
  const zijkant = new THREE.MeshStandardMaterial({ color: 0xe4e2ec, roughness: 0.5 });
  const blad = new THREE.Mesh(new THREE.BoxGeometry(B, H, 0.05), [zijkant, zijkant, zijkant, zijkant, new THREE.MeshStandardMaterial({ map: textuur(c), roughness: 0.55 }), zijkant]);
  blad.position.set(0, H / 2, 0);
  const hendel = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.12, 4, 10), metaal());
  hendel.rotation.z = Math.PI / 2;
  hendel.position.set(-B / 2 + 0.22, H / 2 - 0.1, 0.06);
  deur.add(boven, blad, hendel);
  // De deur staat achter de kijker en kijkt naar binnen
  deur.position.set(0, 0, STRAAL - 0.08);
  deur.rotation.y = Math.PI;
  return schaduw(deur);
}

// Een lichtring als plafondlamp boven de grafieken, warm geel zoals een ledstrip
function maakLichtring(): THREE.Group {
  const ring = new THREE.Group();
  const buis = new THREE.Mesh(
    new THREE.TorusGeometry(5.5, 0.05, 12, 160),
    new THREE.MeshStandardMaterial({ color: 0xfff1c2, emissive: 0xffc94d, emissiveIntensity: 1.5 }),
  );
  buis.rotation.x = Math.PI / 2;
  ring.add(buis);
  // Drie dunne kabels naar boven
  for (let i = 0; i < 3; i++) {
    const hoek = (i / 3) * Math.PI * 2 + 0.5;
    const kabel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 3, 6), new THREE.MeshBasicMaterial({ color: 0x9a9aa0 }));
    kabel.position.set(Math.cos(hoek) * 5.5, 1.5, Math.sin(hoek) * 5.5);
    ring.add(kabel);
  }
  ring.position.set(0, 6.8, -6.5);
  return ring;
}

// Podium: een zachte band op de vloer waar de grafieken op staan, met fijne randen
function maakPodium(): THREE.Group {
  const podium = new THREE.Group();
  const vlak = new THREE.Mesh(
    new THREE.RingGeometry(7.6, 10.4, 128, 1, Math.PI * 0.12, Math.PI * 0.76),
    new THREE.MeshStandardMaterial({ color: 0xf2edfb, roughness: 1 }),
  );
  vlak.rotation.x = -Math.PI / 2;
  vlak.rotation.z = 0;
  vlak.position.y = 0.004;
  vlak.receiveShadow = true;
  podium.add(vlak);
  for (const r of [7.6, 10.4]) {
    const lijn = new THREE.Mesh(new THREE.RingGeometry(r - 0.015, r + 0.015, 128, 1, Math.PI * 0.12, Math.PI * 0.76), new THREE.MeshBasicMaterial({ color: kleur.paarsLicht }));
    lijn.rotation.x = -Math.PI / 2;
    lijn.position.y = 0.006;
    podium.add(lijn);
  }
  return podium;
}

// titel: de tekst op het naambord (standaard de naam van het domein)
// bord: { graden, y } zet het naambord opzij op de muur in plaats van in het midden; bord: false = geen naambord
export function maakZaal(domein: ZaalDomein, { titel, bord }: ZaalOpties = {}): THREE.Group {
  const zaal = new THREE.Group();

  // Gebogen muur rondom, van binnenuit gezien, met een plint
  const muur = new THREE.Mesh(new THREE.CylinderGeometry(STRAAL, STRAAL, HOOGTE, 160, 1, true), muurMat());
  muur.material.side = THREE.DoubleSide; // dubbelzijdig, zodat het licht van binnenuit juist valt
  muur.position.y = HOOGTE / 2;
  muur.receiveShadow = true;
  const plint = new THREE.Mesh(new THREE.CylinderGeometry(STRAAL - 0.02, STRAAL - 0.02, 0.1, 160, 1, true), materiaal(kleur.paarsDonker, 0.05));
  plint.material.side = THREE.DoubleSide;
  plint.position.y = 0.05;
  // Een dunne lijst bovenaan de muur
  const lijst = new THREE.Mesh(new THREE.TorusGeometry(STRAAL - 0.03, 0.03, 6, 200), materiaal(kleur.paarsDonker, 0.05));
  lijst.rotation.x = Math.PI / 2;
  lijst.position.y = HOOGTE - 0.4;

  // Planten langs de muur, links en rechts van de grafieken, en twee naast de deur
  const plantOp = (graden: number, afstand: number, zaad: number, grootte: number): THREE.Group => {
    const h = THREE.MathUtils.degToRad(graden);
    return maakPlant(afstand * Math.sin(h), -afstand * Math.cos(h), zaad, grootte);
  };
  // Het bedrijfslogo ver opzij, schuin achter je links: je ontdekt het pas als je ver rondkijkt
  const logo = maakLogo();
  const logoHoek = THREE.MathUtils.degToRad(-128);
  logo.position.set((STRAAL - 0.1) * Math.sin(logoHoek), 2.9, -(STRAAL - 0.1) * Math.cos(logoHoek));
  logo.rotation.y = -logoHoek;
  logo.scale.setScalar(1.4);
  const naambord = maakNaambord(domein, titel);
  if (bord) {
    const h = THREE.MathUtils.degToRad(bord.graden);
    naambord.position.set((STRAAL - 0.2) * Math.sin(h), bord.y, -(STRAAL - 0.2) * Math.cos(h));
    naambord.rotation.y = -h;
  }
  if (bord !== false) zaal.add(naambord);
  zaal.add(
    logo, muur, plint, lijst, maakTerugdeur(), maakLichtring(), maakPodium(),
    plantOp(-82, 11.9, 1, 1), plantOp(-90, 12.2, 2, 0.7), plantOp(84, 11.9, 3, 1),
    plantOp(170, 12, 4, 0.8), plantOp(-170, 12, 5, 0.8),
  );
  return zaal;
}
