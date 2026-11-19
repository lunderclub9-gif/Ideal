# Point de reprise — Phase 4

**Projet :** GestionPro DZ  
**Dépôt :** lunderclub9-gif/Ideal  
**Branche :** phase-4-documents-exports  
**Base :** phase-3-debts-finance  
**Étape :** 4 / 6 — Documents et exports  
**Date :** 2026-11-19  
**Référence :** GESTIONPRO-DZ-PHASE-4-DOCUMENTS-2026-11-19

## Changements réalisés

- Centre de documents enrichi : recherche par intitulé, nom de fichier, catégorie, notes et type de fiche associée.
- Dépôt de pièces jointes avec date, catégorie, notes et liaison optionnelle vers un client, un chantier, un fournisseur ou un salarié.
- Validation serveur des relations : seules les fiches existantes des tables autorisées peuvent être liées.
- Modification des métadonnées des pièces jointes sans modifier ni remplacer le fichier original.
- Archivage logique conservant les fichiers physiques et les références ; aucune suppression physique introduite.
- Export Excel du registre des documents, avec métadonnées, taille, type MIME, date et utilisateur ayant déposé le fichier.
- Classeur de rapports enrichi en six feuilles : rentabilité des chantiers, état du stock, devis/factures, règlements, soldes fournisseurs et activité des salariés.
- Page Rapports enrichie avec synthèse main-d’œuvre et coûts véhicules, plus impression navigateur / enregistrement PDF au format A4.
- Paramètres de l’entreprise : ajout du dépôt local du logo et du cachet (PNG/JPG/WebP, 1,5 Mo maximum chacun), aperçu et retrait ; les images configurées apparaissent sur les documents commerciaux imprimés.
- Styles d’impression A4 améliorés pour éviter autant que possible la coupure des tableaux et sections.
- Aucun nouveau package, service cloud, abonnement ou module IA ajouté.

## Fichiers modifiés

- server/routes.ts
- src/pages/AdminModulesPage.tsx
- src/components/ui.tsx
- src/index.css
- docs/ROADMAP_GESTIONPRO_DZ.md
- docs/PHASE_3_STATUS.md

## Vérifications restantes

- Exécuter la CI Windows : TypeScript, build, packaging, smoke test et artefact.
- Tester le dépôt d’un fichier avec et sans liaison.
- Tester les types de liaison valides et les identifiants inexistants.
- Tester la modification des métadonnées, la recherche, le téléchargement et l’archivage logique.
- Comparer les feuilles du classeur Excel avec les écrans sources et vérifier les totaux.
- Tester l’impression A4 / Enregistrer en PDF sur un poste Windows.
- Vérifier les droits documents:read, documents:write, documents:delete et reports:export.
- Vérifier une base issue de Build 40 / Build 40+ et préserver les fichiers locaux déjà archivés.

## Sécurité et conservation

Aucune migration destructive ni suppression de données n’a été ajoutée. Les pièces jointes restent stockées localement. L’archivage masque l’entrée du registre sans effacer le fichier. Les exports sont protégés par les permissions existantes.

## Suite

Après validation CI et vérification des scénarios métier de cette phase, démarrer la phase 5 — durcissement, sécurité locale, sauvegarde/restauration, mises à jour, migrations et livraison.

**Référence de reprise :** GESTIONPRO-DZ-PHASE-4-DOCUMENTS-2026-11-19
