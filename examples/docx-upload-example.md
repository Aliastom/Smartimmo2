# 📄 Exemple d'Upload DOCX - SmartImmo

## 🧪 Test Manuel Complet

### **Étape 1: Préparer un fichier DOCX**

Créer un fichier `quittance-janvier-2025.docx` avec le contenu :

```
QUITTANCE DE LOYER

Propriétaire: M. Martin DUPONT
Adresse: 15 rue de la République, 75001 Paris
Tél: 01.23.45.67.89

Locataire: Mme Sophie DUBOIS  
Appartement: Studio 25m²
Adresse: 42 avenue des Champs, 75008 Paris

PÉRIODE: Janvier 2025 (du 01/01/2025 au 31/01/2025)

Loyer mensuel: 950,00 €
Charges: 80,00 €
TOTAL À PAYER: 1 030,00 €

Payé le: 05/01/2025
Mode de paiement: Virement bancaire
Référence: REF-2025-01-001

Signature du propriétaire
```

### **Étape 2: Tester l'API**

```bash
# Démarrer le serveur SmartImmo
npm run dev

# Tester l'extraction DOCX
curl -X POST http://localhost:3000/api/ocr \
     -F "file=@quittance-janvier-2025.docx" \
     -v
```

### **Étape 3: Vérifier la réponse**

**Réponse Attendue :**
```json
{
  "ok": true,
  "runId": "abc123-def456",
  "configVersion": "v1",
  "source": "docx-direct",
  "length": 456,
  "preview": "QUITTANCE DE LOYER Propriétaire: M. Martin DUPONT Adresse: 15 rue de la République, 75001 Paris Tél: 01.23.45.67.89 Locataire: Mme Sophie DUBOIS Appartement: Studio 25m² Adresse: 42 avenue des Champs, 75008 Paris PÉRIODE: Janvier 2025 (du 01/01/2025 au 31/01/2025) Loyer mensuel: 950,00 € Charges: 80,00",
  "text": "[texte normalisé complet...]",
  "meta": {
    "source": "docx-direct",
    "sha256": "a1b2c3d4e5f6...",
    "duration": 67
  }
}
```

### **Étape 4: Vérifier les logs serveur**

```bash
[OCR] Document Word détecté - extraction directe avec mammoth...
[DocxExtractor] Extraction texte depuis buffer (45623 bytes)
[DocxExtractor] Extracted 456 characters from DOCX buffer
[OCR] Extraction directe DOCX réussie: 456 caractères en 23ms
[OCR] Texte DOCX direct: 456 caractères
[OCR] source:docx-direct length:456 bytes:45623 sha256:a1b2c3d4e5f6... duration:67ms
```

### **Étape 5: Upload via l'interface SmartImmo**

1. **Aller sur** `http://localhost:3000/documents`
2. **Cliquer** "Uploader des documents"  
3. **Sélectionner** le fichier `quittance-janvier-2025.docx`
4. **Vérifier** dans la modale de revue :
   - ✅ Aperçu du texte extrait
   - ✅ Prédictions de type de document (probablement "Quittance de loyer")
   - ✅ Champs extraits (montants, dates, période)

### **Étape 6: Vérifier en base de données**

```sql
-- Connecter à la base SQLite/PostgreSQL
-- Vérifier que le texte DOCX est bien stocké

SELECT 
  fileName,
  mime,
  extractedText,
  ocrStatus,
  documentTypeId,
  createdAt
FROM Document 
WHERE fileName LIKE '%quittance-janvier-2025%'
ORDER BY createdAt DESC 
LIMIT 1;
```

**Résultat attendu :**
```
fileName: quittance-janvier-2025.docx
mime: application/vnd.openxmlformats-officedocument.wordprocessingml.document
extractedText: quittance de loyer propriétaire m martin dupont adresse 15 rue de la république 75001 paris...
ocrStatus: success
documentTypeId: [ID du type "Quittance de loyer" si détecté]
createdAt: 2025-01-15 10:30:45
```

## 🔄 Comparaison avec PDF

### **Test Équivalent PDF**
```bash
# Même document en PDF
curl -X POST http://localhost:3000/api/ocr \
     -F "file=@quittance-janvier-2025.pdf"

# Réponse : source: "pdf-parse" mais même contenu texte
```

### **Avantages DOCX Direct**
- ⚡ **Plus rapide** (~50ms vs ~200ms pour conversion PDF)
- 🎯 **Plus précis** (pas de perte de conversion)
- 💾 **Moins de ressources** (pas de LibreOffice)

## ✅ Checklist Validation

- [ ] **Upload DOCX fonctionne** via API `/api/ocr`
- [ ] **Source = "docx-direct"** dans la réponse
- [ ] **Texte extrait correct** et complet  
- [ ] **Classification automatique** suggère le bon type
- [ ] **Stockage BDD** dans le champ `extractedText`
- [ ] **Interface UI** affiche l'aperçu et les champs
- [ ] **Pas de régression** sur les PDF existants

Si tous les points sont validés, le support DOCX est **opérationnel** ! 🎉
