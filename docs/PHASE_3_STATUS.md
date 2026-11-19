# Point de reprise — Phase 3

**Projet :** GestionPro DZ  
**Dépôt :** lunderclub9-gif/Ideal  
**Branche de travail :** phase-3-debts-finance  
**Branche de base :** phase-2-workforce-final  
**Étape :** 3 / 6 — Dettes et finances  
**Date :** 2026-11-19  
**Référence :** GESTIONPRO-DZ-PHASE-3-DEBTS-2026-11-19

## Changements réalisés
- Ajout de l'écran Dettes & Créances dans l'application.
- Tableau des factures clients non soldées : TTC, paiements reçus, avoirs liés, reste dû, date d'émission, échéance et jours de retard.
- Tableau des achats fournisseurs restant à régler, avec numéro de commande, facture fournisseur et chantier.
- Tableau des avances salariés : avances issues des pointages approuvés, récupérations issues des bulletins de paie approuvés et solde restant.
- Synthèse des créances, dettes fournisseurs, avances salariés et position nette indicative.
- Recherche, actualisation et filtre des factures en retard.
- Les demandes d'achat internes non confirmées sont exclues des dettes fournisseurs ; les commandes confirmées, reçues et réglées/partiellement réglées restent traçables.
- Les soldes des avances salariés n'incluent que les pointages approuvés.
- La date de référence est calculée en heure locale.
- Contre-passation d'un paiement fournisseur : restauration du solde/statut d'achat et mouvement inverse correspondant dans la trésorerie.
- Accès à l'écran et à l'API limité aux rôles disposant de treasury:read, car les données exposent des informations financières et salariales.

## Fichiers modifiés
- server/routes.ts
- src/App.tsx
- src/pages/DebtsPage.tsx

## Contrôles encore nécessaires
- Attendre la fin du workflow Windows : TypeScript, build client/serveur, packaging et smoke test.
- Vérifier des scénarios réels : facture sans paiement, paiement partiel, facture soldée, avoir lié, facture échue, achat fournisseur avec paiement partiel, contre-passation et avance salarié récupérée par paie validée.
- Vérifier que les rôles sans treasury:read reçoivent bien un refus 403.
- Comparer les soldes affichés avec les pièces comptables sources avant toute clôture.
- Ne pas fusionner tant que le workflow n'est pas vert.

## Sécurité des données
Aucune migration destructive ni suppression d'enregistrements n'a été ajoutée dans cette phase. Les soldes sont calculés à partir des documents et mouvements existants ; ils ne réécrivent pas les historiques.

## Suite
Après validation de la phase 3, poursuivre la phase 4 — Documents et exports enrichis (PDF/Excel, références, dates, coordonnées de l'entreprise et impression).
