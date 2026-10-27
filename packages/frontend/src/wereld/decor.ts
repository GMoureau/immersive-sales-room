// Gedeelde aankleding en tekenhulpjes voor de lobby en de kamers:
// iconen per domein, kamerplanten, tekst op texturen en een paar materialen.
import * as THREE from 'three';
import { kleur, materiaal, schaduw, gloedTextuur } from './scene';

export const muurMat = () => new THREE.MeshStandardMaterial({ color: 0xfbfbfd, emissive: 0xffffff, emissiveIntensity: 0.18, roughness: 0.95 });
export const metaal = () => new THREE.MeshStandardMaterial({ color: 0x27282b, roughness: 0.3, metalness: 0.6 });

export function textuur(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function tekst(
  ctx: CanvasRenderingContext2D,
  inhoud: string,
  x: number,
  y: number,
  font: string,
  kleurCss: string | CanvasGradient,
  uitlijning: CanvasTextAlign = 'left'
): void {
  ctx.font = font;
  ctx.fillStyle = kleurCss;
  ctx.textAlign = uitlijning;
  ctx.fillText(inhoud, x, y);
}

// --- Iconen per domein, als lijntekening rond (cx, cy) ---
type Icoon = (g: CanvasRenderingContext2D, cx: number, cy: number) => void;

export const iconen: Record<string, Icoon> = {
  financien(g, cx, cy) {
    g.beginPath();
    g.arc(cx, cy, 58, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, 44, 0, Math.PI * 2);
    g.lineWidth = 4;
    g.stroke();
    tekst(g, '€', cx, cy + 26, '600 76px Inter, sans-serif', '#881ee7', 'center');
  },
  verkoop(g, cx, cy) {
    g.beginPath();
    g.moveTo(cx - 70, cy - 48);
    g.lineTo(cx - 48, cy - 48);
    g.lineTo(cx - 28, cy + 28);
    g.lineTo(cx + 46, cy + 28);
    g.lineTo(cx + 62, cy - 26);
    g.lineTo(cx - 40, cy - 26);
    g.stroke();
    for (const x of [cx - 18, cx + 38]) {
      g.beginPath();
      g.arc(x, cy + 52, 10, 0, Math.PI * 2);
      g.fill();
    }
  },
  hr(g, cx, cy) {
    // Twee personen: één achteraan, één vooraan
    const persoon = (x: number, y: number, r: number) => {
      g.beginPath();
      g.arc(x, y - r * 1.1, r * 0.75, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(x, y + r * 1.6, r * 1.5, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    };
    persoon(cx + 30, cy - 6, 26);
    g.fillStyle = '#f7f6fb';
    g.beginPath();
    g.arc(cx - 22, cy + 34, 52, Math.PI, 0);
    g.fill();
    persoon(cx - 22, cy + 4, 30);
  },
};

// Kamerplant: een gedraaide pot met rand, dunne stelen en brede bladeren
export function maakPlant(x: number, z: number, zaad = 1, grootte = 1): THREE.Group {
  const plant = new THREE.Group();
  const profiel = [[0, 0], [0.26, 0], [0.3, 0.04], [0.36, 0.62], [0.4, 0.64], [0.4, 0.7], [0.34, 0.7], [0.33, 0.66], [0, 0.66]].map(([a, b]) => new THREE.Vector2(a, b));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(profiel, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.352, 0.334, 0.05, 48, 1, true), materiaal(kleur.paars, 0.1));
  band.position.y = 0.5;
  // Aarde: een laag tot net onder de rand, een heuveltje in het midden en wat kruimels
  const aardeMat = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 1 });
  const aarde = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.03, 40), aardeMat);
  aarde.position.y = 0.665;
  const heuvel = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 12), aardeMat);
  heuvel.scale.y = 0.18;
  heuvel.position.y = 0.68;
  plant.add(pot, band, aarde, heuvel);
  const kruimelGeo = new THREE.IcosahedronGeometry(1, 0);
  const kruimelMat = [new THREE.MeshStandardMaterial({ color: 0x3a281d, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0x5c4331, roughness: 1 })];
  for (let i = 0; i < 16; i++) {
    const hoek = i * 2.4 + zaad;
    const afstand = 0.08 + ((i * 7 + zaad * 3) % 10) * 0.022;
    const kruimel = new THREE.Mesh(kruimelGeo, kruimelMat[i % 2]);
    kruimel.scale.setScalar(0.012 + (i % 3) * 0.006);
    kruimel.position.set(Math.cos(hoek) * afstand, 0.685, Math.sin(hoek) * afstand);
    kruimel.rotation.set(i, i * 2, 0);
    plant.add(kruimel);
  }

  const bladVorm = new THREE.Shape();
  bladVorm.moveTo(0, 0);
  bladVorm.bezierCurveTo(0.16, 0.08, 0.15, 0.36, 0, 0.5);
  bladVorm.bezierCurveTo(-0.15, 0.36, -0.16, 0.08, 0, 0);
  const bladGeo = new THREE.ShapeGeometry(bladVorm, 12);
  const groen = [0x4f8a5f, 0x6aa77a];
  const stengel = new THREE.MeshStandardMaterial({ color: 0x5d7f4f, roughness: 0.8 });
  for (let i = 0; i < 11; i++) {
    const hoek = (i / 11) * Math.PI * 2 + zaad;
    const hoogte = 0.5 + ((i * 37 + zaad * 13) % 7) * 0.09;
    const uit = 0.18 + (i % 3) * 0.08;
    const top = new THREE.Vector3(Math.cos(hoek) * uit, 0.64 + hoogte, Math.sin(hoek) * uit);
    const steel = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.64, 0), new THREE.Vector3(top.x * 0.3, top.y * 0.9, top.z * 0.3), top), 8, 0.008, 5), stengel);
    const blad = new THREE.Mesh(bladGeo, new THREE.MeshStandardMaterial({ color: groen[i % 2], roughness: 0.6, side: THREE.DoubleSide }));
    blad.position.copy(top);
    blad.rotation.set(0, -hoek + Math.PI / 2, 0);
    blad.rotateX(-0.9);
    plant.add(steel, blad);
  }
  plant.position.set(x, 0, z);
  plant.scale.setScalar(grootte);
  return schaduw(plant);
}

