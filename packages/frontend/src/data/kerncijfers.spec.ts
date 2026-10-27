import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import { describe, expect, it } from 'vitest';

import controle from '../../../../checks/kerncijfers-5.2.json';
import verwacht from '../../../../checks/kerncijfers-5.2.verwacht.json';

import { kanaalFilter, kerncijfersQuery } from './dax';
import { leesKerncijfers } from './kerncijfers';
import { opCenten } from './tabel';
import voorbeeld from './voorbeeld/kerncijfers.json';

const rijen = leesKerncijfers(voorbeeld as QueryTable);
const totaal = rijen.find((r) => r.kanaal === 'Alle');

describe('kerncijfers (controlequery 5.2)', () => {
  it('sends exactly the query that npm run check:model runs live', () => {
    expect(kerncijfersQuery()).toBe(controle.query);
  });

  it('matches the handover totals to the cent', () => {
    expect(totaal).toBeDefined();
    expect(opCenten(totaal!.omzet!)).toBe(verwacht.omzet);
    expect(opCenten(totaal!.omzetVJ!)).toBe(verwacht.omzetVJ);
    expect(opCenten(totaal!.bedrijfskosten!)).toBe(verwacht.bedrijfskosten);
    expect(opCenten(totaal!.netto!)).toBe(verwacht.netto);
  });

  it('reads one row per channel plus the total, with the model status', () => {
    expect(rijen.map((r) => r.kanaal).sort()).toEqual(['Alle', 'B2B', 'Retail', 'Webshop']);
    expect(rijen.find((r) => r.kanaal === 'Webshop')?.status).toBe('groen');
    expect(totaal?.status).toBe('oranje');
  });

  it('channel rows add up to the total', () => {
    const som = rijen
      .filter((r) => r.kanaal !== 'Alle')
      .reduce((s, r) => s + (r.omzet ?? 0), 0);
    expect(opCenten(som)).toBe(verwacht.omzet);
  });
});

describe('kanaalFilter', () => {
  it('adds no filter for Alle', () => {
    expect(kanaalFilter('Alle')).toBe('');
  });

  it('filters on dim_kanaal[kanaal]', () => {
    expect(kanaalFilter('Webshop')).toBe('TREATAS({"Webshop"}, dim_kanaal[kanaal]), ');
  });

  it('refuses values outside the fixed list', () => {
    // @ts-expect-error a value from outside the type must still be refused at runtime
    expect(() => kanaalFilter('Retail"}), x')).toThrow('Onbekend kanaal');
  });
});
