import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import { describe, expect, it } from 'vitest';

import { leesKerncijfers } from '@/data/kerncijfers';
import voorbeeld from '@/data/voorbeeld/kerncijfers.json';

import { maakDomeinen } from './domeinen';

const totaal = leesKerncijfers(voorbeeld as QueryTable).find((r) => r.kanaal === 'Alle');

describe('maakDomeinen', () => {
  it('colours the Verkoop door with [Status] of the YTD total', () => {
    const verkoop = maakDomeinen(totaal).find((d) => d.id === 'verkoop');
    expect(verkoop?.status).toBe('oranje');
    expect(verkoop?.open).toBe(true);
    expect(verkoop?.uitleg).toBe('Omzet +0,7% t.o.v. vorig jaar');
  });

  it('keeps Financiën and HR closed as "binnenkort"', () => {
    const dicht = maakDomeinen(totaal).filter((d) => d.id !== 'verkoop');
    expect(dicht.map((d) => [d.naam, d.status, d.open])).toEqual([
      ['Financiën', 'binnenkort', false],
      ['HR', 'binnenkort', false],
    ]);
  });

  it('falls back to "binnenkort" when the model has no status', () => {
    expect(maakDomeinen(undefined).find((d) => d.id === 'verkoop')?.status).toBe('binnenkort');
  });
});
