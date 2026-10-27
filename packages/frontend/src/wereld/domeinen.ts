import type { Status } from '@/data/kerncijfers';

/** A door in the lobby. Only Verkoop is built; the others show a building site. */
export interface Domein {
  id: 'financien' | 'verkoop' | 'hr';
  naam: string;
  status: Status | 'binnenkort';
  uitleg: string;
  open: boolean;
}

const procent = new Intl.NumberFormat('nl-BE', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

/**
 * The Verkoop door takes [Status] of the YTD total from query 5.2; the app
 * does not recompute the ±3% rule. Without a status it shows "binnenkort".
 */
export function maakDomeinen(
  totaal: { status: Status | null; groei: number | null } | undefined
): Domein[] {
  const groei = totaal?.groei;
  return [
    { id: 'financien', naam: 'Financiën', status: 'binnenkort', uitleg: 'Nog in opbouw', open: false },
    {
      id: 'verkoop',
      naam: 'Verkoop',
      status: totaal?.status ?? 'binnenkort',
      uitleg:
        groei === null || groei === undefined
          ? 'Omzet YTD'
          : `Omzet ${procent.format(groei)} t.o.v. vorig jaar`,
      open: true,
    },
    { id: 'hr', naam: 'HR', status: 'binnenkort', uitleg: 'Nog in opbouw', open: false },
  ];
}