// Dummy-logo van het bedrijf (lumea cosmetics) als wandbord:
// een uitgesneden druppel met een blaadje in 3D, iets van de muur af, met een zachte gloed erachter en kleinere tekst ernaast
export function maakLogo() {
  const logo = new THREE.Group();
  const groen = new THREE.MeshStandardMaterial({ color: 0x12704a, roughness: 0.35, metalness: 0.2 });
  const munt = new THREE.MeshStandardMaterial({ color: 0x8fd6b4, roughness: 0.4, metalness: 0.1 });

  // Druppel met een blad als uitsparing
  const druppel = new THREE.Shape();
  druppel.moveTo(0, 0.42);
  druppel.bezierCurveTo(0.12, 0.24, 0.27, 0.06, 0.27, -0.1);
  druppel.absarc(0, -0.1, 0.27, 0, Math.PI, true);
  druppel.bezierCurveTo(-0.27, 0.06, -0.12, 0.24, 0, 0.42);
  const blad = new THREE.Path();
  blad.absellipse(0.04, -0.12, 0.07, 0.15, 0, Math.PI * 2, false, -0.6);
  druppel.holes.push(blad);
  const opties = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3, curveSegments: 32 };
  const beeldmerk = new THREE.Mesh(new THREE.ExtrudeGeometry(druppel, opties), groen);
  beeldmerk.position.set(-1.25, 0, 0.07);

  // Klein muntgroen blaadje dat schuin uit de druppel groeit
  const blaadje = new THREE.Shape();
  blaadje.moveTo(0, 0);
  blaadje.bezierCurveTo(0.08, 0.04, 0.1, 0.16, 0, 0.24);
  blaadje.bezierCurveTo(-0.1, 0.16, -0.08, 0.04, 0, 0);
  const groei = new THREE.Mesh(new THREE.ExtrudeGeometry(blaadje, { ...opties, depth: 0.03 }), munt);
  groei.position.set(-1.12, 0.3, 0.09);
  groei.rotation.z = -0.7;

  // Afstandhouders naar de muur
  for (const [x, y] of [[-1.25, 0.2], [-1.25, -0.25]]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8), metaal());
    pin.rotation.x = Math.PI / 2;
    pin.position.set(x, y, 0.035);
    logo.add(pin);
  }

  // Woordmerk: kleiner dan het beeldmerk
  const c = document.createElement('canvas');
  c.width = 1400;
  c.height = 420;
  const g = c.getContext('2d')!;
  tekst(g, 'lumea', 20, 250, '600 230px Inter, sans-serif', '#0f1013');
  g.letterSpacing = '22px';
  tekst(g, 'COSMETICS', 30, 360, '500 62px Inter, sans-serif', '#12704a');
  const woord = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.555), new THREE.MeshBasicMaterial({ map: textuur(c), transparent: true }));
  woord.position.set(-0.03, -0.04, 0.012);

  // Zachte gloed op de muur, alsof het bord van achteren verlicht is
  const gloed = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.7),
    new THREE.MeshBasicMaterial({ map: gloedTextuur(), color: 0x8fd6b4, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  gloed.position.set(-1.25, 0, 0.004);

  logo.add(gloed, schaduw(beeldmerk), schaduw(groei), woord);
  return logo;
}

// --- Werf achter een deur die nog niet klaar is: een kleine ruimte met een kegel en een bordje,
// en afzetlint over de deuropening. breedte en hoogte zijn die van de deuropening.
// Het lint staat vóór de opening (z > 0) en wordt pas getoond als de deur open is; de rest staat erachter.
export interface Werf {
  groep: THREE.Group;
  linten: THREE.Object3D[];
  bordje: THREE.Object3D;
}

export function maakWerf(breedte: number, hoogte: number): Werf {
  const werf = new THREE.Group();
  const diepte = 2.4;

  // De ruimte achter de deur: vloer, achterwand en zijwanden in een zacht grijs, iets donkerder dan de lobby
  const wandMat = new THREE.MeshStandardMaterial({ color: 0xe9e8ef, roughness: 0.95 });
  const vloer = new THREE.Mesh(new THREE.PlaneGeometry(breedte + 1.2, diepte), new THREE.MeshStandardMaterial({ color: 0xdcdbe3, roughness: 1 }));
  vloer.rotation.x = -Math.PI / 2;
  vloer.position.set(0, 0.003, -diepte / 2);
  const achter = new THREE.Mesh(new THREE.PlaneGeometry(breedte + 1.2, hoogte + 0.4), wandMat);
  achter.position.set(0, (hoogte + 0.4) / 2, -diepte);
  werf.add(vloer, achter);
  for (const kant of [-1, 1]) {
    const zij = new THREE.Mesh(new THREE.PlaneGeometry(diepte, hoogte + 0.4), wandMat);
    zij.rotation.y = -kant * Math.PI / 2;
    zij.position.set(kant * (breedte / 2 + 0.6), (hoogte + 0.4) / 2, -diepte / 2);
    werf.add(zij);
  }

  // Verkeerskegel: oranje met twee witte banden, op een zwart voetstuk
  const kegel = new THREE.Group();
  const oranje = new THREE.MeshStandardMaterial({ color: 0xff6a13, roughness: 0.45 });
  const wit = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const voet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), new THREE.MeshStandardMaterial({ color: 0x1d1e24, roughness: 0.7 }));
  voet.position.y = 0.02;
  const lijf = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.62, 32), oranje);
  lijf.position.y = 0.04 + 0.31;
  kegel.add(voet, lijf);
  for (const [y, r] of [[0.27, 0.112], [0.44, 0.072]]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.022, 0.07, 32, 1, true), wit);
    band.position.y = y;
    kegel.add(band);
  }
  // Rechts in de opening: links staat straks het opengezwaaide deurblad
  kegel.position.set(breedte * 0.3, 0, -0.6);
  kegel.userData.themaVast = true; // wit blijft wit op een kegel, ook in het donker
  kegel.rotation.y = 0.4;
  werf.add(schaduw(kegel));

  // Bordje "Under construction" op twee pootjes, schuin naar de lobby gericht
  const c = document.createElement('canvas');
  c.width = 900;
  c.height = 560;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffc61a';
  g.beginPath();
  g.roundRect(14, 14, c.width - 28, c.height - 28, 40);
  g.fill();
  g.lineWidth = 16;
  g.strokeStyle = '#1d1e24';
  g.stroke();
  // Waarschuwingsdriehoek met een uitroepteken
  g.beginPath();
  g.moveTo(450, 70);
  g.lineTo(560, 260);
  g.lineTo(340, 260);
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 18;
  g.stroke();
  tekst(g, '!', 450, 245, '800 130px Inter, sans-serif', '#1d1e24', 'center');
  tekst(g, 'Under', 450, 360, '800 92px Inter, sans-serif', '#1d1e24', 'center');
  tekst(g, 'construction', 450, 455, '800 92px Inter, sans-serif', '#1d1e24', 'center');
  const bordje = new THREE.Group();
  const plaat = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.9, 0.03), [
    ...Array(4).fill(new THREE.MeshStandardMaterial({ color: 0x1d1e24 })),
    new THREE.MeshStandardMaterial({ map: textuur(c), roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x1d1e24 }),
  ]);
  plaat.position.y = 1.45;
  bordje.add(plaat);
  for (const kant of [-1, 1]) {
    const poot = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.0, 10), metaal());
    poot.position.set(kant * 0.5, 0.5, 0);
    bordje.add(poot);
  }
  bordje.position.set(-breedte * 0.02, 0, -1.3);
  bordje.rotation.y = -0.08;
  werf.add(schaduw(bordje));

  // Afzetlint: twee licht schuine, rood-wit gestreepte linten over de deuropening, één boven en één onder het bordje
  const lc = document.createElement('canvas');
  lc.width = 512;
  lc.height = 64;
  const lg = lc.getContext('2d')!;
  for (let i = -1; i < 9; i++) {
    lg.fillStyle = i % 2 ? '#ffffff' : '#e3262f';
    lg.beginPath();
    lg.moveTo(i * 64, 64);
    lg.lineTo(i * 64 + 64, 64);
    lg.lineTo(i * 64 + 96, 0);
    lg.lineTo(i * 64 + 32, 0);
    lg.closePath();
    lg.fill();
  }
  const lintTex = textuur(lc);
  lintTex.wrapS = THREE.RepeatWrapping;
  const lengte = breedte + 0.25;
  lintTex.repeat.set(lengte / 0.8, 1);
  const linten = [[hoogte * 0.72, 0.12], [hoogte * 0.24, -0.1]].map(([y, hoek], i) => {
    const lint = new THREE.Mesh(new THREE.PlaneGeometry(lengte, 0.13), new THREE.MeshStandardMaterial({ map: lintTex, roughness: 0.6, side: THREE.DoubleSide }));
    lint.position.set(0, y, 0.09 + i * 0.01);
    lint.rotation.z = hoek;
    lint.scale.x = 0.001; // verschijnt pas als de deur open is
    werf.add(lint);
    return lint;
  });

  werf.visible = false;
  return { groep: werf, linten, bordje: plaat };
}
