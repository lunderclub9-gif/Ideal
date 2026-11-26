# Module — Journal de chantier (rapports journaliers)

Statut : **COMPLETE (périmètre cœur)** — implémenté et testé le 2026-11-26. Schéma de base : 13.

## Périmètre fonctionnel

- Un rapport par chantier et par jour calendaire (unicité en base : `UNIQUE(project_id, report_date)`).
- Rattachement au chantier, à une phase et à une tâche du chantier ; le serveur vérifie l’appartenance.
- Météo, température, état du chantier, travaux réalisés, observations, incidents/HSE.
- Main-d’œuvre présente : salarié, heures (0–24), note ; un salarié ne peut apparaître qu’une fois.
- Engins utilisés : véhicule/engin, heures (0–24), note ; unicité par engin.
- Matériaux consommés : matériau, quantité strictement positive, unité reprise du matériau, note.
- Circuit de validation : `draft` → `submitted` → `approved` / `rejected` (motif obligatoire), correction d’un rapport refusé → `draft`.
- Suppression réservée aux brouillons ; aucun rapport soumis, validé ou refusé n’est supprimé.
- Pièces jointes (photos, PV) via le registre de documents (`related_type = 'site_report'`), stockage local existant, reprises dans la sauvegarde.
- Export Excel de la liste, aperçu/impression A4 français (impression navigateur → PDF).
- Numérotation annuelle `JC-AAAA-NNNN` via `document_sequences` (transactionnelle, sans trou en cas d’échec).
- Concurrence : `revision` incrémentée à chaque écriture ; une sauvegarde obsolète renvoie 409.

## Base de données (migration 13, additive)

| Table | Rôle |
|---|---|
| `site_reports` | En-tête du rapport (chantier, phase, tâche, date, météo, textes, statut, revision, acteurs, motif de refus) |
| `site_report_workforce` | Salarié, heures, note (unique par rapport + salarié) |
| `site_report_equipment` | Engin, heures, note (unique par rapport + engin) |
| `site_report_materials` | Matériau, quantité, unité, note |

Index : `(project_id, report_date)`, `(status)`, index de jointure sur les trois tables enfants, plus `documents(related_type, related_id)`.

Aucune table existante n’est modifiée. La chaîne 1→13 est rejouée sur la base de société capturée en schéma 9 (`npm run test:migrations`).

## API (`server/routes.ts`)

| Méthode | Route | Permission |
|---|---|---|
| GET | `/site-reports` (+ filtres `project_id`, `status`, `from`, `to`, `q`, limite 500) | `sites:read` |
| GET | `/site-reports/options` (chantiers, salariés, matériaux, engins, phases/tâches du chantier) | `sites:read` |
| GET | `/site-reports/export/xlsx` | `sites:read` |
| GET | `/site-reports/:id` (avec lignes et pièces jointes) | `sites:read` |
| POST | `/site-reports` | `sites:write` |
| PUT | `/site-reports/:id` (brouillon/refusé, `revision` contrôlée) | `sites:write` |
| POST | `/site-reports/:id/submit` | `sites:write` |
| POST | `/site-reports/:id/approve` | `sites:approve` |
| POST | `/site-reports/:id/reject` (motif obligatoire) | `sites:approve` |
| DELETE | `/site-reports/:id` (brouillon uniquement) | `sites:write` |

Rôles : `admin` (tout), `accountant` (lecture), `supervisor` (lecture + écriture), `storekeeper` (lecture), `driver` (lecture). Chaque action écrit dans `audit_logs` (`CREATE`, `UPDATE`, `SUBMIT`, `APPROVE`, `REJECT`, `DELETE`).

## Interface

`src/pages/SiteReportsPage.tsx`, entrée de navigation « Journal de chantier » (groupe Chantiers & Commercial). Filtres chantier/statut/dates/recherche, tableau des rapports, formulaire complet (équipes, engins, matériaux), fiche imprimable, upload de pièces jointes, actions contextuelles selon statut et permission. Messages d’erreur en français, états vides et de chargement.

## Tests

`npm run test:site-reports` (base temporaire isolée) couvre : authentification, création et numérotation, refus du doublon journalier, dates impossibles, validation des lignes, filtres, options, conflit de révision, permissions du chef de chantier (écriture sans validation), soumission, refus motivé, correction, validation, immutabilité après validation, suppression de brouillon, pièces jointes (liaison et refus d’une fiche inexistante), export XLSX, piste d’audit, chaîne de migrations jusqu’à 13, `integrity_check` et `foreign_key_check`.

## Limites connues

- Les matériaux déclarés ne génèrent pas automatiquement de mouvement de stock : la consommation reste une déclaration de chantier tant que les réservations/consommations d’entrepôt (Phase 5) ne sont pas implémentées, afin d’éviter un double décompte.
- Pas encore de galerie photo avec légendes ni de lien vers les situations de travaux (IPC, Phase 3 restante).
- L’export PDF utilise l’impression navigateur (A4) comme les autres documents de l’application.
