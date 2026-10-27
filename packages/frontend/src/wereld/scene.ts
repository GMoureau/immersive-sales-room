// De basis van de 3D-wereld: camera, licht, witte vloer, schaduwen en de hulpjes die elke ruimte gebruikt.
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { gsap } from 'gsap';
import { thema, opThema } from './thema';
import type { Avatar, CameraDoel, Doel, Ruimte } from './types';

/** A material whose colours the dark theme may rewrite. */
type KleurMateriaal = THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number; map?: THREE.Texture | null };
type MetMateriaal = THREE.Object3D & { material?: THREE.Material | THREE.Material[]; geometry?: THREE.BufferGeometry };

const materialenVan = (o: THREE.Object3D): KleurMateriaal[] => {
  const m = (o as MetMateriaal).material;
  return m ? ([] as THREE.Material[]).concat(m) : [];
};
const isLabel = (o: THREE.Object3D): o is CSS2DObject => (o as CSS2DObject & { isCSS2DObject?: boolean }).isCSS2DObject === true;
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as THREE.Mesh).isMesh === true;

export const kleur = {
  achtergrond: 0xf6f6f9,
  vloer: 0xffffff,
  paars: 0x881ee7,
  paarsDonker: 0x27282b,
  paarsLicht: 0xc4a3f3,
  groen: 0x22c55e,
  oranje: 0xf59e0b,
  rood: 0xef4444,
  trend: 0xc9a227,
};

// Animaties uit = alles springt meteen naar zijn eindpositie.
export const instellingen = { animaties: true };
export const duur = (s: number): number => (instellingen.animaties ? s : 0.001);

// Een tekstlabel dat in de 3D-ruimte hangt maar als gewone, scherpe HTML getekend wordt.
export function label(html: string, klasse = ''): CSS2DObject {
  const el = document.createElement('div');
  el.className = `lbl ${klasse}`;
  el.innerHTML = html;
  return new CSS2DObject(el);
}

export function materiaal(hex: number, gloed = 0.12, opacity = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex, emissive: hex, emissiveIntensity: gloed, roughness: 0.55, metalness: 0.05, transparent: opacity < 1, opacity,
  });
}

// Alles wat een vorm heeft, werpt en ontvangt schaduw. Op een witte vloer houdt dat de dingen op hun plaats.
export function schaduw<T extends THREE.Object3D>(object: T): T {
  object.traverse(o => { if (isMesh(o)) { o.castShadow = true; o.receiveShadow = true; } });
  return object;
}

let gloedTex: THREE.CanvasTexture | undefined;
export function gloedTextuur(): THREE.CanvasTexture {
  if (gloedTex) return gloedTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return (gloedTex = new THREE.CanvasTexture(c));
}

// Laat een object (en zijn labels) vervagen naar een fractie van zijn normale zichtbaarheid.
export function vervaag(object: THREE.Object3D, factor: number, seconden = 0.6): Promise<unknown> {
  const tweens: gsap.core.Tween[] = [];
  object.traverse(o => {
    if (isLabel(o)) {
      o.element.classList.toggle('gedimd', factor < 0.5);
      tweens.push(gsap.to(o.element, { opacity: factor, duration: duur(seconden), overwrite: true }));
      return;
    }
    if (isMesh(o)) o.castShadow = factor > 0.5;
    for (const m of materialenVan(o)) {
      m.transparent = true;
      m.userData.basis ??= m.opacity;
      tweens.push(gsap.to(m, { opacity: m.userData.basis * factor, duration: duur(seconden), overwrite: true }));
    }
  });
  return Promise.all(tweens);
}

export function verbergLabels(object: THREE.Object3D, verberg: boolean): void {
  object.traverse(o => { if (isLabel(o)) o.element.style.visibility = verberg ? 'hidden' : ''; });
}

