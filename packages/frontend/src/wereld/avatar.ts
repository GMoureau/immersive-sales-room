// De avatar: een vrolijk figuurtje met donkere krullen, een ronde bril en een donker t-shirt met het illustrated-logo op de rug,
// opgebouwd uit eenvoudige vormen. Zitten, stappen en knipperen zijn zelf geanimeerd.
// Als je niets aanklikt, doet hij af en toe iets uit zichzelf: hij draait zich naar je om en lacht, knipoogt of krabt in zijn krullen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { gsap } from 'gsap';
import { instellingen, duur } from './scene';
import type { Wereld } from './scene';
import type { Avatar, Status } from './types';

const SNELHEID = 2.8;   // meter per seconde: vinnig
const PAS = 0.3;        // hoe ver een stap reikt; bepaalt hoe snel de benen gaan
const SCHAAL = 1.15;

const kleur = {
  huid: 0xf3c4a2,
  huidDonker: 0xe5a986,
  haar: 0x3b2620,
  shirt: 0x1d1e24,
  shirtBoord: 0x2c2d35,
  broek: 0x34404f,
  sneaker: 0xf6f6f4,
  zool: 0xcfd3d6,
  montuur: 0x2a2426,
  oog: 0x2b1a14,
  wang: 0xf0948c,
  lip: 0xb5545c,
};

const mat = (hex: number, ruwheid = 0.7, metaal = 0): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: hex, roughness: ruwheid, metalness: metaal });

