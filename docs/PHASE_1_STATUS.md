# Point de reprise — Phase 1

**Projet :** GestionPro DZ  
**Dépôt :** `lunderclub9-gif/Ideal`  
**Branche de travail :** `phase-1-foundation`  
**Branche de référence :** `main`  
**Étape :** 1 / 5 — Fondations et référentiels  
**Dernière mise à jour :** 2026-11-19

## Objectif de la phase
Mettre en place les fondations sûres de la modernisation, avec un catalogue des types de travaux administrable et des paramètres d'identité d'entreprise plus complets. Aucun module IA.

## Changements réalisés sur la branche de phase
- Ajout d'une migration SQLite additive version 2 qui ajoute des champs descriptifs et de suivi à la table `services` existante.
- Catalogue initial (Résine, Époxy, Plomberie, Peinture, Carrelage, Électricité) inséré uniquement si la table `services` est vide. Les prix, coûts et taux TVA démarrent à zéro afin de ne pas inventer de tarifs.
- API de consultation, création et modification des types de travaux, avec validation serveur, gestion des codes en doublon et journal d'audit.
- Archivage/réactivation logique au lieu de suppression physique.
- Nouvelle page « Types de travaux » avec recherche, statut, création, modification et archivage.
- Paramètres de l'entreprise : ajout de champs téléphone, e-mail, mentions d'en-tête et de pied de page à l'interface existante. L'API existante les enregistrait déjà.
- Les données des clients, projets, factures et services existants ne sont pas volontairement supprimées ni réécrites.

## Fichiers concernés
- `server/db.ts`
- `server/routes.ts`
- `src/App.tsx`
- `src/pages/AdminModulesPage.tsx`
- `src/pages/ServicesPage.tsx` (nouveau)

## Validation
- À ce point, les changements ont été poussés sur la branche de travail.
- Le build TypeScript, les tests métier et le workflow Windows doivent encore être vérifiés avant de déclarer la phase terminée.
- Ne pas installer cette branche sur l'application qui contient des données réelles avant validation et sauvegarde vérifiée.

## Prochaine action
Lancer et corriger les contrôles CI/build. Ensuite vérifier les scénarios du catalogue : ajout, doublon, modification, archivage, réactivation, puis confirmer que les anciennes données restent intactes.

## Référence de reprise
`GESTIONPRO-DZ-PHASE-1-FOUNDATION-2026-11-19`

Au prochain message, demander de reprendre exactement cette référence et poursuivre la phase 1 depuis la validation, sans recommencer les étapes déjà effectuées.
