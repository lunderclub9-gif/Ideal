# GestionPro DZ — Roadmap de modernisation

## Principes non négociables
- Application locale Windows, SQLite, fonctionnement hors ligne.
- Aucun module d'intelligence artificielle, aucun service cloud obligatoire et aucune dépendance payante obligatoire.
- Préserver les données métier existantes : migrations additives, pas de suppression destructive ni de réécriture rétroactive des documents.
- Les montants financiers sont calculés côté serveur et enregistrés avec des références et une traçabilité.
- Une étape est considérée terminée uniquement après vérification du build et des scénarios concernés.

## Découpage en cinq phases

### Phase 1 — Fondations et référentiels
- Audit du schéma, des permissions, des flux et des migrations existants.
- Paramètres d'identité de l'entreprise enrichis pour les documents.
- Catalogue configurable des types de travaux : code, nom, catégorie, description, unité, prix indicatif, coût indicatif, TVA et état actif/archivé.
- Conservation des anciennes valeurs de chantier et des services existants.
- Référence de reprise et compte rendu de validation.

### Phase 2 — Personnel et chantiers
- Dossiers travailleurs plus complets et modification sécurisée.
- Affectations, présences, absences, congés, heures supplémentaires, avances et paie.
- Liaison explicite entre type de travaux, chantier, main-d'œuvre et coûts.
- Historique des modifications et documents RH.

### Phase 3 — Dettes et finances
- Comptes clients, fournisseurs et travailleurs.
- Journal des règlements, soldes, échéances et retards.
- Contrôles anti-doublons, dépassements, contre-passations et rapprochements.
- Caisse, banques, dépenses et rapprochement des mouvements sans double comptage.

### Phase 4 — Documents et exports
- Documents Excel et PDF avec identité de l'entreprise, titre, date, période, référence, détails, totaux et pagination.
- Devis, factures, reçus, états de compte, paie, achats, stock et rapports.
- Mise en page d'impression, formats locaux et gestion des pièces jointes.

### Phase 5 — Durcissement et livraison
- Audit des permissions et de la sécurité locale.
- Sauvegarde/restauration, mises à jour, migration et récupération.
- Tests automatisés et smoke tests de l'installateur Windows.
- Vérification des performances sur une configuration modeste, puis publication du build final.

## État
Consulter `PHASE_1_STATUS.md` pour le dernier point de reprise. Ne pas commencer une phase suivante sans validation explicite de l'utilisateur.
