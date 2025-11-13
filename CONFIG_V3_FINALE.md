# 🎯 CONFIGURATION V3 - FINALE

## ✅ AMÉLIORATIONS

1. **Recherche du bien par LOCATAIRE** → Code modifié ! 
2. **Regex MONTANTS corrigées** → Pour texte OCR collé
3. **Regex RÉFÉRENCE corrigée** → Capture le numéro, pas "mandat"

---

## 📋 NOUVELLE CONFIGURATION (copiez-collez)

### 1️⃣ Contextes par défaut (JSON) - **INCHANGÉ**

```json
{
  "autoCreateAboveConfidence": 0.92,
  "natureCategorieMap": {
    "RECETTE_LOYER": "Loyer + charges",
    "DEPENSE_GESTION": "Commission agence"
  }
}
```

### 2️⃣ Configuration des suggestions (JSON) - **NOUVELLE VERSION**

```json
{
  "regex": {
    "periode_bandeau": "DU\\s+(\\d{2})/(\\d{2})/(\\d{4})\\s+AU\\s+(\\d{2})/(\\d{2})/(\\d{4})",
    "locataire": "M\\.\\s+([A-ZÉÈÀÙÂÊÎÔÛÇ\\s'\\-]+)\\s+\\(",
    "loyer_principal": "LOYER\\s+PRINCIPAL.*?(\\d{1,3}[\\s,]\\d{2})[\\s]*(\\d{1,3}[\\s,]\\d{2})",
    "provisions_charges": "PROVISIONS\\s+CHARGES.*?(\\d{1,3}[\\s,]\\d{2})[\\s]*(\\d{1,3}[\\s,]\\d{2})",
    "reference": "MANDAT\\s+(\\d{5})"
  },
  "mapping": {
    "periode_mois": { "from": "periode_bandeau", "group": 2 },
    "periode_annee": { "from": "periode_bandeau", "group": 3 },
    "loyer_encaisse": { "from": "loyer_principal", "group": 2 },
    "charges_encaisse": { "from": "provisions_charges", "group": 2 }
  },
  "postprocess": {
    "montant_total": "sum(loyer_encaisse, charges_encaisse)",
    "nature": "RECETTE_LOYER",
    "categorie": "Loyer + charges",
    "libelleTemplate": "Loyer + charges – {periode_mois}/2025 – {locataire}"
  }
}
```

---

## 🔥 **CHANGEMENTS CLÉS**

1. **`loyer_principal`** : `.*?` au lieu de `[\\s\\S]{0,100}?` pour matcher texte collé
2. **`provisions_charges`** : Idem
3. **`reference`** : `MANDAT` en MAJUSCULES + `\\d{5}` pour 5 chiffres
4. **`libelleTemplate`** : Utilise `{locataire}` au lieu de `{bien}` (plus court)

---

## 🚀 **TESTEZ MAINTENANT**

1. **Copiez les 2 JSON** ci-dessus
2. **Remplacez** dans l'admin
3. **Sauvegardez**
4. **Uploadez à nouveau le PDF**
5. **🔍 Nouveaux logs attendus** :
   ```
   [TransactionSuggestion] ✅ loyer_principal: 300,00 (2 groupes)
   [TransactionSuggestion] ✅ provisions_charges: 15,00 (2 groupes)
   [TransactionSuggestion] ✅ reference: 00336 (1 groupes)
   [TransactionSuggestion] 🔍 Recherche bail pour locataire: tosetto alain
   [TransactionSuggestion] ✅ Bail trouvé: TOSETTO ALAIN → [Nom du bien]
   [TransactionSuggestion] 🏠 Bien matché par locataire: [...], bail: [...]
   [TransactionSuggestion] 🏠 Loyer HC: 300
   [TransactionSuggestion] 📦 Charges récup: 15
   [TransactionSuggestion] 💰 Montant depuis breakdown: 315
   ```

---

**Testez et montrez-moi les nouveaux logs !** 🚀

