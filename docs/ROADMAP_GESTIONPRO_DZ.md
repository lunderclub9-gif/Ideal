# GestionPro DZ — Roadmap de modernisation

## Principes non négociables
- Application Windows locale, SQLite et fonctionnement hors ligne.
- Aucun module d'intelligence artificielle, aucun service cloud obligatoire et aucune dépendance payante obligatoire.
- Préserver les données métier : migrations additives, aucune suppression destructive et aucune réécriture rétroactive des documents.
- Les montants financiers sont calculés côté serveur, avec références, validation et traçabilité.
- Une phase n'est déclarée terminée qu'après vérification du build, des scénarios métier et des migrations.

## Découpage en sept phases

### Phase 1 — Fondations et référentiels
- Audit du schéma, des permissions, des flux et des migrations existants.
- Paramètres d'identité de l'entreprise enrichis pour les documents.
- Catalogue configurable des types de travaux : code, nom, catégorie, description, unité, prix indicatif, coût indicatif, TVA et état actif/archivé.
- Conservation des anciennes valeurs de chantier et des services existants.
- Référence de reprise et compte rendu de validation.

### Phase 2 — Personnel et exécution des chantiers
- Dossiers salariés complets et modifiables : identité professionnelle, coordonnées, CNAS, date d'embauche, horaires, mode et montant de rémunération, statut et notes.
- Recherche et filtrage des salariés ; suspension, congé ou sortie via statut, sans effacer l'historique.
- Pointage par date et chantier, présence, absence, demi-journée, congés payés/non payés, maladie, jours fériés, heures supplémentaires et avances.
- Contrôles serveur contre dates et montants invalides, salariés suspendus/sortis, dépassement des fractions journalières et pointages après clôture de paie.
- Affectation des salariés aux tâches des chantiers et suivi des responsables/statuts.
- Coût de main-d'œuvre alimenté par les pointages approuvés et rattachés au chantier.
- Paie mensuelle, bulletins, CNAS/IRG, validation et verrouillage conservés.

### Phase 3 — Dettes et finances
- Comptes clients, fournisseurs et salariés avec grand livre de mouvements.
- Journal des règlements, soldes, échéances, retards, avances et remboursements.
- Contrôles anti-doublons, dépassements, annulations/contre-passations et rapprochements.
- Caisse, banques, dépenses et rapprochement des mouvements sans double comptage.
- Rapports de créances/dettes datés et détaillés.

### Phase 4 — Documents et exports
- Documents Excel et PDF avec identité de l'entreprise, titre, date, période, référence, détails, totaux et pagination.
- Devis, factures, reçus, états de compte, paie, achats, stock et rapports.
- Modèles d'impression, formats locaux et gestion des pièces jointes.
- Pièces jointes reliées aux fiches salariés, clients, fournisseurs et chantiers.

### Phase 5 — Durcissement et livraison
- Audit des permissions, sécurité locale et gestion des erreurs.
- Sauvegarde/restauration, mises à jour, migrations et récupération.
- Tests automatisés et smoke tests de l'installateur Windows.
- Vérification des performances sur une configuration modeste, puis publication du build final.

### Phase 6 — Refonte UX/UI et contrôle fonctionnel global
- Réorganisation cohérente des menus, sections, sous-sections, boutons et actions.
- Vérification de chaque écran : créer, consulter, modifier, archiver, imprimer, exporter, rechercher et filtrer selon le besoin et les permissions.
- Boutons visibles seulement quand l'action est autorisée, avec états de chargement, confirmation, succès et erreurs compréhensibles.
- Fiches riches et confortables avec photos/logos, documents PDF/Office et pièces jointes lorsque pertinentes.
- Tableaux, cartes, filtres, formulaires, raccourcis, vues détaillées et impression harmonisés.
- Design responsive, lisible, accessible et rapide sur les PC modestes ; aucune animation lourde inutile.
- Audit final de navigation et tests de bout en bout de tous les modules.

### Phase 7 — Interface française et cohérence linguistique
- Français comme langue unique de l'interface, y compris mise à jour, erreurs, notifications, dialogues et états de chargement.
- Suppression des textes arabes codés en dur dans l'interface, sans toucher aux données saisies par les utilisateurs, aux noms de fichiers, aux contenus métier ou aux archives.
- Harmonisation du vocabulaire, des accents, des dates, des montants et des messages d'assistance.
- Contrôle final de tous les textes visibles et tests de build Windows.

## État et reprise
- Phase 1 : implémentée sur `phase-1-foundation`, en attente de validation CI et de revue.
- Phase 2 : implémentée sur `phase-2-workforce-final`, en attente de validation CI et de revue.
- Phase 3 : implémentée sur `phase-3-debts-finance` ; CI Windows (TypeScript, build, installateur et smoke test) réussie sur la PR #5. Les scénarios comptables sur données réelles restent à vérifier.
- Phase 4 : implémentée sur `phase-4-documents-exports` ; CI Windows réussie (TypeScript, installateur et smoke test). Les vérifications métier sur une base locale réelle restent à effectuer.
- Phase 5 : implémentée sur `phase-5-data-protection` ; CI Windows réussie (TypeScript, tests de protection des données, build, installateur et smoke test). Les scénarios sur la base réelle restent à vérifier.
- Phase 6 : en cours sur `phase-6-ui-overhaul` ; navigation filtrable/repliable, accessibilité des composants partagés et édition sûre des fiches matériaux/fournisseurs ajoutées. Audit fonctionnel et CI à terminer.
- Phase 7 : planifiée après validation de la phase 6 ; français uniquement.
- Consulter `PHASE_1_STATUS.md`, `PHASE_2_STATUS.md` et `PHASE_3_STATUS.md` pour les points de reprise.
