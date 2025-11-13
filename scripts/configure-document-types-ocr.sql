-- =====================================================
-- Script de configuration des types de documents
-- pour l'extraction automatique OCR → Transaction
-- =====================================================
-- 
-- Ce script configure les colonnes JSON de DocumentType
-- pour activer la suggestion automatique de transactions
--
-- Utilisation :
--   psql -d smartimmo -f scripts/configure-document-types-ocr.sql
--
-- =====================================================

-- =====================================================
-- 1. RELEVÉ DE COMPTE PROPRIÉTAIRE
-- =====================================================

UPDATE "DocumentType"
SET 
  -- Configuration d'extraction
  "suggestionsConfig" = '{
    "regex": {
      "periode": "(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|Jan|Fév|Mar|Avr|Mai|Juin|Juil|Août|Sep|Oct|Nov|Déc) ?(20\\d{2})",
      "montant": "([0-9]{1,}[\\., ]?[0-9]{0,3}[\\.,][0-9]{2}) ?€?",
      "bien": "(Appartement|Maison|Studio|T[0-9]|F[0-9]|Lot) ?([A-Z0-9\\-]+)?",
      "reference": "Réf[érence\\.:]* ?([A-Z0-9\\-]{4,})",
      "date": "([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})"
    },
    "libelleTemplate": "Loyer {periode} - {bien}"
  }'::jsonb,
  
  -- Mapping nature/catégorie
  "defaultContexts" = '{
    "autoCreateAboveConfidence": 0.85,
    "natureCategorieMap": {
      "RECETTE_LOYER": "Loyer + Charges",
      "DEPENSE_GESTION": "Commission agence"
    },
    "codeSystemMap": {
      "LOYER": "NATURE_LOYER",
      "COMMISSION": "NATURE_COMMISSION"
    }
  }'::jsonb,
  
  -- Règles de verrouillage
  "flowLocks" = '[
    {
      "if": "nature == ''DEPENSE_GESTION''",
      "lock": ["categoryId"],
      "reason": "Catégorie automatique pour commissions d''agence"
    }
  ]'::jsonb,
  
  -- Métadonnées
  "metaSchema" = '{
    "fields": ["periode", "montant", "bien", "reference", "date"],
    "confidenceThreshold": 0.6,
    "version": "v1.0",
    "requiredFields": ["montant", "periode"]
  }'::jsonb,
  
  -- Mise à jour timestamp
  "updatedAt" = NOW()

WHERE "code" = 'RELEVE_COMPTE_PROP';


-- =====================================================
-- 2. QUITTANCE DE LOYER
-- =====================================================

UPDATE "DocumentType"
SET 
  "suggestionsConfig" = '{
    "regex": {
      "periode": "Période[\\s:]*([0-9]{2}/[0-9]{4}|[a-zéû]+ [0-9]{4})",
      "montant": "Montant[\\s:]*([0-9]+[\\.,][0-9]{2})",
      "bien": "Bien[\\s:]*([^\\n]+)",
      "locataire": "Locataire[\\s:]*([^\\n]+)",
      "date": "Date[\\s:]*([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})"
    },
    "libelleTemplate": "Quittance {periode}"
  }'::jsonb,
  
  "defaultContexts" = '{
    "natureCategorieMap": {
      "RECETTE_LOYER": "Loyer + Charges"
    }
  }'::jsonb,
  
  "metaSchema" = '{
    "fields": ["periode", "montant", "bien", "locataire"],
    "confidenceThreshold": 0.7,
    "version": "v1.0"
  }'::jsonb,
  
  "updatedAt" = NOW()

WHERE "code" = 'QUITTANCE_LOYER';


-- =====================================================
-- 3. FACTURE TRAVAUX
-- =====================================================

UPDATE "DocumentType"
SET 
  "suggestionsConfig" = '{
    "regex": {
      "date": "Date[\\s:]*([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})",
      "montant": "Total TTC[\\s:]*([0-9]+[\\.,][0-9]{2})",
      "reference": "Facture n°[\\s:]*([A-Z0-9\\-]+)",
      "prestataire": "SIRET[\\s:]*[0-9]+ ?([^\\n]+)",
      "bien": "(Appartement|Maison|Studio|Lot) ?([A-Z0-9\\-]+)?"
    },
    "libelleTemplate": "Travaux {prestataire} - Facture {reference}"
  }'::jsonb,
  
  "defaultContexts" = '{
    "natureCategorieMap": {
      "DEPENSE_ENTRETIEN": "Travaux et réparations",
      "DEPENSE_AMELIORATION": "Travaux d''amélioration"
    }
  }'::jsonb,
  
  "metaSchema" = '{
    "fields": ["date", "montant", "reference", "prestataire", "bien"],
    "confidenceThreshold": 0.5,
    "version": "v1.0"
  }'::jsonb,
  
  "updatedAt" = NOW()

WHERE "code" = 'FACTURE_TRAVAUX';


