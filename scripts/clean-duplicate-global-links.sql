-- Script SQL pour nettoyer les liens GLOBAL en doublon
-- Exécuter après le déploiement du fix pour nettoyer les données existantes

-- 1. Identifier les documents avec des liens GLOBAL en doublon
SELECT 
  d.id,
  d.filenameOriginal,
  GROUP_CONCAT(dl.linkedType || '-' || dl.linkedId) as liens
FROM Document d
LEFT JOIN DocumentLink dl ON d.id = dl.documentId 
WHERE dl.linkedType IN ('GLOBAL', 'global')
GROUP BY d.id, d.filenameOriginal
HAVING COUNT(dl.documentId) > 1;

-- 2. Supprimer les anciens liens GLOBAL (majuscules) en gardant les nouveaux (minuscules)
DELETE FROM DocumentLink 
WHERE linkedType = 'GLOBAL' 
  AND linkedId = 'GLOBAL'
  AND documentId IN (
    -- Seulement les documents qui ont aussi un lien 'global' (minuscules)
    SELECT DISTINCT documentId 
    FROM DocumentLink 
    WHERE linkedType = 'global' 
      AND linkedId = 'global'
  );

-- 3. Vérifier le résultat - il ne devrait plus y avoir de doublons
SELECT 
  d.id,
  d.filenameOriginal,
  GROUP_CONCAT(dl.linkedType || '-' || dl.linkedId) as liens,
  COUNT(dl.documentId) as nb_liens_global
FROM Document d
LEFT JOIN DocumentLink dl ON d.id = dl.documentId 
WHERE dl.linkedType IN ('GLOBAL', 'global')
GROUP BY d.id, d.filenameOriginal
HAVING COUNT(dl.documentId) > 1;

-- Si cette requête retourne 0 résultats, le problème est résolu!
