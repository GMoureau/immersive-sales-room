// The whole 3D experience: lobby, sales room and product room, with the breadcrumbs,
// the hint and the exit button around it. Ported from demo.html of the original demo;
// the data now comes from the app (vulData), and a product sheet is loaded on demand.
import { gsap } from 'gsap';
import { maakWereld, instellingen, ruimOp, duur } from './scene';
import { zetThema } from './thema';
import { maakLobby } from './lobby';
import { maakVerkoop } from './verkoop';
import { maakProduct } from './product';
import { laadAvatar } from './avatar';
import { vulData, niveauNamen, type Fiche, type Knoop } from './data';
import type { Domein } from './domeinen';
import type { Product } from './product';
import type { Verkoop } from './verkoop';
import type { Zaal } from '@/data/zaal';

export interface WereldOpties {
  houder: HTMLElement;
  kruimels: HTMLElement;
  hint: HTMLElement;
  exit: HTMLButtonElement;
  flits: HTMLElement;
  domeinen: readonly Domein[];
  zaal: Zaal;
  haalFiche: (productId: number) => Promise<Fiche>;
  start?: 'lobby' | 'verkoop';
  donker?: boolean;
}

type Kruimel = { naam: string; actie?: () => void };

export async function startWereld({ houder, kruimels, hint, exit, flits: flitsEl, domeinen, zaal, haalFiche, start = 'lobby', donker = false }: WereldOpties): Promise<{ vernietig(): void }> {
  zetThema(donker);
  vulData({ domeinen, zaal });

  // The cards draw text onto textures, so the font must be loaded first
  await Promise.all(['300', '400', '500', '600'].map(w => document.fonts.load(`${w} 40px Inter`)));

  // Animations are off for anyone who asked their system for reduced motion
  instellingen.animaties = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  const wereld = maakWereld(houder);
  let actief = true;
  const avatar = await laadAvatar(wereld);
  wereld.avatar = avatar;
  // Where the viewer is, so the avatar can now and then turn to you
  avatar.kijker = () => wereld.camera.position;

  let verkoop: Verkoop | null = null;
  let product: Product | null = null;
  let bezig = false;

  const flits = (aan: boolean) => gsap.to(flitsEl, { opacity: aan ? 1 : 0, duration: duur(aan ? 0.35 : 0.9), ease: 'power1.inOut' });

  function zetKruimels(items: Kruimel[]) {
    kruimels.replaceChildren();
    items.forEach((item, i) => {
      const laatste = i === items.length - 1;
      const el = document.createElement(laatste ? 'span' : 'button');
      el.textContent = item.naam;
      if (laatste) el.className = 'huidig';
      else el.onclick = item.actie ?? null;
      kruimels.append(el);
      if (!laatste) kruimels.append(Object.assign(document.createElement('span'), { className: 'sep', textContent: '›' }));
    });
  }

  const kruimelsVoorPad = (pad: Knoop[]): Kruimel[] => [{ naam: 'Lobby', actie: naarLobby }, ...pad.map(k => ({ naam: k.naam, actie: () => terugNaar(k) }))];

  function opPad(pad: Knoop[], { dicht }: { dicht?: Knoop } = {}) {
    // The tree is still closed: only the trunk stands (Verkoop, or the channel on the slicer)
    if (dicht) {
      zetKruimels([...kruimelsVoorPad(pad), { naam: dicht.naam }]);
      hint.textContent = `Klik op de zuil ${dicht.naam} om de boom open te klappen. Klik op een kader aan de muur voor details.`;
      return;
    }
    zetKruimels(kruimelsVoorPad(pad));
    const volgend = niveauNamen[pad.length].toLowerCase();
    hint.textContent = pad.length === 1
      ? 'Klik op een kanaal om dieper te gaan. Sleep om rond te kijken.'
      : `Klik op een ${volgend}${volgend === 'product' ? ' om zijn fiche te openen' : ' om dieper te gaan'}.`;
  }

  async function overgang(stap: () => void | Promise<void>) {
    if (bezig) return;
    bezig = true;
    await flits(true);
    try {
      await stap();
    } finally {
      await flits(false);
      bezig = false;
    }
  }

  function naarLobby() {
    overgang(() => {
      if (product) { product.opruimen(); ruimOp(product.groep); product = null; }
      if (verkoop) wereld.verberg(verkoop);
      lobby.reset();
      wereld.toon(lobby);
      exit.hidden = true;
      zetKruimels([{ naam: 'Lobby' }]);
      hint.textContent = lobby.hint;
    });
  }

  function naarVerkoop() {
    return overgang(() => {
      wereld.verberg(lobby);
      verkoop ??= maakVerkoop(wereld, { opPad, opProduct: naarProduct });
      verkoop.start();
      wereld.toon(verkoop);
      exit.hidden = false;
    });
  }

  // The product sheet comes from the model on demand (four small queries), while the screen is white
  function naarProduct(knoop: Knoop) {
    overgang(async () => {
      hint.textContent = `De fiche van ${knoop.naam} wordt geladen…`;
      let fiche: Fiche;
      try {
        if (knoop.productId === undefined) throw new Error('geen product');
        fiche = await haalFiche(knoop.productId);
      } catch (fout) {
        hint.textContent = `De fiche van ${knoop.naam} kon niet geladen worden: ${fout instanceof Error ? fout.message : String(fout)}`;
        if (knoop.ouder) verkoop?.naar(knoop.ouder);
        return;
      }
      if (!verkoop) return;
      if (!actief) return;
      wereld.verberg(verkoop);
      product = maakProduct(wereld, fiche);
      product.start();
      wereld.toon(product);
      zetKruimels(kruimelsVoorPad(verkoop.pad));
      hint.textContent = product.hint;
    });
  }

  function terugNaar(knoop: Knoop) {
    if (!verkoop) return;
    if (!product) return verkoop.naar(knoop);
    const zaalNu = verkoop;
    overgang(() => {
      product?.opruimen();
      if (product) ruimOp(product.groep);
      product = null;
      zaalNu.naar(knoop);
      wereld.toon(zaalNu);
    });
  }

  exit.onclick = () => naarLobby();

  const lobby = maakLobby(wereld, avatar, { domeinen, opOpenen: naarVerkoop });
  lobby.reset();
  wereld.toon(lobby);
  zetKruimels([{ naam: 'Lobby' }]);
  hint.textContent = lobby.hint;
  exit.hidden = true;
  wereld.zetCamera({ pos: [3, 6, 20], kijk: [0, 1.5, 0] });
  if (start === 'verkoop') await naarVerkoop();

  return {
    vernietig() {
      actief = false;
      if (product) product.opruimen();
      // The detail cards live in a layer on the page itself
      document.querySelectorAll('.detail-laag').forEach(laag => laag.remove());
      wereld.vernietig();
    },
  };
}
