// De Verkoop-ruimte, gezien over de schouder van de avatar.
// De zuilen staan in een boog voor je. Klik op een zuil: die schuift naar voren,
// de rest zakt weg naar achteren en de volgende laag ontvouwt zich uit de gekozen zuil.
import * as THREE from 'three';
import { gsap } from 'gsap';
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { kleur, label, materiaal, schaduw, vervaag, ruimOp, duur } from './scene';
import type { Wereld } from './scene';
import { boom, domeinen, niveauNamen, periode, getal, procent, groeiTekst, kerncijfers, filialen, top10, kanaalLijst } from './data';
import type { Knoop, Sleutel } from './data';
import { maakMuurkaders } from './muurkaders';
import type { Kader, Slicer } from './muurkaders';
import { maakDetail, kernKaarten } from './detail';
import { maakZaal } from './kamer';
import type { Ruimte, Status } from './types';

/** Wat je in de Verkoop-ruimte kunt aanwijzen of aanklikken: een zuil (knoop), een KPI-kaart of een slicer. */
export type VerkoopDoel = Knoop | Kader | Slicer;

/** De Verkoop-ruimte zoals app.ts ze gebruikt. */
export interface Verkoop extends Ruimte {
  groep: THREE.Group;
  mist: number;
  pitch: number;
  schouder: [number, number];
  readonly pad: Knoop[];
  readonly klikbaar: THREE.Object3D[];
  hover(doel: VerkoopDoel | null): void;
  klik(doel: VerkoopDoel): void;
  naar(knoop: Knoop): void;
  beweeg(doel: VerkoopDoel | null, treffer: THREE.Intersection | null): void;
  start(): void;
}

export interface VerkoopOpties {
  opPad: (pad: Knoop[], opties?: { dicht?: Knoop }) => void;
  opProduct: (knoop: Knoop) => void;
}

/** Een zuil in de boom, met wat we nodig hebben om hem te animeren en op te lichten. */
interface Beeld {
  knoop: Knoop;
  g: THREE.Group;
  zuil: THREE.Mesh;
  zuilMat: THREE.MeshStandardMaterial;
  lbl: CSS2DObject;
  h: number;
}

/** Eén niveau van de boom: de ouder, de groep in de scene, de lage zuil vooraan en de zuilen in de boog. */
interface Laag {
  ouder: Knoop | null;
  groep: THREE.Group;
  anker?: Beeld;
  zuilen: Map<Knoop, Beeld>;
}

// Een KPI-kaart of slicer op de muur (geen zuil)
const opMuur = (doel: VerkoopDoel | null): doel is Kader | Slicer => doel !== null && ('kader' in doel || 'slicer' in doel);
// Een knoop op niveau 1 heet naar zijn kanaal: dat is ook een sleutel van de slicer
const isKanaal = (naam: string): naam is Sleutel => kanaalLijst.includes(naam);

const statusKleur: Record<Status, number> = { groen: kleur.groen, oranje: kleur.oranje, rood: kleur.rood };

const R = 9;                // afstand van de boog tot de kijker
const ANKER_Z = -3.4;       // waar de gekozen zuil komt te staan, laag vooraan
const ANKER_HOOGTE = 0.35;
const ANKER_BREEDTE = 0.7;  // de gekozen zuil krimpt ook in de breedte
const MAX_HOOGTE = 2.6;     // hoogte van de grootste zuil in een boog

// Een tak loopt in een zachte bocht over de vloer, van de gekozen zuil naar elke zuil in de boog
function takCurve(van: { x: number; z: number }, naar: { x: number; z: number }): THREE.CubicBezierCurve3 {
  const m = (naar.z - van.z) / 2;
  return new THREE.CubicBezierCurve3(
    new THREE.Vector3(van.x, 0.04, van.z),
    new THREE.Vector3(van.x, 0.04, van.z + m),
    new THREE.Vector3(naar.x, 0.04, naar.z - m),
    new THREE.Vector3(naar.x, 0.04, naar.z),
  );
}

