# Point de reprise — Phase 5

**Projet :** GestionPro DZ  
**Dépôt :** lunderclub9-gif/Ideal  
**Branche :** phase-5-data-protection  
**Base :** phase-4-documents-exports  
**Étape :** 5 / 7 — Protection des données et sécurité  
**Date :** 2026-11-19  
**Référence :** GESTIONPRO-DZ-PHASE-5-DATA-PROTECTION-2026-11-19

## Changements réalisés

- Sauvegardes ZIP construites dans un fichier temporaire puis publiées par renommage après vérification.
- Manifeste enrichi : version du schéma, empreinte SHA-256 de la base, nombre de pièces jointes, taille et empreinte SHA-256 de chaque document.
- Vérification finale de l’archive après création.
- Vérification indépendante d’une sauvegarde existante depuis l’interface, avec contrôle SQLite et des pièces jointes.
- Restauration préparée en zone temporaire : contrôle d’intégrité SQLite, contrôle des clés étrangères, vérification SHA-256, contrôle des chemins et limites de décompression.
- Refus des chemins ZIP traversant les dossiers, des fichiers inattendus, des doublons et des fichiers non déclarés dans le manifeste.
- Copie de sécurité obligatoire avant restauration.
- Remplacement de la base et du dossier Documents avec copies de retour arrière ; restauration automatique de l’état précédent en cas d’échec.
- Confirmation explicite avant restauration depuis l’interface, avec rappel que la base et le dossier Documents seront remplacés.
- Sessions signées avec expiration après 12 heures et vérification de signature en temps constant.
- Protection contre les tentatives de connexion répétées : verrouillage temporaire après cinq échecs sur une fenêtre de quinze minutes.
- Sauvegarde quotidienne planifiée selon l’heure locale configurée, avec contrôle périodique léger (une fois par minute).
- Limite de conservation quotidienne bornée pour éviter une valeur de rétention accidentellement excessive.
- Aucun nouveau package, service cloud, abonnement ou module IA ajouté.

## Fichiers modifiés

- server/backup.ts
- server/auth.ts
- server/routes.ts
- server.ts
- src/pages/AdminModulesPage.tsx
- docs/ROADMAP_GESTIONPRO_DZ.md

## Vérifications restantes

- CI Windows : TypeScript, tests automatisés de protection des données, build, packaging, smoke test et artefact.
- Test automatisé ajouté : création et vérification de sauvegarde, restauration, retour des données et pièces jointes, rejet d’une empreinte SHA-256 falsifiée, rejet d’un chemin ZIP malveillant et vérification de signature de session.\n- Tester une sauvegarde contenant plusieurs documents, puis la vérifier et la restaurer sur un poste Windows réel.
- Tester une archive corrompue, une empreinte incorrecte, un fichier non déclaré et un chemin malveillant : toutes doivent être refusées sans toucher aux données actives.
- Simuler un échec pendant le remplacement et confirmer le retour à l’état précédent.
- Vérifier la sauvegarde à l’heure configurée et la rétention.
- Vérifier qu’un ancien jeton expire et qu’une nouvelle connexion fonctionne.
- Tester cinq mots de passe incorrects puis le délai de verrouillage.
- Tester la mise à jour sur une copie de base issue de Build 40 et vérifier la conservation des données.

## Sécurité et conservation

La restauration ne doit jamais commencer à remplacer la base active avant validation complète de l’archive et création de la sauvegarde de sécurité. Les données existantes restent conservées dans des copies de retour arrière jusqu’à ce que la nouvelle base et le dossier Documents soient rouverts avec succès.

## Suite

Après réussite de la CI et tests métier, poursuivre la phase 6 — réorganisation globale de l’interface, navigation, boutons, actions et cohérence des modules.

**Référence de reprise :** GESTIONPRO-DZ-PHASE-5-DATA-PROTECTION-2026-11-19
