export type ReleaseNote = {
  id: string;
  version: number;
  toast: string;
  modal: string;
};

export const RELEASES: ReleaseNote[] = [
  {
    id: 'stability-transactions-documents',
    version: 1,
    toast: `Stabilité améliorée des transactions et des documents.
Correction des pièces jointes et des notifications répétées.
Affichage désormais immédiat et fiable après création.`,
    modal: `Amélioration de la stabilité des transactions et des documents.

- Correction des notifications répétées de synchronisation
- Fiabilisation des pièces jointes (plus de disparition)
- Affichage immédiat des transactions après création

L’expérience est désormais plus fluide et fiable.`,
  },
];

export function getReleaseStorageKey(release: ReleaseNote): string {
  return `release:${release.id}:v${release.version}`;
}

export function getReleaseModalViewedStorageKey(release: ReleaseNote): string {
  return `${getReleaseStorageKey(release)}:modal-viewed`;
}

export function getLatestRelease(): ReleaseNote | null {
  if (RELEASES.length === 0) return null;
  return RELEASES[RELEASES.length - 1] ?? null;
}
