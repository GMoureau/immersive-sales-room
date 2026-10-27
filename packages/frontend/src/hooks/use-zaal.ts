import { useEffect, useState } from 'react';

import type { Databron } from '@/data/bron';
import type { Zaal } from '@/data/zaal';

export type Stand =
  | { soort: 'laden' }
  | { soort: 'klaar'; zaal: Zaal }
  | { soort: 'fout'; bericht: string };

/** Loads everything the sales room shows on entry, once per data source. */
export function useZaal(bron: Databron): Stand {
  const [stand, setStand] = useState<Stand>({ soort: 'laden' });

  useEffect(() => {
    let actief = true;
    bron.zaal().then(
      (zaal) => actief && setStand({ soort: 'klaar', zaal }),
      (fout: unknown) =>
        actief &&
        setStand({ soort: 'fout', bericht: fout instanceof Error ? fout.message : String(fout) })
    );
    return () => {
      actief = false;
    };
  }, [bron]);

  return stand;
}
