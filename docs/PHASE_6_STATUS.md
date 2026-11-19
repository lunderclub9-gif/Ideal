# Phase 6 — Refonte UX/UI et contrôle fonctionnel global

## Branche
- `phase-6-ui-overhaul`
- Base : `phase-5-data-protection`

## Modifications réalisées
- Navigation latérale filtrable par nom de module et groupe.
- Groupes de navigation repliables, avec réouverture automatique du groupe du module actif.
- Fermeture du menu mobile via une zone de fond dédiée.
- Attributs d'accessibilité pour le module actif et la recherche de navigation.
- Modales avec sémantique de dialogue accessible ; états vides identifiés comme régions de statut.
- Styles de focus visibles, contrôles de formulaire harmonisés et prise en charge de la préférence système de réduction des animations.
- Ajout de la modification des fiches matériaux et fournisseurs avec contrôle de permission côté serveur et journal d'audit.
- La quantité en stock d'un matériau reste modifiable uniquement via le journal des mouvements ; le formulaire de modification ne permet pas de modifier directement le stock.
- Aucun service cloud, package ou coût supplémentaire ajouté.

## Contrôles restant à effectuer
- CI Windows : TypeScript, tests de protection des données, build, installateur et smoke test.
- Vérification visuelle sur Windows et écran mobile.
- Parcours CRUD réel de chaque module avec comptes ayant différents rôles.
- Vérification des flux métier sur une copie de la base locale réelle.

## Protection des données
Aucune suppression de table ou de donnée métier n'est introduite dans cette phase. Les nouveaux endpoints modifient uniquement les champs de profil des matériaux et fournisseurs et conservent leurs soldes, mouvements et historiques.
