#!/usr/bin/env node
// Runs control query 5.2 live on the semantic model (connector "verkoop") and
// compares the four totals with checks/kerncijfers-5.2.verwacht.json, to the cent.
// Usage: npm run check:model   (needs a signed-in Fabric identity for the CLI)

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const verwacht = JSON.parse(
  readFileSync(join(root, 'checks/kerncijfers-5.2.verwacht.json'), 'utf8')
);

let uitvoer;
try {
  uitvoer = execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      'rayfin',
      'connector',
      'invoke',
      'verkoop',
      'executeQuery',
      '--file',
      'checks/kerncijfers-5.2.json',
      '--output',
      'json',
    ],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
  );
} catch {
  console.error('❌ De query kon niet uitgevoerd worden (zie de melding hierboven).');
  process.exit(1);
}

const resultaat = JSON.parse(uitvoer).output;
if (resultaat.status !== 'success') {
  console.error(`❌ ${resultaat.error?.category}: ${resultaat.error?.message}`);
  process.exit(1);
}

const { columns, rows } = resultaat.table;
const kolom = (naam) => columns.findIndex((k) => k.name === naam);
const totaal = rows.find((r) => r[kolom('[is_totaal]')] === true);
if (!totaal) {
  console.error('❌ Geen totaalrij in het resultaat.');
  process.exit(1);
}

const centen = (n) => Math.round(n * 100) / 100;
const vergelijk = [
  ['Omzet', '[Omzet]', verwacht.omzet],
  ['Omzet VJ', '[Omzet VJ]', verwacht.omzetVJ],
  ['Bedrijfskosten', '[Bedrijfskosten]', verwacht.bedrijfskosten],
  ['Nettowinst', '[Netto]', verwacht.netto],
];

let fouten = 0;
for (const [label, naam, doel] of vergelijk) {
  const gekregen = centen(totaal[kolom(naam)]);
  const ok = gekregen === doel;
  if (!ok) fouten++;
  console.log(`${ok ? '✅' : '❌'} ${label.padEnd(15)} ${gekregen.toFixed(2).padStart(14)}  (verwacht ${doel.toFixed(2)})`);
}
process.exit(fouten ? 1 : 0);
