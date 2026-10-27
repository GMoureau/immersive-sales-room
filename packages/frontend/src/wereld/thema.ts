// Licht of donker: de 3D-wereld en de detailkaarten volgen thema.donker (zetThema).
// Wie wil weten wanneer het thema wisselt, luistert met opThema.
export const thema = { donker: false };
const luisteraars = new Set<(donker: boolean) => void>();

export function opThema(f: (donker: boolean) => void): () => boolean {
  luisteraars.add(f);
  return () => luisteraars.delete(f);
}

export function zetThema(donker: boolean): void {
  if (thema.donker === donker) return;
  thema.donker = donker;
  document.documentElement.classList.toggle('ill3d-donker', donker);
  luisteraars.forEach(f => f(donker));
}

