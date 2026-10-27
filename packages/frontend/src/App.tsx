import { useMemo } from 'react';

import { Wereld } from './Wereld';
import type { Databron } from './data/bron';
import { useZaal } from './hooks/use-zaal';
import { maakDomeinen } from './wereld/domeinen';

function Melding({ titel, tekst, fout = false }: { titel: string; tekst: string; fout?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f6f9] p-4">
      <div className="max-w-md text-center" role={fout ? 'alert' : 'status'}>
        {!fout && (
          <div aria-hidden="true" className="mx-auto mb-5 flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#881ee7] motion-reduce:animate-none"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        )}
        <h1 className="mb-1 text-lg font-semibold text-[#0f1013]">{titel}</h1>
        <p className={`text-sm ${fout ? 'text-destructive' : 'text-[#565759]'}`}>{tekst}</p>
      </div>
    </div>
  );
}

function App({ bron, start }: { bron: Databron; start?: 'lobby' | 'verkoop' }) {
  const stand = useZaal(bron);

  // The doors wait for the data, so the Verkoop door shows [Status] of the YTD total from the start
  const domeinen = useMemo(
    () => (stand.soort === 'klaar' ? maakDomeinen(stand.zaal.kerncijfers.alle?.totaal) : null),
    [stand]
  );

  if (stand.soort === 'fout') {
    return <Melding fout titel="De verkoopcijfers konden niet geladen worden" tekst={stand.bericht} />;
  }
  if (stand.soort === 'laden' || !domeinen) {
    return (
      <Melding
        titel="De verkoopcijfers worden geladen"
        tekst={
          bron.soort === 'model'
            ? 'Rechtstreeks uit het semantisch model in Fabric. Dat duurt enkele seconden.'
            : 'Op de voorbeelddata.'
        }
      />
    );
  }
  return <Wereld domeinen={domeinen} zaal={stand.zaal} haalFiche={bron.fiche} start={start} />;
}

export default App;