export function maakVerkoop(wereld: Wereld, { opPad, opProduct }: VerkoopOpties): Verkoop {
  const groep = new THREE.Group();
  // De deur naar Verkoop bestaat altijd
  groep.add(maakZaal(domeinen.find(d => d.id === 'verkoop')!, { bord: false }));
  const muur = maakMuurkaders(kerncijfers, filialen, top10);
  groep.add(muur.groep);
  // Beide kaarten staan altijd op de muur
  const filiaalKader = muur.kaders.find(k => k.id === 'filialen')!;
  const topKader = muur.kaders.find(k => k.id === 'top10')!;
  // De slicer bepaalt ook de boom: bij "Alle" is Verkoop de stam, anders het gekozen kanaal
  const wortel = () => boom.kinderen.find(k => k.naam === muur.kanaal) ?? boom;
  // Het kanaal waartoe een knoop behoort (of "alle" voor Verkoop zelf)
  const kanaalVan = (knoop: Knoop): Sleutel => {
    let k: Knoop | null = knoop;
    while (k && k.niveau > 1) k = k.ouder;
    return k?.niveau === 1 && isKanaal(k.naam) ? k.naam : 'alle';
  };
  let pad: Knoop[] = [boom];
  let laag: Laag | null = null; // { ouder, groep, anker, zuilen: Map(knoop -> beeld) }
  let bezig = false;
  let gehoverd: Knoop | null = null;
  let reactie: gsap.core.Tween | null = null; // de geplande reactie van de avatar na het ontvouwen
  // De wereld zet de avatar neer voor de ruimtes gebouwd worden
  const avatar = wereld.avatar!;
  const top = (b: Beeld) => b.g.getWorldPosition(new THREE.Vector3()).setY(b.h * 0.8);

  // De KPI-kaders op de muur openen een scherpe 2D-kaart; de camera draait mee bij het bladeren
  const SCHOUDER: [number, number] = [0, 1.2];
  const yawVoor = (kader: Kader) => { const p = kader.midden(); return Math.atan2(p.x - SCHOUDER[0], SCHOUDER[1] - p.z); };
  // De kaarten hangen in twee rijen: de camera kijkt ook omhoog of omlaag naar de gekozen kaart
  const pitchVoor = (kader: Kader) => { const p = kader.midden(); return 0.85 * Math.atan2(p.y - 1.5, Math.hypot(p.x - SCHOUDER[0], p.z - SCHOUDER[1])); };
  const detail = maakDetail(kernKaarten(() => muur.cijfers(), () => filialen[muur.kanaal], () => top10[muur.kanaal]), {
    opWissel: i => {
      wereld.draaiNaar(yawVoor(muur.kaders[i]), pitchVoor(muur.kaders[i]));
      avatar.kijkNaar(muur.kaders[i].midden());
    },
    opSluiten: () => {
      avatar.kijkNaar(null);
      wereld.kijkVooruit();
    },
  });
  async function openKader(kader: Kader): Promise<void> {
    if (bezig || detail.isOpen) return;
    bezig = true;
    reactie?.kill();
    wereld.draaiNaar(yawVoor(kader), pitchVoor(kader));
    await avatar.wijs(kader.midden());
    await new Promise(res => setTimeout(res, duur(0.3) * 1000));
    bezig = false;
    detail.open(kader.index);
  }

  // Bij binnenkomen staat alleen de stam: één zuil (Verkoop, of het kanaal van de slicer) die je moet openklikken
  function toonStam(knoop: Knoop = wortel()): Beeld {
    // Alleen de stam: de kaarten staan op hun gewone plaats
    muur.verschuif(false);
    const nieuw: Laag = { ouder: null, groep: new THREE.Group(), zuilen: new Map() };
    groep.add(nieuw.groep);
    // Een lage zuil op handhoogte, dicht bij de avatar en midden in beeld
    const h = 1.0;
    const b = maakZuil(knoop, h, nieuw.groep, (h * knoop.vorigJaar) / knoop.stuks);
    b.g.position.set(0.9, 0, -3.1);
    b.lbl.element.insertAdjacentHTML('beforeend', '<span class="klikhint">👆 Klik om open te klappen</span>');
    b.g.scale.y = 0.001;
    gsap.to(b.g.scale, { y: 1, duration: duur(0.8), delay: duur(0.3), ease: 'back.out(1.6)' });
    nieuw.zuilen.set(knoop, b);
    laag = nieuw;
    pad = knoop === boom ? [] : [boom];
    opPad(pad, { dicht: knoop });
    return b;
  }

  // Een andere stam: de oude zakt in de grond, de nieuwe groeit op
  function vervangStam(knoop: Knoop): Beeld {
    // Alleen aangeroepen als er al een stam staat
    const oud = laag!;
    gsap.to(oud.groep.scale, { y: 0.001, duration: duur(0.35), ease: 'power2.in', onComplete: () => ruimOp(oud.groep) });
    return toonStam(knoop);
  }

  // Een slicer op de muur: de kaarten volgen, en de boom vertrekt opnieuw vanuit het gekozen kanaal
  function zetKanaal(sleutel: Sleutel): void {
    if (sleutel === muur.kanaal || bezig) return;
    muur.kies(sleutel);
    if (!laag) return;
    hover(null);
    reactie?.kill();
    const w = wortel();
    if (laag.ouder === null) {
      vervangStam(w);
      return;
    }
    laatVerdwijnen(laag, 'achter');
    pad = w === boom ? [boom] : [boom, w];
    toonNiveau(w, false);
    opPad(pad);
    naOntvouwen(w);
  }

  // Een tegel van de Top 10: de avatar wijst hem aan en we gaan meteen naar de productfiche.
  // Het product in de boom: onder het gekozen kanaal, of bij "Alle" onder het kanaal waar het het meest verkoopt.
  const vindBlad = (knoop: Knoop, naam: string): Knoop | undefined => (knoop.naam === naam && !knoop.kinderen.length ? knoop : knoop.kinderen.map(k => vindBlad(k, naam)).find(Boolean));
  async function naarTopProduct(naam: string): Promise<void> {
    if (bezig) return;
    const blad = boom.kinderen
      .filter(k => muur.kanaal === 'alle' || k.naam === muur.kanaal)
      .map(k => vindBlad(k, naam))
      .filter((k): k is Knoop => Boolean(k))
      .sort((a, b) => b.stuks - a.stuks)[0];
    if (!blad) return;
    bezig = true;
    hover(null);
    reactie?.kill();
    pad = [];
    for (let k: Knoop | null = blad; k; k = k.ouder) pad.unshift(k);
    await avatar.wijs(topKader.midden());
    bezig = false;
    opProduct(blad);
  }

  // Een bolletje op de filialenkaart: het paneel toont zijn cijfers en de avatar kijkt mee
  function kiesFiliaal(naam: string): void {
    reactie?.kill();
    const nieuw = filiaalKader.gekozen === naam ? null : naam;
    filiaalKader.kiesNaam(nieuw);
    avatar.kijkNaar(filiaalKader.midden());
    reactie = gsap.delayedCall(duur(1.5), () => avatar.kijkNaar(null));
  }

  // Na het ontvouwen: de avatar kijkt de nieuwe rij langs en reageert op de status
  function naOntvouwen(knoop: Knoop, wacht = 0): void {
    reactie?.kill();
    reactie = gsap.delayedCall(duur(1.2 + wacht), () => {
      avatar.reageer(knoop.status ?? 'oranje');
      // Er staat altijd een laag na het ontvouwen
      avatar.overschouw([...laag!.zuilen.values()].map(top));
    });
  }

  // Positie op de boog: n zuilen, gelijk verdeeld rond recht vooruit en zo breed als het beeld toelaat
  function opBoog(i: number, n: number): { x: number; z: number } {
    const halveBreedte = Math.atan(Math.tan(THREE.MathUtils.degToRad(wereld.camera.fov / 2)) * wereld.camera.aspect);
    // De kaarten schuiven opzij als de boom open is: de boog mag breder dan het beeld (rondkijken met slepen)
    const stap = n > 1 ? Math.min(THREE.MathUtils.degToRad(20), (halveBreedte * 2.1) / (n - 1)) : 0;
    const hoek = (i - (n - 1) / 2) * stap;
    return { x: R * Math.sin(hoek), z: -R * Math.cos(hoek) };
  }

  // Een zuil: violet voor dit jaar, een doorschijnende zuil eromheen met de hoogte van vorig jaar,
  // en aan de voet een ring in de statuskleur (groen, oranje of rood tegenover vorig jaar)
  function maakZuil(knoop: Knoop, h: number, ouder: THREE.Object3D, hVorig: number | null = null): Beeld {
    const g = new THREE.Group();
    g.userData.doel = knoop;
    // De statuskleur is [Status] uit het model, niet herberekend
    const st = knoop.status ?? 'oranje';
    const zuilMat = materiaal(kleur.paars, 0.12);
    const zuil = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, h, 40), zuilMat);
    zuil.position.y = h / 2;
    const kap = new THREE.Mesh(new THREE.CircleGeometry(0.38, 40), new THREE.MeshBasicMaterial({ color: kleur.paarsLicht, transparent: true }));
    kap.rotation.x = -Math.PI / 2;
    kap.position.y = h + 0.002;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.64, 48),
      new THREE.MeshBasicMaterial({ color: statusKleur[st], transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    g.add(schaduw(zuil), kap, ring);

    if (hVorig !== null) {
      const vorig = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.46, hVorig, 40, 1, true),
        new THREE.MeshStandardMaterial({ color: kleur.paarsLicht, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      );
      vorig.position.y = hVorig / 2;
      // Een fijne lijn op de hoogte van vorig jaar, zodat je het niveau ziet zonder te lezen
      const lijn = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: kleur.paarsDonker, transparent: true, opacity: 0.7 }));
      lijn.rotation.x = Math.PI / 2;
      lijn.position.y = hVorig;
      g.add(vorig, lijn);
    }

    const onder = knoop.ouder ? `${procent(knoop.stuks / knoop.ouder.stuks)} van ${knoop.ouder.naam}` : `stuks, ${periode}`;
    const groei = `<span class="groei ${st}">${groeiTekst(knoop.groei)} <i>t.o.v. vorig jaar</i></span>`;
    const lbl = label(`<b>${knoop.naam}</b><span class="getal">${getal(knoop.stuks)}</span>${groei}<small>${onder}</small>`, 'knoop klik');
    lbl.position.y = Math.max(h, hVorig ?? 0) + 0.55;
    lbl.element.addEventListener('click', () => kies(knoop));
    lbl.element.addEventListener('pointerenter', () => hover(knoop));
    lbl.element.addEventListener('pointerleave', () => hover(null));

    g.add(lbl);
    ouder.add(g);
    return { knoop, g, zuil, zuilMat, lbl, h };
  }

  function maakTak(van: THREE.Vector3, naar: THREE.Vector3, aandeel: number, vertraging: number): THREE.Mesh {
    const geo = new THREE.TubeGeometry(takCurve(van, naar), 64, 0.03 + 0.12 * aandeel, 10, false);
    const tak = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb08cf2, roughness: 0.6, transparent: true, opacity: 0.9 }));
    tak.receiveShadow = true;
    geo.setDrawRange(0, 0);
    const teller = { n: 0 };
    gsap.to(teller, {
      n: geo.index!.count, // TubeGeometry is altijd geïndexeerd
      duration: duur(0.9), delay: duur(vertraging), ease: 'power2.out',
      onUpdate: () => geo.setDrawRange(0, Math.floor(teller.n / 6) * 6),
    });
    return tak;
  }

  // Toon een niveau: de ouder als lage zuil vooraan, zijn kinderen in een boog erachter.
  // uitAnker = true: de ouder stond er al (de gekozen zuil schoof net naar voren), dus geen opkomst.
  function toonNiveau(ouder: Knoop, uitAnker: boolean): void {
    // De boom klapt open: kaarten en slicers schuiven opzij en omhoog, zodat de boom kan ademen
    muur.verschuif(true);
    const nieuw: Laag = { ouder, groep: new THREE.Group(), zuilen: new Map() };
    groep.add(nieuw.groep);

    nieuw.anker = maakZuil(ouder, ANKER_HOOGTE, nieuw.groep);
    nieuw.anker.g.position.set(0, 0, ANKER_Z);
    nieuw.anker.g.scale.set(ANKER_BREEDTE, 1, ANKER_BREEDTE);
    // Het label van de gekozen zuil ligt ervoor op de vloer, zodat het de boog niet bedekt
    nieuw.anker.lbl.position.set(0, 0.02, 0.9);
    nieuw.anker.lbl.element.classList.remove('klik');
    nieuw.anker.lbl.element.classList.add('anker');
    if (!uitAnker) {
      nieuw.anker.g.scale.y = 0.001;
      gsap.to(nieuw.anker.g.scale, { y: 1, duration: duur(0.6), ease: 'power2.out' });
    }

    const kinderen = ouder.kinderen;
    // De grootste waarde, dit jaar of vorig jaar, bepaalt de schaal: zo passen beide zuilen in beeld
    const max = Math.max(...kinderen.map(k => Math.max(k.stuks, k.vorigJaar)));
    const anker = new THREE.Vector3(0, 0, ANKER_Z);
    kinderen.forEach((k, i) => {
      const { x, z } = opBoog(i, kinderen.length);
      const vertraging = 0.15 + i * 0.06;
      const hoogte = (v: number) => 0.3 + (MAX_HOOGTE * v) / max;
      const b = maakZuil(k, hoogte(k.stuks), nieuw.groep, hoogte(k.vorigJaar));
      nieuw.zuilen.set(k, b);
      // Ontvouwen: elke zuil vertrekt vanuit de gekozen zuil en schuift naar zijn plaats op de boog
      b.g.position.copy(anker);
      b.g.scale.set(0.3, 0.001, 0.3);
      gsap.to(b.g.position, { x, z, duration: duur(1.1), delay: duur(vertraging), ease: 'power3.out' });
      gsap.to(b.g.scale, { x: 1, y: 1, z: 1, duration: duur(1.1), delay: duur(vertraging), ease: 'power3.out' });
      b.lbl.element.style.opacity = '0';
      gsap.to(b.lbl.element, { opacity: 1, duration: duur(0.5), delay: duur(vertraging + 0.7) });
      nieuw.groep.add(maakTak(anker, new THREE.Vector3(x, 0, z), k.stuks / ouder.stuks, vertraging));
    });

    // Naam van het niveau, links van de boog
    const links = opBoog(-0.9, kinderen.length);
    const titel = label(niveauNamen[ouder.niveau + 1], 'niveau');
    titel.position.set(links.x, 0.15, links.z);
    nieuw.groep.add(titel);

    laag = nieuw;
  }

  // Het huidige niveau verdwijnt: naar achteren (dieper gaan) of naar de kijker toe (teruggaan)
  function laatVerdwijnen(oud: Laag, richting: 'achter' | 'voor'): void {
    vervaag(oud.groep, 0, 0.6);
    gsap.to(oud.groep.position, {
      z: richting === 'achter' ? -8 : 4, y: richting === 'achter' ? -0.6 : 0, duration: duur(0.9), ease: 'power2.in',
      onComplete: () => ruimOp(oud.groep),
    });
  }

  async function kies(knoop: Knoop): Promise<void> {
    if (bezig || !laag?.zuilen.has(knoop)) return;
    bezig = true;
    hover(null);
    reactie?.kill();
    wereld.kijkVooruit();
    const oud = laag;
    const b = oud.zuilen.get(knoop)!; // net nagekeken met has()
    pad = [...pad, knoop];
    // Een kanaal openklikken zet ook de slicer (en dus de kaarten) op dat kanaal
    if (knoop.niveau === 1 && isKanaal(knoop.naam)) muur.kies(knoop.naam);
    // Eerst wijst de avatar de gekozen zuil aan
    await avatar.wijs(top(b));

    // De gekozen zuil gaat los van zijn niveau en schuift naar voren, terwijl hij krimpt tot een lage zuil
    groep.attach(b.g);
    b.lbl.element.classList.remove('klik');
    laatVerdwijnen(oud, 'achter');
    gsap.to(b.g.scale, { x: ANKER_BREEDTE, y: ANKER_HOOGTE / b.h, z: ANKER_BREEDTE, duration: duur(0.9), ease: 'power2.inOut' });
    gsap.to(b.lbl.element, { opacity: 0, duration: duur(0.4) });
    await gsap.to(b.g.position, { x: 0, z: ANKER_Z, duration: duur(0.9), ease: 'power2.inOut' });

    if (knoop.niveau === niveauNamen.length - 1) {
      bezig = false;
      ruimOp(b.g);
      return opProduct(knoop);
    }
    toonNiveau(knoop, true);
    ruimOp(b.g);
    opPad(pad);
    naOntvouwen(knoop);
    bezig = false;
  }

  // Terug naar een knoop op het pad (via de broodkruimels)
  function naar(knoop: Knoop): void {
    if (bezig) return;
    hover(null);
    // De slicer volgt: terug naar Verkoop zet hem op "Alle"
    muur.kies(kanaalVan(knoop));
    // Was de boom nog dicht, dan wordt alleen de stam vervangen
    if (laag?.ouder === null && knoop.niveau <= 1) {
      vervangStam(knoop);
      return;
    }
    if (laag) laatVerdwijnen(laag, 'voor');
    pad = pad.slice(0, pad.indexOf(knoop) + 1);
    wereld.kijkVooruit();
    toonNiveau(knoop, false);
    opPad(pad);
    naOntvouwen(knoop);
  }

  let kaderGehoverd: Kader | Slicer | null = null;
  function hover(doel: VerkoopDoel | null): void {
    if (bezig) return;
    // Een KPI-kaart of slicer op de muur: die licht op en de avatar kijkt ernaar
    muur.hover(opMuur(doel) ? doel : null);
    kaderGehoverd = opMuur(doel) ? doel : null;
    const knoop = opMuur(doel) ? null : doel;
    const oud = gehoverd && laag?.zuilen.get(gehoverd);
    if (oud) {
      gsap.to(oud.zuilMat, { emissiveIntensity: 0.12, duration: duur(0.3) });
      oud.lbl.element.classList.remove('actief');
    }
    gehoverd = knoop;
    const nieuw = knoop && laag?.zuilen.get(knoop);
    if (nieuw) {
      gsap.to(nieuw.zuilMat, { emissiveIntensity: 0.6, duration: duur(0.3) });
      nieuw.lbl.element.classList.add('actief');
    }
    // De avatar kijkt mee naar de zuil onder je muis
    avatar.kijkNaar(nieuw ? top(nieuw) : kaderGehoverd && !detail.isOpen ? kaderGehoverd.midden() : null);
  }

  return {
    groep,
    mist: 0.01,
    pitch: -0.08,
    schouder: [0, 1.2], // waar de avatar stil staat; we kijken over zijn schouder mee
    get pad() { return pad; },
    get klikbaar() { return [...(laag ? [...laag.zuilen.values()].map(b => b.zuil) : []), ...muur.kaders.map(k => k.groep), ...muur.slicers.map(s => s.groep)]; },
    hover,
    klik: (doel: VerkoopDoel) => {
      if (doel === filiaalKader) {
        // Op een bolletje: dat filiaal kiezen; elders op de kaart: de tabel met alle filialen
        const naam = filiaalKader.vind(wereld.treffer?.uv);
        if (naam) return kiesFiliaal(naam);
      }
      if (doel === topKader) {
        // Op een tegel: meteen naar dat product; elders op de kaart: de volledige top 10
        const naam = topKader.vind(wereld.treffer?.uv);
        if (naam) return naarTopProduct(naam);
      }
      if ('kader' in doel) return openKader(doel);
      if ('slicer' in doel) {
        // Een ander kanaal: de kaarten en de boom bouwen zich opnieuw op, de avatar kijkt mee
        avatar.kijkNaar(doel.midden());
        zetKanaal(doel.slicer);
        gsap.delayedCall(duur(1.5), () => avatar.kijkNaar(null));
        return;
      }
      return kies(doel);
    },
    naar,
    // De muis beweegt over de filialenkaart of de Top 10: de bol, rij of tegel eronder licht op
    beweeg(doel: VerkoopDoel | null, treffer: THREE.Intersection | null) {
      for (const k of [filiaalKader, topKader]) k.hoverOp(doel === k && !detail.isOpen ? k.vind(treffer?.uv) : null);
    },

    start() {
      if (laag) ruimOp(laag.groep);
      laag = null;
      const stam = toonStam();
      muur.speel(0.6);
      // De avatar wijst de zuil aan
      reactie?.kill();
      reactie = gsap.delayedCall(duur(1.6), () => {
        avatar.wijs(top(stam));
      });
    },
  };
}
