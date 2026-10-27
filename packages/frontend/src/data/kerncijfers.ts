import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';

import type { KanaalKeuze } from './dax';
import { getal, leesRijen } from './tabel';

/** Status as computed by the [Status] measure (revenue growth beyond ±3%). */
export type Status = 'groen' | 'oranje' | 'rood';

export interface Kerncijfers {
  kanaal: KanaalKeuze;
  omzet: number | null;
  omzetVJ: number | null;
  groei: number | null;
  status: Status | null;
  omzetFC: number | null;
  brutomargePct: number | null;
  bedrijfskosten: number | null;
  netto: number | null;
  nettoVJ: number | null;
  nettoFC: number | null;
}

function status(waarde: unknown): Status | null {
  return waarde === 'groen' || waarde === 'oranje' || waarde === 'rood' ? waarde : null;
}

/** Maps the result of query 5.2; the subtotal row becomes channel "Alle". */
export function leesKerncijfers(tabel: QueryTable): Kerncijfers[] {
  return leesRijen(tabel).map((r) => ({
    kanaal: r('[is_totaal]') === true ? 'Alle' : (r('dim_kanaal[kanaal]') as KanaalKeuze),
    omzet: getal(r('[Omzet]')),
    omzetVJ: getal(r('[Omzet VJ]')),
    groei: getal(r('[Groei]')),
    status: status(r('[Status]')),
    omzetFC: getal(r('[Omzet FC]')),
    brutomargePct: getal(r('[BM %]')),
    bedrijfskosten: getal(r('[Bedrijfskosten]')),
    netto: getal(r('[Netto]')),
    nettoVJ: getal(r('[Netto VJ]')),
    nettoFC: getal(r('[Netto FC]')),
  }));
}
