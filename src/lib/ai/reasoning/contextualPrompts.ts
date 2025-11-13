/**
 * COMPÉTENCE B - Générateur de prompts contextuels
 * Crée des prompts qui respectent les règles de raisonnement
 */

import { type UiContext } from '../context/getUiContext';
import { type NormalizedQuestion } from '../nlp/normalizeFr';
import { getGlobalSystemPrompt, getEnrichedSystemPrompt } from '../prompts/globalSystemPrompt';

/**
 * Génère un prompt système complet (Global + Compétence B)
 */
export function generateSystemPromptCompetenceB(
  uiContext?: UiContext
): string {
  // Commencer par le prompt global (Compétence A)
  const globalPrompt = uiContext
    ? getEnrichedSystemPrompt({
        route: uiContext.route,
        entity: uiContext.entity,
        period: uiContext.period,
        competence: 'B',
      })
    : getGlobalSystemPrompt();

  // Ajouter les spécificités de la Compétence B
  const competenceBPrompt = generateCompetenceBSpecificPrompt();

  return `${globalPrompt}\n\n${competenceBPrompt}`;
}

/**
 * Génère le prompt spécifique à la Compétence B
 */
function generateCompetenceBSpecificPrompt(): string {
  return `
═══════════════════════════════════════════════════════════
📋 COMPÉTENCE B - RÉPONSES CONTEXTUELLES
═══════════════════════════════════════════════════════════

Tu vas maintenant appliquer la **Compétence B** : répondre contextuellement sans fonction dédiée.

## RAPPEL DES RÈGLES COMPÉTENCE B

### 1. Période inférée selon intent

| Intent | Période par défaut |
|--------|-------------------|
| Tendance | 12 derniers mois |
| Statut/Factuel | Mois courant |
| Comparaison | Année courante |
| Diagnostic | Mois courant |

**IMPORTANT :** Toujours **mentionner** la période si inférée.

---

### 2. Scope automatique depuis la page

- Page \`/biens/[id]\` → scope au bien
- Page \`/baux/[id]\` → scope au bail
- Page \`/transactions\` → global
- Toujours **préciser le scope** dans la réponse

---

### 3. Format de réponse standardisé

\`\`\`
[Scope si scopé] Résultat avec **chiffres en gras**.

Détail : [Si pertinent]

📐 Méthode : [Comment calculé]

📅 Période : [Si inférée]

{"actions":[...]} [Si plan d'actions pertinent]
\`\`\`

---

### 4. Patterns de réponses (5 types)

**Factuelle :**
"Total **X €**, détail : Y encaissés, Z en attente."

**Comparaison :**
"**+12,5%** (de **28k €** en 2024 à **31,5k €** en 2025)."

**Tendance :**
"Total **X €** sur 12 mois. Pic : **mois Y** (**Z €**). Creux : **mois A** (**B €**)."

**Diagnostic :**
"**3 alertes** : • Expire dans X jours • Dépôt manquant • Indexation >12 mois"

**Projection :**
"Nouveau loyer estimé : **X €** (avant **Y €**). Écart : **+Z €**. ⚠️ Estimation indicative."

---

### 5. Calculs prêts à l'emploi

\`\`\`sql
-- Loyers encaissés
SELECT SUM(amount) FROM "Transaction" 
WHERE nature='LOYER' AND paidAt IS NOT NULL

-- Impayés (NOUVELLE LOGIQUE)
SELECT * FROM v_loyers_en_retard 
ORDER BY retard_jours DESC

-- Bail expiration
SELECT * FROM "Lease" 
WHERE endDate BETWEEN CURRENT_DATE AND CURRENT_DATE + 90
\`\`\`

---

**Applique maintenant ces règles à la question de l'utilisateur.**`;
}

/**
 * Génère un prompt utilisateur enrichi avec contexte
 */
