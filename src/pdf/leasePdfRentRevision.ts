/**
 * Textes juridiques « Révision du loyer » — jamais afficher la valeur brute API (ex. "none").
 */
export function getRentRevisionParagraph(indexationType: string | null | undefined): string {
  const raw = (indexationType ?? '').trim().toLowerCase();

  if (!raw || raw === 'none' || raw === 'null' || raw === 'undefined') {
    return 'Aucune indexation prévue au contrat. Le loyer demeure fixe pour toute la durée du bail, sauf accord exprès des parties constaté par avenant.';
  }

  if (raw === 'insee' || raw === 'irl' || raw.includes('irl')) {
    return (
      'Le loyer sera révisé chaque année à la date anniversaire du bail selon l’indice de référence des loyers (IRL) publié par l’INSEE, ' +
      'selon les modalités de calcul et dans les limites prévues par la loi et les usages, sauf stipulation contractuelle plus favorable au Locataire.'
    );
  }

  if (raw === 'manual') {
    return (
      'La révision du loyer est convenue de façon manuelle : toute modification du montant du loyer fera l’objet d’un avenant signé par les parties, ' +
      'sans indexation automatique sur un indice publié, sous réserve du respect du cadre légal applicable.'
    );
  }

  return (
    'La révision du loyer est régie selon les stipulations particulières convenues entre les parties, dans le respect des dispositions d’ordre public.'
  );
}
