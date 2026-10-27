import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';

import { getRayfinClient } from '@/lib/rayfin-client';

import { RIJGRENS, kerncijfersQuery } from './dax';
import { fotoVoor } from './foto';
import { type Kerncijfers, leesKerncijfers } from './kerncijfers';
import voorbeeldKerncijfers from './voorbeeld/kerncijfers.json';
import { type Fiche, type FicheTabellen, type Zaal, type ZaalTabellen, leesFiche, leesZaal } from './zaal';
import { ficheQueries, zaalQueries } from './zaal-dax';

/**
 * One interface, two sources: the live semantic model, or bundled sample data
 * (an export of the same queries) for running without a Fabric model.
 */
export interface Databron {
  readonly soort: 'model' | 'voorbeeld';
  kerncijfers(): Promise<Kerncijfers[]>;
  /** Everything the sales room shows on entry. */
  zaal(): Promise<Zaal>;
  /** The product room for one product. */
  fiche(productId: number): Promise<Fiche>;
}

export class ModelFout extends Error {
  constructor(
    readonly categorie: string,
    message: string
  ) {
    super(message);
    this.name = 'ModelFout';
  }
}

async function voerUit(query: string): Promise<QueryTable> {
  const client = await getRayfinClient();
  const resultaat = await client.connectors.verkoop.executeQuery({
    query,
    resultSetRowCountLimit: RIJGRENS,
  });
  if (resultaat.status !== 'success') {
    throw new ModelFout(resultaat.error.category, resultaat.error.message);
  }
  return resultaat.table;
}

/** Runs a named set of queries in parallel and returns the tables under the same names. */
async function voerAllesUit<T extends Record<string, string>>(
  queries: T
): Promise<{ [K in keyof T]: QueryTable }> {
  const tabellen = await Promise.all(Object.values(queries).map(voerUit));
  return Object.fromEntries(Object.keys(queries).map((k, i) => [k, tabellen[i]])) as {
    [K in keyof T]: QueryTable;
  };
}

export const modelBron: Databron = {
  soort: 'model',
  kerncijfers: async () => leesKerncijfers(await voerUit(kerncijfersQuery())),
  zaal: async () => leesZaal(await voerAllesUit(zaalQueries()), fotoVoor),
  fiche: async (id) => leesFiche(await voerAllesUit(ficheQueries(id)), id, fotoVoor),
};

// The larger sample files load only when the sample source is used
export const voorbeeldBron: Databron = {
  soort: 'voorbeeld',
  kerncijfers: async () => leesKerncijfers(voorbeeldKerncijfers as QueryTable),
  zaal: async () => {
    const { default: tabellen } = await import('./voorbeeld/zaal.json');
    return leesZaal(tabellen as unknown as ZaalTabellen, fotoVoor);
  },
  fiche: async (id) => {
    const { default: tabellen } = await import('./voorbeeld/fiches.json');
    return leesFiche(tabellen as unknown as FicheTabellen, id, fotoVoor);
  },
};

/** `?bron=voorbeeld` or VITE_DATABRON=voorbeeld runs on the sample data. */
export function kiesBron(): Databron {
  const gevraagd =
    new URLSearchParams(window.location.search).get('bron') ??
    import.meta.env.VITE_DATABRON;
  return gevraagd === 'voorbeeld' ? voorbeeldBron : modelBron;
}
