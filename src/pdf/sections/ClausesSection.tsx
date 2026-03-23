import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { leasePdfStyles as s } from '../leasePdfTheme';
import { tenantNoticeMonths } from '../leasePdfUtils';
import type { LeasePdfClausesConfig } from '../leasePdfClauses';
import type { LeasePdfLease } from '../leasePdfTypes';

type Props = {
  lease: LeasePdfLease;
  clauses: LeasePdfClausesConfig;
};

const LANDLORD_NOTICE_MONTHS = 6;

/** §7 — Congé (page regroupée avec finances si besoin) */
export function ClausesSectionConge({ lease }: Pick<Props, 'lease'>) {
  const preavisLoc = tenantNoticeMonths(lease);
  const preavisLabel = preavisLoc === 1 ? 'un (1) mois' : `${preavisLoc} mois`;

  return (
    <>
      <View style={[s.sectionHeader, s.sectionHeaderPageLead]}>
        <Text style={s.sectionHeaderText}>7. Congé et résiliation</Text>
      </View>
      <View style={s.clauseBox}>
        <Text style={s.clauseBoxTitle}>Locataire</Text>
        <Text style={s.paragraph}>
          Le Locataire peut résilier le bail à tout moment, sous réserve de respecter un préavis de <Text style={{ fontWeight: 'bold' }}>{preavisLabel}</Text>,
          notifié par lettre recommandée avec accusé de réception ou par tout moyen équivalent permettant de donner date certaine, conformément aux dispositions
          en vigueur selon la nature du bail.
        </Text>
        <Text style={s.clauseBoxTitle}>Bailleur</Text>
        <Text style={s.paragraph}>
          Le Bailleur peut donner congé à l’expiration du bail ou en cours de bail dans les cas prévus par la loi (notamment pour reprendre ou vendre le logement,
          motif légitime et sérieux), sous réserve du respect des délais et modalités de notification (souvent un préavis de {LANDLORD_NOTICE_MONTHS} mois pour un
          logement vide en résidence principale du Locataire, sous réserve des exceptions légales).
        </Text>
      </View>
    </>
  );
}

/** §8–9 — Indemnité (option) + obligations */
export function ClausesSectionIndemniteEtObligations({ lease, clauses }: Props) {
  return (
    <>
      {clauses.indemniteOccupation ? (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>8. Indemnité d’occupation</Text>
          </View>
          <View style={s.card}>
            <Text style={s.paragraph}>
              En cas de maintien dans les lieux sans titre après résiliation ou expiration du bail, une indemnité d’occupation équivalente au double du loyer
              dernièrement dû pourra être réclamée par le Bailleur, sans préjudice de tout autre droit et recours.
            </Text>
          </View>
        </>
      ) : null}

      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderText}>{clauses.indemniteOccupation ? '9' : '8'}. Obligations des parties</Text>
      </View>
      <View style={s.card}>
        <Text style={s.subTitle}>Obligations du Locataire</Text>
        <Text style={s.bullet}>• Payer le loyer et les charges aux dates convenues.</Text>
        <Text style={s.bullet}>• Assurer l’entretien courant du logement et les menues réparations locatives.</Text>
        <Text style={s.bullet}>• User paisiblement des lieux, respecter le règlement de copropriété le cas échéant.</Text>
        <Text style={s.bullet}>• S’abstenir de sous-louer ou de céder le bail sans accord écrit du Bailleur (sauf exceptions légales).</Text>
        <Text style={s.bullet}>• Répondre des dégradations imputables à son fait ou à celui des personnes dont il répond.</Text>

        <Text style={[s.subTitle, { marginTop: 10 }]}>Obligations du Bailleur</Text>
        <Text style={s.bullet}>• Délivrer un logement décent, conforme aux prescriptions légales et aux éléments constatés lors de la visite.</Text>
        <Text style={s.bullet}>• Assurer les grosses réparations et l’entretien des éléments hors « entretien locatif ».</Text>
        <Text style={s.bullet}>• Respecter la jouissance paisible du Locataire et la confidentialité des informations communiquées.</Text>
      </View>
    </>
  );
}

