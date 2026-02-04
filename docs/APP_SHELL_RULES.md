# Règles App-Shell Smartimmo

## Actions métier non-idempotentes

### Règle fondamentale

**La synchronisation automatique ne rejoue jamais une action métier non-idempotente.**

Les actions métier non-idempotentes incluent :
- Envoi d'email (ex: "Envoyer pour signature")
- Génération de PDF (ex: génération de bail PDF)
- Signature électronique
- Toute action qui produit un effet de bord externe (email, notification, etc.)

### Conséquence pour l'UI

Un statut intermédiaire (ex: `À_ENVOYER`) indique **"action à faire manuellement quand online"**.

L'UI doit proposer une **action explicite "Réessayer"** pour permettre à l'utilisateur de relancer manuellement l'action métier.

### Exemple : Envoi pour signature

1. **Offline** : L'utilisateur clique sur "Envoyer pour signature"
   - Le statut passe à `À_ENVOYER` (localement)
   - Une `pendingOp` de type `update` est créée (pour synchroniser le statut)
   - Message : "Le bail sera envoyé lorsque vous serez connecté. Veuillez réessayer manuellement."

2. **Online** : L'utilisateur clique sur "Envoyer pour signature"
   - Le statut passe à `À_ENVOYER` (localement)
   - Une `pendingOp` de type `update` est créée
   - L'API est appelée pour générer le PDF/EML
   - Si l'API réussit : le statut passe à `ENVOYÉ` (localement + `pendingOp`)
   - Si l'API échoue : le statut reste `À_ENVOYER`

3. **Réessayer** : Si le statut est `À_ENVOYER`, un bouton "Réessayer l'envoi" est affiché
   - Ce bouton relance l'action métier (appel API)
   - Ce n'est **pas** la sync qui le fait automatiquement

### Implémentation technique

- Les statuts intermédiaires (`À_ENVOYER`, etc.) sont stockés dans le champ `status` persistant
- La sync ne déclenche jamais d'appel API pour les actions métier
- La sync synchronise uniquement les CRUD (pendingOps)
- L'UI doit détecter les statuts intermédiaires et proposer un bouton "Réessayer"

### Fichiers concernés

- `src/components/forms/LeaseEditModal.tsx` : Bouton "Réessayer" pour `À_ENVOYER`
- `src/lib/offline/syncGlobal.ts` : Ne jamais appeler d'API métier lors de la sync
- `src/utils/leaseStatus.ts` : Gestion des statuts intermédiaires
- `src/utils/leaseStatusBadge.tsx` : Affichage des badges pour les statuts intermédiaires