export function generateUserPromptWithContext(
  question: string,
  normalized: NormalizedQuestion,
  uiContext: UiContext,
  sqlData?: any[],
  docData?: any[]
): string {
  let prompt = `Question : "${question}"\n\n`;
  
  // Contexte de page
  if (uiContext.entity) {
    prompt += `**Contexte de page** : Tu es sur la page du ${uiContext.entity.type} "${uiContext.entity.id}"\n`;
  } else {
    prompt += `**Contexte de page** : Vue globale (tous biens)\n`;
  }
  
  // Période
  if (normalized.timeRange) {
    prompt += `**Période détectée** : ${normalized.timeRange.label} (${normalized.timeRange.start.toISOString().split('T')[0]} → ${normalized.timeRange.end.toISOString().split('T')[0]})\n`;
  } else if (uiContext.period) {
    prompt += `**Période active** : ${uiContext.period.label}\n`;
  }
  
  // Données SQL si disponibles
  if (sqlData && sqlData.length > 0) {
    prompt += `\n**Données de la base** (${sqlData.length} ligne(s)) :\n`;
    prompt += JSON.stringify(sqlData.slice(0, 10), null, 2);
    
    if (sqlData.length > 10) {
      prompt += `\n... et ${sqlData.length - 10} ligne(s) supplémentaire(s)`;
    }
  }
  
  // Documents si disponibles
  if (docData && docData.length > 0) {
    prompt += `\n**Documents** (${docData.length}) :\n`;
    prompt += docData.slice(0, 5).map(d => `- ${d.fileName} (${d.type})`).join('\n');
  }
  
  prompt += `\n\nRéponds selon les règles de la Compétence B (voir système prompt).`;
  
  return prompt;
}

/**
 * Parse une réponse pour extraire le plan d'actions JSON
 */
export function extractActionPlan(answer: string): {
  cleanAnswer: string;
  actionPlan?: any;
} {
  // Chercher le JSON du plan d'actions
  const jsonMatch = answer.match(/\{"actions":\[.*?\]\}/);
  
  if (!jsonMatch) {
    return { cleanAnswer: answer };
  }
  
  try {
    const actionPlan = JSON.parse(jsonMatch[0]);
    const cleanAnswer = answer.replace(jsonMatch[0], '').trim();
    
    return { cleanAnswer, actionPlan };
  } catch (e) {
    return { cleanAnswer: answer };
  }
}

/**
 * Exemples de réponses formatées (pour few-shot)
 */
export const RESPONSE_EXAMPLES = [
  {
    question: "Combien j'ai encaissé ce mois-ci ?",
    context: "Bien Villa Familiale, période 2025-11",
    answer: `Encaissements du **2025-11** : **3 250 €** (Bien Villa Familiale).

Détail : 2 loyers encaissés, 1 en attente (**650 €**).

Méthode : Somme des transactions type=loyer sens=in sur 2025-11 scope bien=Villa Familiale.

{"actions":[{"op":"read","entity":"transactions","where":{"bien_id":"villa-123","type":"loyer","sens":"in","period":"2025-11","fields":["id","date","montant","statut"]}}]}`,
  },
  {
    question: "Qui est en retard ?",
    context: "Global, tous biens",
    answer: `**3 locataires** en retard :

• Jean D*** (Appt Paris) - Mars 2025 - **247 jours** - URGENT
• Marie M*** (Studio Lyon) - Juin 2025 - **158 jours** - URGENT  
• Paul L*** (Villa Nice) - Oct 2025 - **36 jours** - IMPORTANT

Méthode : Vue v_loyers_en_retard (accounting_month + nature configurée).

{"actions":[{"op":"read","entity":"v_loyers_en_retard","where":{"priorite":"URGENT","limit":20}}]}`,
  },
  {
    question: "Tendance des charges sur 12 mois",
    context: "Global, période 12 mois glissants",
    answer: `Total **4 780 €** sur 12 mois glissants.

Pic : **2025-03** (**720 €**) lié à 'pompe à chaleur'
Creux : **2025-07** (**120 €**)

Méthode : Somme mensuelle nature=entretien sens=out de 2024-12 à 2025-11.

{"actions":[{"op":"read","entity":"depenses","where":{"nature":"entretien","period":"2024-12/2025-11","group_by":"mois"}}]}`,
  },
];

