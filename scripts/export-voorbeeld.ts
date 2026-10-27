// Runs every query of the sales room live on the semantic model (connector "verkoop")
// and stores the results as the bundled sample data in packages/frontend/src/data/voorbeeld/.
// The product queries run once without a product filter, so the sample has every product.
// Usage: npm run export:voorbeeld   (needs a signed-in Fabric identity for the CLI)

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ficheQueries, zaalQueries } from '../packages/frontend/src/data/zaal-dax';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const doel = join(root, 'packages/frontend/src/data/voorbeeld');

function voerUit(naam: string, query: string) {
  const invoer = JSON.stringify({ query, resultSetRowCountLimit: 2000 });
  const uit = execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['rayfin', 'connector', 'invoke', 'verkoop', 'executeQuery', '--input', invoer, '--output', 'json', '--max-inline-bytes', '100000000'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 }
  );
  // Without a large inline limit the CLI only returns a 20-row preview of bigger results
  const resultaat = JSON.parse(uit).output;
  if (resultaat.status !== 'success') {
    throw new Error(`${naam}: ${resultaat.error?.category} ${resultaat.error?.message}`);
  }
  console.log(`✅ ${naam.padEnd(14)} ${String(resultaat.table.rows.length).padStart(4)} rijen`);
  return resultaat.table;
}

const zaal = Object.fromEntries(Object.entries(zaalQueries()).map(([k, q]) => [k, voerUit(k, q)]));
const fiches = Object.fromEntries(
  Object.entries(ficheQueries(null)).map(([k, q]) => [k, voerUit(`fiche-${k}`, q)])
);
writeFileSync(join(doel, 'zaal.json'), JSON.stringify(zaal) + '\n');
writeFileSync(join(doel, 'fiches.json'), JSON.stringify(fiches) + '\n');
console.log('Opgeslagen in packages/frontend/src/data/voorbeeld/');