// --- Donkere modus voor de 3D ---
// Grijswaarden worden omgezet naar hun donkere tegenhanger: wit wordt bijna zwart, donkergrijs wordt lichter
// (zodat kozijnen en randen zichtbaar blijven). Gekleurde materialen (paars, status, lichtring) blijven zoals ze zijn,
// net als materialen met een getekende textuur (die tekenen hun eigen kleuren) en alles onder een object
// met userData.themaVast (de deuren, de avatar): die blijven in beide modi gelijk.
const tmp = new THREE.Color();
function donkerGrijs(c: THREE.Color): THREE.Color {
  const L = (c.r + c.g + c.b) / 3;
  const v = L > 0.5 ? 0.055 + (1 - L) * 0.4 : Math.min(0.55, 0.22 + L * 0.8);
  return tmp.setRGB(v, v, Math.min(1, v + 0.012));
}
const isGrijs = (c: THREE.Color) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 0.07;

export function themaKleuren(object: THREE.Object3D, donker = thema.donker): void {
  const vast = new Set<THREE.Object3D>();
  object.traverse(o => {
    if (o.userData.themaVast || (o.parent && vast.has(o.parent))) { vast.add(o); return; }
    for (const m of materialenVan(o)) {
      if (!m.color || m.map) continue;
      const licht: { color: number; emissive: number; gloed: number } = (m.userData.licht ??= {
        color: m.color.getHex(), emissive: m.emissive?.getHex() ?? 0, gloed: m.emissiveIntensity ?? 0,
      });
      m.color.setHex(licht.color);
      if (m.emissive) {
        m.emissive.setHex(licht.emissive);
        m.emissiveIntensity = licht.gloed;
      }
      if (!donker || !isGrijs(m.color)) continue;
      m.color.copy(donkerGrijs(m.color));
      // Een grijze gloed (zoals bij de witte muren) wordt bijna niets in het donker
      if (m.emissive && isGrijs(m.emissive)) {
        m.emissive.copy(m.color);
        m.emissiveIntensity = licht.gloed * 0.3;
      }
    }
  });
}

export function ruimOp(object: THREE.Object3D): void {
  object.traverse(o => {
    if (isLabel(o)) o.element.remove();
    (o as MetMateriaal).geometry?.dispose();
    for (const m of materialenVan(o)) m.dispose();
  });
  object.parent?.remove(object);
}

// houder: het element waarin de 3D tekent (het volledige scherm of een kader zoals een hero).
// kwaliteit: 'laag' voor gsm en zwakkere toestellen. slepen: false = alleen klikken/tikken, zodat scrollen blijft werken.
export interface Wereld {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  ruimte: Ruimte | null;
  avatar: Avatar | null;
  /** The last hit under the mouse, with the spot on the surface (uv), so a room can tell where on a card you clicked. */
  treffer: THREE.Intersection | null;
  pauzeer(): void;
  hervat(): void;
  momentopname(type?: string, kwaliteitBeeld?: number): Promise<Blob | null>;
  zetCamera(doel: CameraDoel): void;
  draaiNaar(yaw: number, pitch?: number): void;
  kijkVooruit(): void;
  toon(ruimte: Ruimte): void;
  verberg(ruimte: Ruimte): void;
  vernietig(): void;
}

