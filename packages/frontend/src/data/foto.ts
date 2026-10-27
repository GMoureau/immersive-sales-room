// Product photos come from dim_product[foto_url]. While that column is empty, each
// subgroup gets one of the bundled photos (public/fotos, same origin so they also work
// as 3D textures); a subgroup without a photo gets a drawn placeholder with its initials.

const FOTO_PER_SUBGROEP: Record<string, string> = {
  Serums: 'olie',
  'Dag- en nachtcremes': 'nachtcreme',
  Reinigers: 'zeep',
  Oogomtrekcremes: 'revitalizer',
  Zonnebescherming: 'zonnecreme',
  Zelfbruiners: 'zelfbruiner',
  Haar: 'conditioner',
  Lichaam: 'interieurparfum',
  'Routines en pakketten': 'parfum',
};

const TINTEN = ['#efe7fd', '#e9e2fb', '#f3e8fb', '#e7e6fa', '#f1e9f9'];

function initialen(naam: string): string {
  return naam
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ÿ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function escape(tekst: string): string {
  return tekst.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function plaatshouder(naam: string): string {
  let h = 0;
  for (const c of naam) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const tint = TINTEN[h % TINTEN.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a36cf6"/><stop offset="1" stop-color="#5b2bb8"/></linearGradient></defs>
  <rect width="400" height="400" rx="40" fill="${tint}"/>
  <rect x="172" y="70" width="56" height="34" rx="8" fill="#27282b"/>
  <rect x="134" y="100" width="132" height="230" rx="34" fill="url(#g)"/>
  <rect x="152" y="180" width="96" height="70" rx="10" fill="#ffffff" opacity=".92"/>
  <text x="200" y="228" font-family="Inter, system-ui, sans-serif" font-size="34" font-weight="600" text-anchor="middle" fill="#5b2bb8">${escape(initialen(naam))}</text>
  <text x="200" y="372" font-family="Inter, system-ui, sans-serif" font-size="20" text-anchor="middle" fill="#8a86a0">foto volgt</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The photo from the model; otherwise the bundled photo of the subgroup, or a placeholder. */
export function fotoVoor(naam: string, url: string | null, subgroep: string | null = null): string {
  if (url && /^https?:\/\//.test(url)) return url;
  const foto = subgroep ? FOTO_PER_SUBGROEP[subgroep] : undefined;
  return foto ? `${import.meta.env.BASE_URL}fotos/${foto}.avif` : plaatshouder(naam);
}