/** Suite des clauses : numérotation compacte à partir de 10 (aucun trou si clause 12 absente) */
export function ClausesSectionPart2({ lease, clauses }: Props) {
  let num = 10;

  return (
    <>
      <View style={[s.sectionHeader, s.sectionHeaderClauseLead]}>
        <Text style={s.sectionHeaderText}>{`${num++}. Assurance`}</Text>
      </View>
      <View style={s.card}>
        <Text style={s.paragraph}>
          Le Locataire est tenu de souscrire une assurance habitation couvrant les risques locatifs (incendie, dégâts des eaux, responsabilité civile) et de justifier
          annuellement de la souscription au Bailleur. À défaut, le Bailleur pourra souscrire une assurance pour le compte du Locataire et en répercuter le coût.
        </Text>
      </View>

      {clauses.clauseResolutoire ? (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>{num++}. Clause résolutoire</Text>
          </View>
          <View style={s.clauseBox}>
            <Text style={s.paragraph}>
              Le présent bail sera résilié de plein droit, sans préjudice de dommages et intérêts, en cas de non-paiement du loyer ou des charges aux termes
              convenus, de non-justification d’assurance dans les délais, ou de trouble de jouissance grave, après mise en demeure restée infructueuse dans les
              délais légaux ou contractuels.
            </Text>
          </View>
        </>
      ) : null}

      {clauses.solidarite ? (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>{`${num++}. Clause de solidarité`}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.paragraph}>
              Lorsque plusieurs personnes sont Locataires du présent bail, elles sont tenues solidairement au paiement de l’ensemble des obligations résultant du
              contrat (loyer, charges, indemnités et accessoires), jusqu’à libération complète.
            </Text>
          </View>
        </>
      ) : null}

      {clauses.notificationsElectroniques ? (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>{num++}. Notifications électroniques</Text>
          </View>
          <View style={s.card}>
            <Text style={s.paragraph}>
              Les parties acceptent, dans la mesure permise par la loi, l’usage des communications à distance (courriel, messagerie sécurisée, plateforme de
              signature ou de gestion locative telle que Smartimmo) pour l’échange d’informations, d’avis, de relances et de pièces contractuelles, sous réserve de
              pouvoir en apporter la preuve en cas de litige. Les adresses électroniques communiquées font foi jusqu’à notification d’un changement.
            </Text>
          </View>
        </>
      ) : null}

      {clauses.rgpd ? (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>{`${num++}. Données personnelles (RGPD)`}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.paragraph}>
              Les données personnelles collectées sont traitées dans le cadre de la gestion du bail, de la facturation, des obligations légales et comptables, et du
              bon fonctionnement des outils numériques utilisés. Les parties disposent d’un droit d’accès, de rectification et de suppression dans les limites
              prévues par le règlement (UE) 2016/679 et la loi « Informatique et libertés ».
            </Text>
          </View>
        </>
      ) : null}

      {clauses.annexesListe ? (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>{`${num++}. Annexes`}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.bullet}>• Diagnostic de performance énergétique (DPE)</Text>
            <Text style={s.bullet}>• État des risques et pollutions (ERP) le cas échéant</Text>
            <Text style={s.bullet}>• État des lieux d’entrée et de sortie</Text>
            <Text style={s.bullet}>• Règlement de copropriété et état descriptif de division si applicable</Text>
            <Text style={s.bullet}>• Inventaire et état du mobilier pour location meublée</Text>
            <Text style={s.paragraph}>
              Les annexes énumérées ci-dessus, lorsqu’elles existent, sont parties intégrantes du présent contrat.
            </Text>
          </View>
        </>
      ) : null}

      {lease.notes ? (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>Clauses particulières</Text>
          </View>
          <View style={s.card}>
            <Text style={s.paragraph}>{lease.notes}</Text>
          </View>
        </>
      ) : null}
    </>
  );
}

/** Blocs 7–9 complets (tests / export unique) */
export function ClausesSectionPart1(props: Props) {
  return (
    <>
      <ClausesSectionConge lease={props.lease} />
      <ClausesSectionIndemniteEtObligations {...props} />
    </>
  );
}

export function ClausesSection(props: Props) {
  return (
    <>
      <ClausesSectionPart1 {...props} />
      <ClausesSectionPart2 {...props} />
    </>
  );
}
