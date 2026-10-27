import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './wereld/stijl.css';

import { useEffect, useRef } from 'react';

import type { Fiche, Zaal } from './data/zaal';
import { startWereld } from './wereld/app';
import type { Domein } from './wereld/domeinen';

/**
 * The 3D experience: lobby, sales room and product room. The world is built
 * when the component mounts and torn down when it unmounts.
 */
export function Wereld({
  domeinen,
  zaal,
  haalFiche,
  start,
}: {
  domeinen: readonly Domein[];
  zaal: Zaal;
  haalFiche: (productId: number) => Promise<Fiche>;
  start?: 'lobby' | 'verkoop';
}) {
  const houder = useRef<HTMLDivElement>(null);
  const kruimels = useRef<HTMLElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const flits = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!houder.current || !kruimels.current || !hint.current || !exit.current || !flits.current) return;
    let weg = false;
    let wereld: { vernietig(): void } | null = null;
    void startWereld({
      houder: houder.current,
      kruimels: kruimels.current,
      hint: hint.current,
      exit: exit.current,
      flits: flits.current,
      domeinen,
      zaal,
      haalFiche,
      start,
    }).then((w) => {
      // Unmounted while the world was still loading: tear it down right away
      if (weg) w.vernietig();
      else wereld = w;
    });
    return () => {
      weg = true;
      wereld?.vernietig();
    };
  }, [domeinen, zaal, haalFiche, start]);

  return (
    <>
      <div ref={houder} className="wereld-houder" data-testid="wereld" />
      <header className="balk">
        <nav id="kruimels" ref={kruimels} aria-label="Waar je bent" />
      </header>
      <p id="hint" ref={hint} />
      <button id="exit" ref={exit} type="button" hidden>
        ← Lobby
      </button>
      <div id="flits" ref={flits} />
    </>
  );
}