// Het illustrated-logo: drie stijgende balken met schuine bovenkant, de eerste als een i met een punt,
// in het verloop van blauwviolet naar magenta en onderaan een roze glans. Zelf getekend, zodat het scherp blijft.
function logoTextuur(): THREE.CanvasTexture {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 512 });
  const g = c.getContext('2d')!;
  // Coördinaten uit het logo (1080 px breed), verkleind en gecentreerd
  g.translate(256, 256);
  g.scale(0.98, 0.98);
  g.translate(-540, -540);
  const balk = (x: number, boven: number, onder: number): void => { g.beginPath(); g.moveTo(x, boven + 25); g.lineTo(x + 106, boven); g.lineTo(x + 106, onder); g.lineTo(x, onder); g.closePath(); };
  const delen = [
    { x: 328, boven: 467, onder: 545, glans: null },
    { x: 328, boven: 583, onder: 787, glans: 670 },
    { x: 487, boven: 380, onder: 787, glans: 600 },
    { x: 645, boven: 292, onder: 787, glans: 470 },
  ];
  const verloop = g.createLinearGradient(328, 0, 751, 0);
  verloop.addColorStop(0, '#3b0bd9');
  verloop.addColorStop(0.5, '#7a0fe0');
  verloop.addColorStop(1, '#d40fd8');
  for (const d of delen) {
    g.save();
    balk(d.x, d.boven, d.onder);
    g.fillStyle = verloop;
    g.fill();
    g.clip();
    if (d.glans) {
      // De roze glans in het onderste deel, met een zachte bolle bovenrand
      const glans = g.createLinearGradient(0, d.glans, 0, d.onder);
      glans.addColorStop(0, 'rgba(255, 150, 235, 0.95)');
      glans.addColorStop(0.45, 'rgba(230, 70, 240, 0.85)');
      glans.addColorStop(1, 'rgba(70, 0, 255, 0.9)');
      g.fillStyle = glans;
      g.beginPath();
      g.moveTo(d.x, d.glans + 20);
      g.quadraticCurveTo(d.x + 60, d.glans + 20, d.x + 106, d.glans - 40);
      g.lineTo(d.x + 106, d.onder);
      g.lineTo(d.x, d.onder);
      g.closePath();
      g.fill();
    }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Vaste toevalsgenerator, zodat de krullen altijd hetzelfde liggen
function toeval(zaad: number): () => number {
  let h = zaad;
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draai via de kortste weg van hoek a naar hoek b
function draai(a: number, b: number, f: number): number {
  const verschil = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + verschil * Math.min(1, f);
}

// Krullend haar: een egale haarkap (geen kale plekken) met daarop gelijkmatig verdeelde krulletjes.
// De kap kantelt naar achteren, zodat de haarlijn boven het voorhoofd ligt en het haar achteraan tot in de nek komt.
function maakHaar(): THREE.Group {
  const haar = new THREE.Group();
  const haarMat = mat(kleur.haar, 0.55);
  const kanteling = new THREE.Euler(-0.6, 0, 0);

  const kap = new THREE.Mesh(new THREE.SphereGeometry(0.276, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2), haarMat);
  kap.scale.set(1.03, 1.08, 0.99);
  kap.rotation.copy(kanteling);
  haar.add(kap);

  // Krulletjes op een gulden spiraal: gelijkmatig verdeeld, allemaal ongeveer even groot
  const bol = new THREE.SphereGeometry(1, 14, 10);
  const lus = new THREE.TorusGeometry(1, 0.45, 8, 18);
  const r = toeval(7);
  const aantal = 260;
  const gulden = Math.PI * (3 - Math.sqrt(5));
  const normaal = new THREE.Vector3();
  for (let i = 0; i < aantal; i++) {
    const y = 1 - (i / (aantal - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const p = new THREE.Vector3(Math.cos(gulden * i) * ring, y, Math.sin(gulden * i) * ring);
    if (p.y < -0.08) continue; // alleen op de kap, met een klein randje erover
    normaal.copy(p).applyEuler(kanteling);
    const krul = new THREE.Mesh(i % 4 === 0 ? lus : bol, haarMat);
    krul.scale.set(0.052, 0.052, 0.036).multiplyScalar(0.9 + r() * 0.25);
    krul.position.copy(normaal).multiply(new THREE.Vector3(0.29, 0.3, 0.28));
    krul.lookAt(krul.position.clone().multiplyScalar(2)); // plat tegen het hoofd
    krul.rotateZ(r() * Math.PI);
    haar.add(krul);
  }
  // Een nette rij krullen langs de haarlijn boven het voorhoofd
  for (let i = 0; i < 7; i++) {
    const hoek = -0.75 + (i / 6) * 1.5;
    const krul = new THREE.Mesh(lus, haarMat);
    krul.scale.setScalar(0.048);
    krul.position.set(Math.sin(hoek) * 0.25, 0.17 - Math.abs(hoek) * 0.05, Math.cos(hoek) * 0.22);
    krul.lookAt(krul.position.clone().multiplyScalar(2));
    haar.add(krul);
  }
  return haar;
}

function maakHoofd() {
  const hoofd = new THREE.Group();
  const huid = mat(kleur.huid, 0.6);
  const schedel = new THREE.Mesh(new THREE.SphereGeometry(0.26, 40, 32), huid);
  schedel.scale.set(1, 1.05, 0.95);
  const oren = [-1, 1].map(kant => {
    const oor = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), huid);
    oor.scale.set(0.6, 1, 0.8);
    oor.position.set(kant * 0.255, -0.01, 0);
    return oor;
  });

  // Ogen: donkerbruin met een lichtpuntje
  const ogen = [-0.09, 0.09].map(x => {
    const oog = new THREE.Group();
    oog.position.set(x, 0.03, 0.225);
    const bol = new THREE.Mesh(new THREE.SphereGeometry(0.034, 20, 14), mat(kleur.oog, 0.15));
    bol.scale.z = 0.6;
    const glans = new THREE.Mesh(new THREE.CircleGeometry(0.009, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glans.position.set(0.012, 0.012, 0.022);
    oog.add(bol, glans);
    return oog;
  });
  const wenkbrauwen = [-1, 1].map(kant => {
    const w = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.06, 4, 8), mat(kleur.haar, 0.6));
    w.rotation.z = Math.PI / 2 - kant * 0.15;
    w.position.set(kant * 0.09, 0.115, 0.232);
    return w;
  });

  // Ronde bril met een dun montuur
  const montuur = mat(kleur.montuur, 0.35, 0.3);
  const bril = new THREE.Group();
  for (const x of [-0.09, 0.09]) {
    const glas = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 8, 40), montuur);
    glas.position.set(x, 0.03, 0.258);
    bril.add(glas);
  }
  const brug = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.045, 8), montuur);
  brug.rotation.z = Math.PI / 2;
  brug.position.set(0, 0.045, 0.26);
  bril.add(brug);
  for (const kant of [-1, 1]) {
    const poot = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.22), montuur);
    poot.position.set(kant * 0.16, 0.035, 0.15);
    poot.rotation.y = kant * 0.25;
    bril.add(poot);
  }

  const neus = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 10), mat(kleur.huidDonker, 0.6));
  neus.scale.set(1, 0.8, 0.8);
  neus.position.set(0, -0.035, 0.245);

  // Brede glimlach: witte tanden in een halve maan met een lip eronder
  // (in een groep, zodat de mond als geheel kan lachen, twijfelen of bezorgd kijken)
  const mond = new THREE.Group();
  mond.position.set(0, -0.085, 0.236);
  mond.rotation.x = -0.15;
  const tanden = new THREE.Mesh(new THREE.CircleGeometry(0.075, 32, Math.PI, Math.PI), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
  tanden.scale.y = 0.75;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.009, 6, 32, Math.PI), mat(kleur.lip, 0.5));
  lip.scale.y = 0.75;
  lip.rotation.z = Math.PI;
  lip.position.z = 0.001;
  mond.add(tanden, lip);
  const wangen = [-0.15, 0.15].map(x => {
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), new THREE.MeshBasicMaterial({ color: kleur.wang, transparent: true, opacity: 0.4 }));
    w.position.set(x, -0.04, 0.218);
    w.rotation.y = x * 2.2;
    return w;
  });

  hoofd.add(schedel, ...oren, ...ogen, ...wenkbrauwen, bril, neus, mond, ...wangen, maakHaar());
  return { hoofd, ogen, wenkbrauwen, mond };
}

