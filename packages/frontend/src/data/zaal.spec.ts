import { describe, expect, it } from 'vitest';

import verwacht from '../../../../checks/kerncijfers-5.2.verwacht.json';

import { fotoVoor } from './foto';
import { opCenten } from './tabel';
import fiches from './voorbeeld/fiches.json';
import tabellen from './voorbeeld/zaal.json';
import { type FicheTabellen, type Knoop, type ZaalTabellen, leesFiche, leesZaal } from './zaal';
import { productFilter, top10Query } from './zaal-dax';

const zaal = leesZaal(tabellen as unknown as ZaalTabellen, fotoVoor);

describe('wall cards (per channel and month)', () => {
  it('match the handover totals of query 5.2 to the cent', () => {
    const t = zaal.kerncijfers.alle.totaal;
    expect(opCenten(t.omzet)).toBe(verwacht.omzet);
    expect(opCenten(t.omzetVorig)).toBe(verwacht.omzetVJ);
    expect(opCenten(t.kosten)).toBe(verwacht.bedrijfskosten);
    expect(opCenten(t.netto)).toBe(verwacht.netto);
    expect(t.status).toBe('oranje');
  });

  it('have nine months per channel, and the running total of September is the YTD', () => {
    for (const k of ['alle', 'Retail', 'B2B', 'Webshop'] as const) {
      const c = zaal.kerncijfers[k];
      expect(c.maanden.map((m) => m.naam)).toEqual(['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep']);
      expect(opCenten(c.maanden.at(-1)!.omzetCumul)).toBe(opCenten(c.totaal.omzet));
    }
  });

  it('carry [Status] per channel', () => {
    expect(zaal.kerncijfers.Webshop.totaal.status).toBe('groen');
    expect(zaal.kerncijfers.Retail.totaal.status).toBe('oranje');
  });
});

describe('decomposition tree', () => {
  const bladeren = (k: Knoop): Knoop[] => (k.kinderen.length ? k.kinderen.flatMap(bladeren) : [k]);

  it('runs Verkoop › Kanaal › Productgroep › Subgroep › Product', () => {
    expect(zaal.boom.naam).toBe('Verkoop');
    expect(zaal.boom.kinderen.map((k) => k.naam).sort()).toEqual(['B2B', 'Retail', 'Webshop']);
    const blad = bladeren(zaal.boom)[0]!;
    expect(blad.niveau).toBe(4);
    expect(blad.productId).toBeGreaterThan(0);
    expect(blad.ouder?.ouder?.ouder?.ouder).toBe(zaal.boom);
  });

  it('matches row 1 of control query 5.1', () => {
    const retail = zaal.boom.kinderen.find((k) => k.naam === 'Retail')!;
    const serum = retail.kinderen
      .find((k) => k.naam === 'Gelaat')!
      .kinderen.find((k) => k.naam === 'Serums')!
      .kinderen.find((k) => k.naam === 'Niacinamide Serum')!;
    expect([serum.stuks, serum.vorigJaar]).toEqual([3907, 3846]);
  });

  it('sorts every level from most to fewest units', () => {
    const k = zaal.boom.kinderen;
    expect(k.map((x) => x.stuks)).toEqual([...k.map((x) => x.stuks)].sort((a, b) => b - a));
  });
});

describe('stores', () => {
  it('show Brussels as the central warehouse for B2B and Webshop', () => {
    expect(zaal.filialen.B2B.map((f) => [f.naam, f.centraal])).toEqual([['Brussel', true]]);
    expect(zaal.filialen.Webshop.map((f) => f.naam)).toEqual(['Brussel']);
    expect(zaal.filialen.Retail).toHaveLength(7);
    expect(zaal.filialen.alle).toHaveLength(8);
  });

  it('match control query 5.3 and bring their top 3', () => {
    const antwerpen = zaal.filialen.Retail.find((f) => f.naam === 'Antwerpen')!;
    expect([antwerpen.stuks, antwerpen.vorig, antwerpen.status]).toEqual([15788, 15055, 'groen']);
    expect(antwerpen.toppers).toHaveLength(3);
    expect(antwerpen.toppers[0]!.omzet).toBeGreaterThanOrEqual(antwerpen.toppers[2]!.omzet);
  });
});

describe('top 10', () => {
  it('matches control query 5.4', () => {
    const [eerste] = zaal.top10.alle;
    expect(zaal.top10.alle).toHaveLength(10);
    expect(eerste!.naam).toBe('Anti-Aging Creme Normale en Gemengde Huid');
    expect(Math.round(eerste!.omzet)).toBe(193874);
    expect(eerste!.rang).toBe(1);
  });

  it('shows the bundled photo of the subgroup while foto_url is empty', () => {
    const [eerste] = zaal.top10.alle;
    expect(eerste!.subgroep).toBe('Dag- en nachtcremes');
    expect(eerste!.foto).toBe('/fotos/nachtcreme.avif');
    expect(fotoVoor('Iets Nieuws', null, 'Onbekend')).toMatch(/^data:image\/svg\+xml/);
    expect(fotoVoor('X', 'https://voorbeeld.test/x.png', 'Serums')).toBe('https://voorbeeld.test/x.png');
  });

  it('filters per channel on dim_kanaal[kanaal]', () => {
    expect(top10Query('Webshop')).toContain('TREATAS({"Webshop"}, dim_kanaal[kanaal])');
    expect(top10Query('Alle')).not.toContain('dim_kanaal[kanaal])');
  });
});

describe('product sheet', () => {
  const f = leesFiche(fiches as unknown as FicheTabellen, 59, fotoVoor);

  it('matches control query 5.5 for product 59', () => {
    expect([f.catalogusprijs, f.kostprijs]).toEqual([52.89, 13.22]);
    expect(opCenten(f.omzet)).toBe(193874.01);
    expect(f.stuks).toBe(4049);
    expect(opCenten(f.verkoopprijs)).toBe(47.88);
    expect(Math.round(f.margePct * 100)).toBe(72);
    expect([f.rang, f.rangVorig]).toEqual([1, 1]);
  });

  it('has revenue per month against last year', () => {
    expect(f.maanden).toHaveLength(9);
    expect([Math.round(f.maanden[0]!.omzet), Math.round(f.maanden[0]!.vorig)]).toEqual([24491, 23266]);
  });

  it('only accepts a whole number as product filter', () => {
    expect(productFilter(59)).toBe('TREATAS({59}, dim_product[product_id]), ');
    expect(() => productFilter(Number.NaN)).toThrow('Ongeldig product_id');
  });
});
