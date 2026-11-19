# Phase 7 — Interface française uniquement

## Branche
- `phase-7-french-only`
- Base : `phase-6-ui-overhaul`

## Modifications réalisées
- Traduction du panneau de mise à jour : état initial, version inconnue, messages d'erreur, sauvegarde préalable, vérification, téléchargement et installation.
- Traduction des boîtes de dialogue natives Windows de mise à jour : avertissement, boutons, titre, confirmation et détail de conservation des données.
- Ajout du script `npm run check:french-ui` qui recherche les caractères arabes dans les fichiers source de `src/` et `electron/`.
- Ajout de ce contrôle au workflow CI Windows après la vérification TypeScript.
- Les textes saisis par l'utilisateur dans les fiches, les noms de fichiers et les données existantes ne sont pas convertis ni supprimés.

## Périmètre vérifié
- Audit des fichiers d'interface React, des composants partagés, des pages de connexion/configuration et du code Electron.
- Les seuls textes arabes codés en dur trouvés étaient dans le panneau et les dialogues de mise à jour ; ils ont été traduits.

## Contrôles restant à effectuer
- CI Windows complète : TypeScript, contrôle français uniquement, tests de protection des données, build, installateur et smoke test.
- Vérification visuelle de toutes les vues dans l'application installée.
- Contrôle final des messages natifs et des états de mise à jour sur Windows.