function maakFiguur() {
  const figuur = new THREE.Group();

  // Benen draaien rond de heup
  const benen = [-1, 1].map(kant => {
    const heup = new THREE.Group();
    heup.position.set(kant * 0.09, 0.4, 0);
    const been = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.22, 6, 12), mat(kleur.broek));
    been.position.y = -0.17;
    const sneaker = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.08, 0.22, 3, 0.035), mat(kleur.sneaker, 0.5));
    sneaker.position.set(0, -0.355, 0.035);
    const zool = new THREE.Mesh(new RoundedBoxGeometry(0.135, 0.03, 0.225, 2, 0.012), mat(kleur.zool, 0.6));
    zool.position.set(0, -0.39, 0.035);
    heup.add(been, sneaker, zool);
    figuur.add(heup);
    return heup;
  });

  // Bovenlijf: t-shirt, armen en hoofd veren samen op en neer
  const bovenlijf = new THREE.Group();
  figuur.add(bovenlijf);
  const shirt = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.26, 8, 24), mat(kleur.shirt, 0.85));
  shirt.scale.set(1.12, 1, 0.8);
  shirt.position.y = 0.62;
  // Het logo op de rug: een strook die de ronding van het shirt volgt (de rug is de -z-kant)
  const rug = new THREE.Group();
  rug.scale.set(1.12, 1, 0.8);
  rug.position.y = 0.66;
  const breedte = 1.0; // in radialen rond de romp (zo is het logo even breed als hoog)
  const logo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.203, 0.203, 0.23, 24, 1, true, Math.PI - breedte / 2, breedte),
    new THREE.MeshStandardMaterial({ map: logoTextuur(), transparent: true, roughness: 0.6 }),
  );
  rug.add(logo);
  const boord = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.025, 10, 24), mat(kleur.shirtBoord, 0.85));
  boord.rotation.x = Math.PI / 2;
  boord.position.y = 0.9;
  const nek = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.1, 16), mat(kleur.huid, 0.6));
  nek.position.y = 0.94;
  bovenlijf.add(shirt, rug, boord, nek);

  const armen = [-1, 1].map(kant => {
    const schouder = new THREE.Group();
    schouder.position.set(kant * 0.24, 0.82, 0);
    schouder.rotation.z = kant * 0.12;
    // Korte mouw met een zoompje, daaronder de blote arm
    const mouw = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.076, 0.17, 16), mat(kleur.shirt, 0.85));
    mouw.position.y = -0.065;
    const zoom = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.01, 6, 20), mat(kleur.shirtBoord, 0.85));
    zoom.rotation.x = Math.PI / 2;
    zoom.position.y = -0.15;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 6, 12), mat(kleur.huid, 0.6));
    arm.position.y = -0.22;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), mat(kleur.huid, 0.6));
    hand.position.y = -0.39;
    schouder.add(mouw, zoom, arm, hand);
    bovenlijf.add(schouder);
    return schouder;
  });

  // Koffie om mee te nemen in de rechterhand: beker met kartonnen huls en deksel
  const koffie = new THREE.Group();
  const beker = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.038, 0.14, 24), mat(0xffffff, 0.5));
  const huls = new THREE.Mesh(new THREE.CylinderGeometry(0.0485, 0.0435, 0.055, 24), mat(0xc9a27a, 0.9));
  huls.position.y = -0.005;
  const deksel = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.022, 24), mat(0x27282b, 0.4));
  deksel.position.y = 0.08;
  const dop = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.012, 24), mat(0x27282b, 0.4));
  dop.position.y = 0.096;
  const merk = new THREE.Mesh(new THREE.CircleGeometry(0.013, 16), new THREE.MeshBasicMaterial({ color: 0x881ee7 }));
  merk.position.set(0, -0.005, 0.0475);
  koffie.add(beker, huls, deksel, dop, merk);
  koffie.position.set(0, -0.41, 0.05);
  armen[1].add(koffie);

  const { hoofd, ogen, wenkbrauwen, mond } = maakHoofd();
  hoofd.position.y = 1.2;
  bovenlijf.add(hoofd);

  figuur.scale.setScalar(SCHAAL);
  figuur.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return { figuur, benen, bovenlijf, armen, hoofd, ogen, wenkbrauwen, mond, koffie };
}