export function maakWereld(
  houder: HTMLElement,
  { kwaliteit = 'hoog', slepen = true }: { kwaliteit?: 'laag' | 'hoog'; slepen?: boolean } = {}
): Wereld {
  const laag = kwaliteit === 'laag';
  const maat = (): [number, number] => [Math.max(houder.clientWidth, 1), Math.max(houder.clientHeight, 1)];
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, laag ? 1.25 : 2));
  renderer.setSize(...maat());
  renderer.domElement.style.touchAction = slepen ? 'none' : 'pan-y';
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  houder.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.setSize(...maat());
  labels.domElement.className = 'labellaag';
  houder.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const achtergrond = new THREE.Color(kleur.achtergrond);
  const mist = new THREE.FogExp2(kleur.achtergrond, 0.03);
  scene.background = achtergrond;
  scene.fog = mist;
  const DONKER_ACHTERGROND = 0x0e0d13;

  const camera = new THREE.PerspectiveCamera(50, maat()[0] / maat()[1], 0.1, 200);

  const hemel = new THREE.HemisphereLight(0xffffff, 0xe9e1e7, 1.9);
  scene.add(hemel);
  // De zon schuift mee met waar de camera naar kijkt, zodat de schaduwen overal scherp blijven.
  const zon = new THREE.DirectionalLight(0xffffff, 1.4);
  zon.castShadow = true;
  zon.shadow.mapSize.setScalar(laag ? 1024 : 4096);
  Object.assign(zon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  zon.shadow.bias = -0.0004;
  zon.shadow.normalBias = 0.02;
  scene.add(zon, zon.target);

  // Egaal witte vloer
  const vloer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: kleur.vloer, roughness: 1 }));
  vloer.rotation.x = -Math.PI / 2;
  vloer.receiveShadow = true;
  scene.add(vloer);

  // Licht of donker: achtergrond, mist, lichten en de grijswaarden van alles wat in beeld staat
  function pasThemaToe(donker: boolean) {
    achtergrond.setHex(donker ? DONKER_ACHTERGROND : kleur.achtergrond);
    mist.color.setHex(donker ? DONKER_ACHTERGROND : kleur.achtergrond);
    hemel.color.setHex(donker ? 0xb9b2d8 : 0xffffff);
    hemel.groundColor.setHex(donker ? 0x0c0b11 : 0xe9e1e7);
    hemel.intensity = donker ? 0.8 : 1.9;
    zon.intensity = donker ? 0.8 : 1.4;
    themaKleuren(scene, donker);
  }
  pasThemaToe(thema.donker);
  const stopThema = opThema(pasThemaToe);

  // Twee manieren van kijken:
  // - meelopen: de camera glijdt naar het doel van de ruimte (in de lobby: schuin achter de avatar), met een kleine muisbeweging
  // - over de schouder: de avatar staat stil en we kijken over zijn rechterschouder; slepen = rondkijken, de avatar draait mee
  const basis = { pos: new THREE.Vector3(0, 4, 18), kijk: new THREE.Vector3(0, 1.5, 0) };
  const muis = { x: 0, y: 0, zx: 0, zy: 0 };
  const STANDAARD_PITCH = -0.16;
  const blik = { yaw: 0, pitch: STANDAARD_PITCH, doelYaw: 0, doelPitch: STANDAARD_PITCH };
  let sleep: { x: number; y: number; yaw: number; pitch: number; bewogen: boolean } | null = null;
  let netGesleept = false;
  let hover: Doel | null = null;

  let lus: XRFrameRequestCallback | null = null;
  const klok = new THREE.Clock();
  const wereld: Wereld = {
    scene, camera, renderer, ruimte: null, avatar: null, treffer: null,

    // Stilleggen als de 3D niet in beeld is of het tabblad verborgen is, zodat het toestel niet nodeloos werkt
    pauzeer() {
      renderer.setAnimationLoop(null);
    },
    hervat() {
      klok.getDelta(); // de pauze niet meetellen als één grote tijdsprong
      renderer.setAnimationLoop(lus);
    },

    // Eén beeld tekenen en als afbeelding teruggeven (voor het stilstaande beeld van de hero)
    momentopname(type = 'image/webp', kwaliteitBeeld = 0.85) {
      renderer.render(scene, camera);
      return new Promise<Blob | null>(res => renderer.domElement.toBlob(res, type, kwaliteitBeeld));
    },

    zetCamera({ pos, kijk }) {
      basis.pos.set(...pos);
      basis.kijk.set(...kijk);
    },

    // Draai de blik (en de avatar) via de kortste weg naar een richting; 0 = recht vooruit
    draaiNaar(yaw, pitch = wereld.ruimte?.pitch ?? STANDAARD_PITCH) {
      const verschil = ((((yaw - blik.yaw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
      blik.doelYaw = blik.yaw + verschil;
      blik.doelPitch = pitch;
    },

    // Draai de blik terug naar recht vooruit (de kortste weg)
    kijkVooruit() {
      blik.doelYaw = Math.round(blik.yaw / (2 * Math.PI)) * 2 * Math.PI;
      blik.doelPitch = wereld.ruimte?.pitch ?? STANDAARD_PITCH;
    },

    toon(ruimte) {
      themaKleuren(ruimte.groep);
      scene.add(ruimte.groep);
      verbergLabels(ruimte.groep, false);
      mist.density = ruimte.mist ?? 0.03;
      wereld.ruimte = ruimte;
      hover = null;
      if (ruimte.schouder) {
        wereld.avatar?.zet(ruimte.schouder[0], ruimte.schouder[1], Math.PI);
        blik.yaw = blik.doelYaw = 0;
        blik.pitch = blik.doelPitch = ruimte.pitch ?? STANDAARD_PITCH;
      } else if (ruimte.cameraDoel) {
        wereld.zetCamera(ruimte.cameraDoel());
      }
      renderer.domElement.style.cursor = ruimte.schouder ? 'grab' : '';
    },

    verberg(ruimte) {
      scene.remove(ruimte.groep);
      verbergLabels(ruimte.groep, true);
      if (wereld.ruimte === ruimte) wereld.ruimte = null;
    },

    // Replaced below, once everything it tears down exists
    vernietig() {},
  };

  // Muis: aanwijzen en klikken op objecten van de huidige ruimte
  const straal = new THREE.Raycaster();
  const punt = new THREE.Vector2();
  // Muispositie als -1..1 binnen het kader van de 3D
  function binnenKader(e: PointerEvent | MouseEvent, doel: THREE.Vector2) {
    const r = renderer.domElement.getBoundingClientRect();
    return doel.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  function doelOnder(e: PointerEvent | MouseEvent): Doel | null {
    const lijst = wereld.ruimte?.klikbaar;
    if (!lijst?.length) return null;
    binnenKader(e, punt);
    straal.setFromCamera(punt, camera);
    // De treffer (met de plek op het oppervlak) blijft bewaard, zodat een ruimte kan zien wáár op een kaart je klikte
    const treffer = straal.intersectObjects(lijst, true)[0] ?? null;
    wereld.treffer = treffer;
    let o: THREE.Object3D | null = treffer?.object ?? null;
    while (o && !o.userData.doel) o = o.parent;
    return (o?.userData.doel as Doel | undefined) ?? null;
  }
  const cursor = (doel: Doel | null) => (doel ? 'pointer' : sleep?.bewogen ? 'grabbing' : wereld.ruimte?.schouder ? 'grab' : '');

  const muisPunt = new THREE.Vector2();
  const volgMuis = (e: PointerEvent) => {
    binnenKader(e, muisPunt);
    muis.x = THREE.MathUtils.clamp(muisPunt.x, -1, 1);
    muis.y = THREE.MathUtils.clamp(-muisPunt.y, -1, 1);
  };
  addEventListener('pointermove', volgMuis);
  // Slepen = rondkijken. Een korte klik zonder slepen blijft een gewone klik.
  renderer.domElement.addEventListener('pointerdown', e => {
    if (!slepen || !wereld.ruimte?.schouder) return;
    sleep = { x: e.clientX, y: e.clientY, yaw: blik.doelYaw, pitch: blik.doelPitch, bewogen: false };
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointerup', () => {
    netGesleept = !!sleep?.bewogen;
    sleep = null;
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (sleep) {
      const dx = e.clientX - sleep.x;
      const dy = e.clientY - sleep.y;
      if (Math.hypot(dx, dy) > 5) sleep.bewogen = true;
      if (sleep.bewogen) {
        // Eén schermbreedte slepen = één beeldbreedte draaien, zodat de wereld onder je muis lijkt mee te schuiven
        const perPixel = THREE.MathUtils.degToRad(camera.fov) / maat()[1];
        blik.doelYaw = sleep.yaw - dx * perPixel;
        blik.doelPitch = THREE.MathUtils.clamp(sleep.pitch + dy * perPixel, -0.6, 0.45);
        renderer.domElement.style.cursor = cursor(null);
        return;
      }
    }
    const doel = doelOnder(e);
    if (doel !== hover) {
      hover = doel;
      wereld.ruimte?.hover?.(doel);
    }
    // Fijnere opvolging binnen één doel (bv. welk filiaal op de kaart onder de muis ligt)
    wereld.ruimte?.beweeg?.(doel, wereld.treffer);
    renderer.domElement.style.cursor = cursor(doel);
  });
  renderer.domElement.addEventListener('click', e => {
    if (netGesleept) { netGesleept = false; return; }
    const doel = doelOnder(e);
    if (doel) wereld.ruimte?.klik?.(doel);
  });

  // Meegroeien met het kader (niet met het venster), zodat het ook in een hero klopt
  const meegroeien = new ResizeObserver(() => {
    const [b, h] = maat();
    camera.aspect = b / h;
    camera.updateProjectionMatrix();
    renderer.setSize(b, h);
    labels.setSize(b, h);
  });
  meegroeien.observe(houder);

  const rechts = new THREE.Vector3();
  const op = new THREE.Vector3();
  const doelPos = new THREE.Vector3();
  const doelKijk = new THREE.Vector3();
  lus = () => {
    const dt = Math.min(klok.getDelta(), 0.05);
    const t = klok.elapsedTime;
    const sterkte = instellingen.animaties ? 1 : 0;

    wereld.avatar?.update(dt);
    wereld.ruimte?.update?.(t, dt);

    const schouder = wereld.ruimte?.schouder;
    if (schouder) {
      // Over de schouder: de blik volgt het slepen met een zachte vertraging en de avatar draait mee
      const k = 1 - Math.exp(-dt * 10);
      blik.yaw += (blik.doelYaw - blik.yaw) * k;
      blik.pitch += (blik.doelPitch - blik.pitch) * k;
      const [ax, az] = schouder;
      const vx = Math.sin(blik.yaw);
      const vz = -Math.cos(blik.yaw);
      // Rechts achter de avatar, iets boven zijn hoofd: hij staat linksonder in beeld
      basis.pos.set(ax - vz * 1.3 - vx * 3.7, 2.2, az + vx * 1.3 - vz * 3.7);
      // De camera kijkt evenwijdig met de avatar mee, niet naar hem toe
      basis.kijk.set(
        ax - vz * 1.3 + vx * Math.cos(blik.pitch) * 10,
        1.5 + Math.sin(blik.pitch) * 10,
        az + vx * 1.3 + vz * Math.cos(blik.pitch) * 10,
      );
      wereld.avatar?.richt(Math.PI - blik.yaw);
      camera.position.copy(basis.pos);
      camera.lookAt(basis.kijk);
    } else {
      // Meelopen: zacht naar het doel van de ruimte glijden
      const doel = wereld.ruimte?.cameraDoel?.();
      if (doel) {
        const k = instellingen.animaties ? 1 - Math.exp(-dt * 2.2) : 1;
        basis.pos.lerp(doelPos.set(...doel.pos), k);
        basis.kijk.lerp(doelKijk.set(...doel.kijk), k);
      }
      muis.zx += (muis.x - muis.zx) * 0.04;
      muis.zy += (muis.y - muis.zy) * 0.04;
      camera.position.copy(basis.pos);
      camera.lookAt(basis.kijk);
      camera.updateMatrix();
      rechts.setFromMatrixColumn(camera.matrix, 0);
      op.setFromMatrixColumn(camera.matrix, 1);
      camera.position.addScaledVector(rechts, muis.zx * 0.4 * sterkte).addScaledVector(op, -muis.zy * 0.25 * sterkte);
      camera.lookAt(basis.kijk);
    }

    // De zon schuift mee met de plek waar we staan
    const midden = schouder ? basis.pos : basis.kijk;
    zon.target.position.copy(midden);
    zon.position.copy(midden).add(op.set(6, 14, 7));

    renderer.render(scene, camera);
    labels.render(scene, camera);
  };
  renderer.setAnimationLoop(lus);

  // Alles weer afbreken als de app de wereld weghaalt (React ruimt een component op bij het verlaten)
  wereld.vernietig = () => {
    renderer.setAnimationLoop(null);
    removeEventListener('pointermove', volgMuis);
    meegroeien.disconnect();
    stopThema();
    ruimOp(scene);
    renderer.dispose();
    renderer.domElement.remove();
    labels.domElement.remove();
  };

  return wereld;
}
