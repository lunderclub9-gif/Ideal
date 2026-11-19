# Point de reprise — Phase 2

**Projet :** GestionPro DZ  
**Dépôt :** `lunderclub9-gif/Ideal`  
**Branche de travail :** `phase-2-workforce-final`  
**Branche de base :** `phase-1-foundation`  
**Étape :** 2 / 6 — Personnel et exécution des chantiers  
**Date :** 2026-11-19  
**Référence :** `GESTIONPRO-DZ-PHASE-2-WORKFORCE-2026-11-19`

## Objectifs
Renforcer les dossiers des salariés, les contrôles du pointage et l'affectation opérationnelle des équipes aux tâches des chantiers, sans supprimer l'historique.

## Changements réalisés
- Dossier salarié modifiable depuis Personnel & Paie : nom, métier, type de rémunération (journalier, mensuel, horaire, à la tâche), taux, CNAS, téléphone, adresse, date d'embauche, horaires, statut et notes.
- Recherche et filtre par statut dans la liste du personnel.
- Les statuts actif, suspendu, en congé et sorti remplacent toute suppression physique du salarié ; les anciens pointages et bulletins restent liés au même identifiant.
- L'API salarié valide les types de rémunération, les montants, les statuts et la date d'embauche ; les modifications enregistrent aussi les horaires et la date d'embauche.
- Le pointage utilise la date locale actuelle au lieu d'une date figée ; ajout des choix arrêt maladie et jour férié.
- Le serveur refuse les dates/statuts/montants invalides, les pointages de salariés suspendus ou sortis et les avances/heures négatives. Les protections existantes contre le dépassement de journée et la paie verrouillée restent en place.
- Les tâches de chantier permettent désormais de modifier le salarié responsable ; le serveur vérifie que le salarié est admissible.
- La période de calcul de paie se positionne sur le mois et l'année courants.
- La main-d'œuvre des chantiers reste calculée à partir des pointages approuvés affectés au chantier, pas des pointages en attente.
- Le workflow Windows est configuré pour vérifier les pull requests vers les branches de travail également, sans publier de release depuis une PR.

## Fichiers modifiés pendant la phase
- `src/pages/PayrollPage.tsx`
- `src/pages/AttendancePage.tsx`
- `src/pages/ProjectsPage.tsx`
- `server/routes.ts`
- `.github/workflows/windows-installer.yml`
- `docs/ROADMAP_GESTIONPRO_DZ.md`
- `docs/PHASE_2_STATUS.md`

## Points à valider avant de clôturer la phase
- Build TypeScript et packaging Windows.
- Création et modification d'un salarié, avec vérification de tous les champs.
- Statuts suspendu/sorti et conservation des pointages/paie historiques.
- Pointage valide/invalide, fractionnement journalier, avance, congé, maladie, jour férié et paie verrouillée.
- Affectation et changement de responsable d'une tâche de chantier.
- Vérifier les coûts de main-d'œuvre sur un chantier à partir de pointages approuvés.
- Vérifier que la migration de phase 1 préserve une base de données issue de Build 40/Build 40+.

## Sécurité des données
Aucune suppression de salariés, pointages, bulletins, projets ou tâches n'est introduite dans cette phase. Les statuts et les références préservent l'historique.

## Suite
Après validation et revue de la phase 2, ouvrir la phase 3 — Dettes et finances. Ne pas démarrer la refonte UX/UI de la phase 6 avant d'avoir stabilisé les fonctionnalités métier des phases 1 à 5.