export async function laadAvatar(wereld: Wereld): Promise<Avatar> {
  const { figuur, benen, bovenlijf, armen, hoofd, ogen, wenkbrauwen, mond, koffie } = maakFiguur();
  const groep = new THREE.Group();
  groep.userData.themaVast = true; // de avatar ziet er in de donkere modus hetzelfde uit
  groep.add(figuur);
  wereld.scene.add(groep);
  // Eerst om de verticale as draaien, dan heffen: zo kan de vrije arm naar elke kant wijzen
  armen[0].rotation.order = 'YXZ';


  // Toestand: alles wat zacht in en uit kan vloeien (0 = uit, 1 = volledig)
  const toestand = { stappen: 0, zitten: 0, wijs: 0, krab: 0, knik: 0, blij: 0, twijfel: 0, zorg: 0, slok: 0, omdraai: 0, knipoog: 0 };
  const kijk = { yaw: 0, pitch: 0, doelYaw: 0, doelPitch: 0, gewicht: 0, doelGewicht: 0 };
  let wijsHoek = 0;
  let pad: THREE.Vector3[] = [];
  let klaar: (() => void) | null = null;
  let doelHoek = Math.PI;
  let basisHoek = Math.PI; // de richting waarin hij zacht meedraait; het omdraaien naar de kijker komt daarbovenop
  let grilKlok = 8;        // seconden tot hij weer iets uit zichzelf doet
  let gril: gsap.core.Timeline | null = null;         // de lopende gril (een gsap-tijdlijn), om ze te kunnen afbreken
  let fase = 0;
  let tijd = 0;
  let volgendeKnipper = 2;
  let rust = 0; // hoe lang hij al niets doet; na een tijdje neemt hij een slokje
  let geplandKijken: gsap.core.Tween[] = []; // de blikken van een lopende overschouw, om ze te kunnen afbreken
  const richting = new THREE.Vector3();
  const lokaal = new THREE.Vector3();
  const basisOog = ogen.map(o => o.position.x);
  const basisBrauw = wenkbrauwen.map(w => ({ z: w.rotation.z, y: w.position.y }));

  // Richting van een punt in de wereld, gezien vanuit zijn lichaam
  function hoekNaar(punt: THREE.Vector3): { yaw: number; pitch: number } {
    lokaal.copy(punt);
    groep.worldToLocal(lokaal);
    const yaw = Math.atan2(lokaal.x, lokaal.z);
    const pitch = Math.atan2(lokaal.y - 1.45, Math.hypot(lokaal.x, lokaal.z));
    return { yaw, pitch };
  }

  // Eén uitdrukking tegelijk: de andere vloeien weg
  function uitdrukking(naam: string | null, sterkte = 1): void {
    for (const u of ['blij', 'twijfel', 'zorg']) gsap.to(toestand, { [u]: u === naam ? sterkte : 0, duration: duur(0.4), overwrite: 'auto' });
  }

  // Een gril: naar de kijker omdraaien (in de kamers zie je zijn rug), dan lachen, knipogen of in zijn haar krabben,
  // en weer terugdraaien. Elke echte actie (wijzen, reageren, stappen) breekt een lopende gril af.
  function startGril(): void {
    const soort = ['lach', 'knipoog', 'krab'][Math.floor(Math.random() * 3)];
    kijk.doelGewicht = 0;
    gril = gsap.timeline({ onComplete: () => { gril = null; grilKlok = 10 + Math.random() * 8; } });
    gril.to(toestand, { omdraai: 1, duration: 0.7, ease: 'power2.inOut' });
    if (soort === 'lach') {
      gril.add(() => uitdrukking('blij', 1.3))
        .to(toestand, { knik: 1, duration: 0.18 }).to(toestand, { knik: 0, duration: 0.25 })
        .to({}, { duration: 1.2 });
    } else if (soort === 'knipoog') {
      gril.add(() => uitdrukking('blij', 0.8))
        .to(toestand, { knipoog: 1, duration: 0.12, delay: 0.3 }).to(toestand, { knipoog: 0, duration: 0.18, delay: 0.35 })
        .to({}, { duration: 0.8 });
    } else {
      gril.add(() => uitdrukking('twijfel', 0.6))
        .to(toestand, { krab: 1, duration: 0.35 }).to(toestand, { krab: 0, duration: 0.4, delay: 1.2 });
    }
    gril.add(() => uitdrukking(null)).to(toestand, { omdraai: 0, duration: 0.7, ease: 'power2.inOut' });
  }
  function stopGril(): void {
    if (!gril) return;
    gril.kill();
    gril = null;
    grilKlok = 10 + Math.random() * 8;
    uitdrukking(null);
    gsap.to(toestand, { omdraai: 0, knipoog: 0, krab: 0, knik: 0, duration: duur(0.35), overwrite: 'auto' });
  }

  const avatar: Avatar & { groep: THREE.Group } = {
    groep,
    get positie() { return groep.position; },

    // Zet de avatar meteen ergens neer, kijkend in een richting (Math.PI = naar achteren in de ruimte)
    zet(x: number, z: number, hoek = Math.PI) {
      pad = [];
      klaar?.();
      groep.position.set(x, 0, z);
      groep.rotation.y = doelHoek = basisHoek = hoek;
      stopGril();
      Object.assign(toestand, { stappen: 0, zitten: 0, wijs: 0, krab: 0, knik: 0, blij: 0, twijfel: 0, zorg: 0, slok: 0, omdraai: 0, knipoog: 0 });
      kijk.doelGewicht = 0;
    },

    // Draai zacht naar een kijkrichting (gebruikt bij het meekijken over de schouder)
    richt(hoek: number) { doelHoek = hoek; },

    zitNeer() { toestand.zitten = 1; },

    staOp() {
      return gsap.to(toestand, { zitten: 0, duration: duur(0.45), ease: 'back.out(2)' }) as unknown as Promise<void>;
    },

    // Hoofd en ogen naar een punt draaien; null = weer recht vooruit
    kijkNaar(punt: THREE.Vector3 | null) {
      if (!punt) { kijk.doelGewicht = 0; return; }
      const { yaw, pitch } = hoekNaar(punt);
      kijk.doelYaw = THREE.MathUtils.clamp(yaw, -1.0, 1.0);
      kijk.doelPitch = THREE.MathUtils.clamp(pitch, -0.4, 0.35);
      kijk.doelGewicht = 1;
    },

    // Even naar een punt wijzen met de vrije arm; lost op zodra de arm gestrekt is
    async wijs(punt: THREE.Vector3) {
      rust = 0;
      stopGril();
      geplandKijken.forEach(c => c.kill());
      wijsHoek = THREE.MathUtils.clamp(hoekNaar(punt).yaw, -1.1, 1.1);
      avatar.kijkNaar(punt);
      await gsap.to(toestand, { wijs: 1, duration: duur(0.35), ease: 'power2.out', overwrite: 'auto' });
      gsap.to(toestand, { wijs: 0, duration: duur(0.5), delay: duur(0.9), ease: 'power2.inOut' });
    },

    // Reageren op de status van wat hij ziet
    reageer(status: Status) {
      rust = 0;
      stopGril();
      if (status === 'groen') {
        uitdrukking('blij');
        gsap.timeline().to(toestand, { knik: 1, duration: duur(0.18) }).to(toestand, { knik: 0, duration: duur(0.18) }).to(toestand, { knik: 1, duration: duur(0.18) }).to(toestand, { knik: 0, duration: duur(0.25) });
      } else if (status === 'oranje') {
        uitdrukking('twijfel');
      } else {
        uitdrukking('zorg');
        gsap.timeline().to(toestand, { krab: 1, duration: duur(0.35) }).to(toestand, { krab: 0, duration: duur(0.4), delay: duur(1.1) });
      }
      // Na een tijdje terug naar zijn gewone glimlach
      gsap.delayedCall(duur(4), () => uitdrukking(null));
    },

    // Kijk de nieuwe rij langs, van links naar rechts
    overschouw(punten: THREE.Vector3[]) {
      geplandKijken.forEach(c => c.kill());
      if (!punten.length) return;
      const stap = 0.45;
      geplandKijken = punten.map((p, i) => gsap.delayedCall(duur(0.3 + i * stap), () => avatar.kijkNaar(p)));
      geplandKijken.push(gsap.delayedCall(duur(0.3 + punten.length * stap + 0.3), () => avatar.kijkNaar(null)));
    },

    // Stap langs een reeks punten; de belofte lost op bij aankomst
    loop(punten: THREE.Vector3[]) {
      rust = 0;
      stopGril();
      if (!punten.length) return Promise.resolve();
      if (!instellingen.animaties) {
        const laatste = punten.at(-1)!;
        const vorige = punten.at(-2) ?? groep.position;
        if (laatste.distanceTo(vorige) > 0.01) doelHoek = basisHoek = groep.rotation.y = Math.atan2(laatste.x - vorige.x, laatste.z - vorige.z);
        groep.position.set(laatste.x, 0, laatste.z);
        return Promise.resolve();
      }
      klaar?.();
      pad = punten.map(p => new THREE.Vector3(p.x, 0, p.z));
      gsap.to(toestand, { stappen: 1, duration: 0.15, overwrite: true });
      return new Promise<void>(res => { klaar = res; });
    },

    update(dt: number) {
      tijd += dt;
      rust += dt;

      // Stappen langs het pad
      if (pad.length) {
        richting.subVectors(pad[0], groep.position).setY(0);
        const afstand = richting.length();
        const stapje = SNELHEID * dt;
        if (afstand <= stapje) {
          groep.position.copy(pad.shift()!);
          if (!pad.length) {
            gsap.to(toestand, { stappen: 0, duration: 0.25, overwrite: true });
            const r = klaar;
            klaar = null;
            r?.();
          }
        } else {
          richting.divideScalar(afstand);
          groep.position.addScaledVector(richting, stapje);
          doelHoek = Math.atan2(richting.x, richting.z);
        }
      }
      basisHoek = draai(basisHoek, doelHoek, dt * 12);
      // Omdraaien naar de kijker (bij een gril): de kortste draai van zijn richting naar de camera
      let naarKijker = 0;
      const kijker = avatar.kijker?.();
      if (kijker && toestand.omdraai > 0) {
        const d = Math.atan2(kijker.x - groep.position.x, kijker.z - groep.position.z) - basisHoek;
        naarKijker = Math.atan2(Math.sin(d), Math.cos(d));
      }
      groep.rotation.y = basisHoek + naarKijker * toestand.omdraai;

      // Af en toe een gril, als hij een tijdje niets te doen heeft
      if (instellingen.animaties && !gril && toestand.stappen === 0 && toestand.wijs === 0 && rust > 3) {
        grilKlok -= dt;
        if (grilKlok <= 0) startGril();
      }

      // Af en toe een slokje koffie, als hij een tijdje stilstaat
      if (rust > 7 && toestand.stappen === 0 && !gril && instellingen.animaties) {
        rust = -2;
        gsap.timeline().to(toestand, { slok: 1, duration: 0.5, ease: 'power2.out' }).to(toestand, { slok: 0, duration: 0.6, delay: 0.7, ease: 'power2.inOut' });
      }

      // Meekijken: zacht naar de doelrichting
      const k = 1 - Math.exp(-dt * 7);
      kijk.yaw += (kijk.doelYaw - kijk.yaw) * k;
      kijk.pitch += (kijk.doelPitch - kijk.pitch) * k;
      kijk.gewicht += (kijk.doelGewicht - kijk.gewicht) * k;

      // Benen en armen zwaaien, het lijf veert en leunt een beetje voorover
      const s = toestand.stappen;
      fase += (dt * SNELHEID * s) / PAS;
      const zwaai = Math.sin(fase) * s;
      const z = toestand.zitten;
      benen[0].rotation.x = zwaai * 0.8 - (Math.PI / 2) * z;
      benen[1].rotation.x = -zwaai * 0.8 - (Math.PI / 2) * z;

      // Vrije arm: zwaaien, wijzen of in de krullen krabben
      const gewoon = -zwaai * 0.7 - 0.5 * z;
      const w = toestand.wijs;
      const kr = toestand.krab;
      armen[0].rotation.x = gewoon * (1 - w) * (1 - kr) + (-Math.PI / 2 - 0.25) * w + -2.75 * kr;
      armen[0].rotation.y = wijsHoek * w;
      armen[0].rotation.z = -0.12 * (1 - kr) + kr * (0.45 + Math.sin(tijd * 24) * 0.12);

      // De arm met de koffie houdt de beker voor zich en zwaait minder mee; bij een slokje gaat hij naar de mond
      armen[1].rotation.x = zwaai * 0.25 - 0.55 - 0.2 * z - 1.5 * toestand.slok;
      armen[1].rotation.z = 0.12 - 0.35 * toestand.slok;
      koffie.rotation.set(-armen[1].rotation.x * (1 - toestand.slok * 0.6), 0, -armen[1].rotation.z);

      bovenlijf.position.y = Math.abs(Math.cos(fase)) * 0.045 * s + Math.sin(tijd * 2) * 0.006;
      bovenlijf.rotation.x = 0.12 * s;

      // Hoofd: rustig wiegen, meekijken, knikken, schuin bij twijfel, achterover bij een slokje
      const vrij = (1 - s) * (1 - kijk.gewicht);
      hoofd.rotation.y = Math.sin(tijd * 0.4) * 0.12 * vrij + kijk.yaw * kijk.gewicht;
      hoofd.rotation.x = -kijk.pitch * kijk.gewicht + 0.22 * toestand.knik - 0.2 * toestand.slok;
      hoofd.rotation.z = Math.sin(tijd * 0.7) * 0.05 * (1 - s) + 0.2 * toestand.twijfel;

      // Ogen volgen de kijkrichting een beetje
      ogen.forEach((o, i) => { o.position.x = basisOog[i] + THREE.MathUtils.clamp(kijk.yaw * kijk.gewicht, -1, 1) * 0.012; });

      // Gezicht: bredere lach bij goed nieuws, rechte mond bij twijfel, bezorgde wenkbrauwen bij slecht nieuws
      // Bij zorg klapt de glimlach om tot een bedrukte mond (negatieve hoogte = ondersteboven)
      mond.scale.set(1 + 0.18 * toestand.blij - 0.3 * toestand.zorg, (1 + 0.15 * toestand.blij - 0.55 * toestand.twijfel) * (1 - 1.55 * toestand.zorg), 1);
      wenkbrauwen.forEach((b, i) => {
        const kant = i === 0 ? -1 : 1;
        b.rotation.z = basisBrauw[i].z + kant * 0.35 * toestand.zorg - kant * 0.12 * toestand.twijfel * (i === 0 ? 1 : -1);
        b.position.y = basisBrauw[i].y + 0.012 * toestand.blij + 0.015 * toestand.zorg;
      });

      // Af en toe knipperen
      volgendeKnipper -= dt;
      const dicht = volgendeKnipper < 0 && volgendeKnipper > -0.12;
      ogen.forEach((oog, i) => { oog.scale.y = dicht ? 0.1 : 1 - (i === 1 ? 0.92 * toestand.knipoog : 0); });
      if (volgendeKnipper <= -0.12) volgendeKnipper = 2 + Math.random() * 3;
    },
  };
  return avatar;
}
