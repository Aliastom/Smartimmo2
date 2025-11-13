# 📄 Support DOCX - Extraction de Texte 

## 🎯 Objectif

Ajout du support des fichiers **DOCX/DOC** dans la chaîne d'extraction de texte de SmartImmo, sans modification du pipeline existant.

## ✅ Fonctionnalités Ajoutées

### **Extraction Directe DOCX**
- **Bibliothèque** : `mammoth` pour extraction de texte brut
- **Formats supportés** : `.docx`, `.doc`  
- **Mode d'extraction** : Texte brut sans OCR (plus rapide et précis que la conversion PDF)

### **Intégration Transparente**
- **API inchangée** : `/api/ocr` garde la même signature
- **Pipeline identique** : Le texte DOCX passe par le même processus de classification que les PDF
- **Fallback automatique** : Si l'extraction directe échoue, conversion PDF comme avant
- **Base de données** : Même champ `extractedText` utilisé pour la persistance

## 🔧 Architecture

```
Fichier DOCX uploadé
    ↓
1. Détection type de fichier (DOCX/DOC)
    ↓
2. Extraction directe avec mammoth
    ↓ (succès)
3. Texte brut → normalisation → classification
    ↓ (échec)
4. FALLBACK: Conversion PDF → pdf-parse (logique existante)
    ↓
5. Stockage en BDD (même champ que PDF)
    ↓
6. Pipeline d'analyse existant (inchangé)
```

## 📁 Fichiers Modifiés/Ajoutés

### **Nouveau Service**
- `src/services/DocxTextExtractor.ts` - Service d'extraction DOCX avec mammoth

### **API Modifiée**  
- `src/app/api/ocr/route.ts` - Ajout de l'extraction directe DOCX avant conversion PDF

### **Dépendances**
- `mammoth` - Extraction de texte depuis DOCX/DOC

## 🚀 Sources d'Extraction Supportées

| Source | Description | Fichiers |
|--------|-------------|----------|
| `pdf-parse` | PDF avec texte natif | `.pdf` |
| `tesseract` | OCR pour PDF scannés/images | `.pdf`, `.jpg`, `.png` |
| `converted-pdf` | Conversion automatique → PDF | Office, OpenDocument |
| **`docx-direct`** | **Extraction directe DOCX** | **`.docx`, `.doc`** |

## 📊 Tests Manuels

### **Test 1: PDF inchangé** ✅
```bash
# Upload PDF → comportement identique
POST /api/ocr + PDF → source: "pdf-parse" | "tesseract"
```

### **Test 2: DOCX extraction directe** ✅
```bash  
# Upload DOCX → extraction directe
POST /api/ocr + DOCX → source: "docx-direct"
```

### **Test 3: Persistance BDD** ✅
```sql
-- Vérifier que le texte DOCX est stocké comme PDF
SELECT extractedText, ocrStatus FROM Document WHERE fileName LIKE '%.docx';
```

### **Test 4: Pipeline d'analyse** ✅
```bash
# Classification automatique après extraction DOCX
DOCX → texte → classification → suggestions de type
```

## 🔄 Flux de Traitement

```typescript
// Exemple de logs pour un DOCX
[OCR] Document Word détecté - extraction directe avec mammoth...
[DocxExtractor] Extracted 1245 characters from DOCX buffer  
[OCR] Extraction directe DOCX réussie: 1245 caractères en 45ms
[OCR] Texte DOCX direct: 1245 caractères
[OCR] source:docx-direct length:1245 bytes:87432 duration:67ms
```

## 🚫 Non-Objectifs (Respectés)

- ❌ **Pas de modification** du schéma Prisma
- ❌ **Pas de modification** des signatures d'API publiques  
- ❌ **Pas d'optimisation** NLP/cleaning spécifique DOCX
- ❌ **Pas de support** pour Excel/PowerPoint/autres formats
- ❌ **Pas de refactoring** large du service existant

## 🔧 Configuration

Aucune configuration requise. Le support DOCX est automatiquement actif dès l'installation de `mammoth`.

## 🐛 Gestion d'Erreurs

1. **Extraction DOCX échoue** → Fallback automatique sur conversion PDF
2. **Buffer DOCX corrompu** → Log erreur + fallback  
3. **mammoth indisponible** → Fallback sur conversion PDF
4. **Texte extrait trop court** → Fallback sur conversion PDF

## 📈 Performance

- **DOCX direct** : ~50ms (plus rapide que conversion PDF)
- **Fallback PDF** : ~200-500ms (LibreOffice + pdf-parse)
- **Qualité texte** : Meilleure avec extraction directe (pas de perte de conversion)

---

**Résumé** : Support DOCX intégré de façon **transparente** et **rétrocompatible** dans l'API d'extraction existante, avec fallback automatique pour garantir zéro régression.