-- =====================================================
-- 4. AVIS DE TAXE FONCIÈRE
-- =====================================================

UPDATE "DocumentType"
SET 
  "suggestionsConfig" = '{
    "regex": {
      "annee": "Année[\\s:]*([0-9]{4})",
      "montant": "Montant[\\s:]*([0-9]+[\\.,][0-9]{2})",
      "bien": "Adresse[\\s:]*([^\\n]+)",
      "reference": "Référence[\\s:]*([A-Z0-9\\-]+)",
      "date": "Date limite[\\s:]*([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})"
    },
    "libelleTemplate": "Taxe foncière {annee}"
  }'::jsonb,
  
  "defaultContexts" = '{
    "natureCategorieMap": {
      "DEPENSE_TAXE": "Taxe foncière"
    }
  }'::jsonb,
  
  "metaSchema" = '{
    "fields": ["annee", "montant", "bien", "reference"],
    "confidenceThreshold": 0.6,
    "version": "v1.0"
  }'::jsonb,
  
  "updatedAt" = NOW()

WHERE "code" = 'AVIS_TAXE_FONCIERE';


-- =====================================================
-- 5. FACTURE ASSURANCE
-- =====================================================

UPDATE "DocumentType"
SET 
  "suggestionsConfig" = '{
    "regex": {
      "date": "Date[\\s:]*([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})",
      "montant": "Prime annuelle[\\s:]*([0-9]+[\\.,][0-9]{2})",
      "reference": "Police[\\s:]*([A-Z0-9\\-]+)",
      "bien": "(Appartement|Maison|Studio|Lot) ?([A-Z0-9\\-]+)?",
      "periode": "Période[\\s:]*([0-9]{2}/[0-9]{4})"
    },
    "libelleTemplate": "Assurance {periode}"
  }'::jsonb,
  
  "defaultContexts" = '{
    "natureCategorieMap": {
      "DEPENSE_ASSURANCE": "Assurance PNO",
      "DEPENSE_ASSURANCE_GLI": "Assurance GLI"
    }
  }'::jsonb,
  
  "metaSchema" = '{
    "fields": ["date", "montant", "reference", "bien", "periode"],
    "confidenceThreshold": 0.6,
    "version": "v1.0"
  }'::jsonb,
  
  "updatedAt" = NOW()

WHERE "code" = 'FACTURE_ASSURANCE';


-- =====================================================
-- 6. FACTURE EDF/GAZ (Charges non récupérables)
-- =====================================================

UPDATE "DocumentType"
SET 
  "suggestionsConfig" = '{
    "regex": {
      "date": "Date[\\s:]*([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})",
      "montant": "Montant à payer[\\s:]*([0-9]+[\\.,][0-9]{2})",
      "reference": "Référence[\\s:]*([A-Z0-9\\-]+)",
      "bien": "Adresse[\\s:]*([^\\n]+)",
      "periode": "Période[\\s:]*([0-9]{2}/[0-9]{4})"
    },
    "libelleTemplate": "Énergie {periode}"
  }'::jsonb,
  
  "defaultContexts" = '{
    "natureCategorieMap": {
      "DEPENSE_ENERGIE": "Électricité et gaz"
    }
  }'::jsonb,
  
  "metaSchema" = '{
    "fields": ["date", "montant", "reference", "bien", "periode"],
    "confidenceThreshold": 0.5,
    "version": "v1.0"
  }'::jsonb,
  
  "updatedAt" = NOW()

WHERE "code" = 'FACTURE_ENERGIE';


-- =====================================================
-- VÉRIFICATION DE LA CONFIGURATION
-- =====================================================

-- Afficher tous les types configurés
SELECT 
  "code",
  "label",
  CASE 
    WHEN "suggestionsConfig" IS NOT NULL THEN '✅ Configuré'
    ELSE '❌ Non configuré'
  END as "Statut",
  ("metaSchema"->>'confidenceThreshold')::float as "Seuil confiance"
FROM "DocumentType"
WHERE "isActive" = true
ORDER BY "order";


-- Afficher les détails de configuration d'un type spécifique
-- SELECT 
--   "code",
--   "label",
--   "suggestionsConfig",
--   "defaultContexts",
--   "flowLocks",
--   "metaSchema"
-- FROM "DocumentType"
-- WHERE "code" = 'RELEVE_COMPTE_PROP';


-- =====================================================
-- NOTES
-- =====================================================
-- 
-- Après avoir exécuté ce script :
-- 1. Redémarrer l'application : npm run dev
-- 2. Uploader un document test
-- 3. Vérifier les logs console pour la suggestion
-- 4. Ajuster les regex si nécessaire
--
-- Pour ajouter un nouveau type :
-- 1. Créer le DocumentType via l'interface admin
-- 2. Ajouter les mots-clés de reconnaissance
-- 3. Exécuter un UPDATE similaire ci-dessus
-- 4. Tester avec des documents réels
--
-- =====================================================

