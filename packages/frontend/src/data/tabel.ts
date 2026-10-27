import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';

/**
 * Reads a query result by column name ("[Omzet]", "dim_kanaal[kanaal]")
 * instead of by position, so a reordered query cannot silently swap values.
 */
export function leesRijen(tabel: QueryTable): Array<(kolom: string) => unknown> {
  const index = new Map(tabel.columns.map((k, i) => [k.name, i]));
  return tabel.rows.map((rij) => (kolom: string) => {
    const i = index.get(kolom);
    if (i === undefined) throw new Error(`Kolom ontbreekt in het resultaat: ${kolom}`);
    return rij[i];
  });
}

/** Number or null; BLANK() in DAX arrives as null. */
export function getal(waarde: unknown): number | null {
  if (waarde === null || waarde === undefined) return null;
  const n = typeof waarde === 'number' ? waarde : Number(waarde);
  return Number.isFinite(n) ? n : null;
}

/** Rounds floating point noise away: model sums arrive as 2998977.930000001. */
export function opCenten(waarde: number): number {
  return Math.round(waarde * 100) / 100;
}
