# IDEAL — Branch preservation ledger (2026-11-25)

Compared every listed non-main branch with `main` using GitHub compare metadata. No branch was deleted, rewritten or force-updated.

## Branches with commits ahead of main

| Branch | Ahead / behind | File-level review | Disposition |
|---|---:|---|---|
| `feature/complete-module-actions` | 46 / 79 | Its `FleetPage.tsx` is byte-identical to main. Its `ProjectsPage.tsx` and `server/routes.ts` are older snapshots missing later main functionality and lifecycle/security safeguards. | Superseded by newer main implementation; do not merge the stale branch. Re-open only if a specific unique behavior is identified and tested. |
| `feature/ideal-windows-trust-hardening` | 11 / 37 | The installer verifier script and Windows security guide are already present in main with identical blob SHAs. Its workflow, package manifest and lifecycle test differ, but main versions are newer and include additional test/data-directory handling. | Core trust-hardening work is already represented in main; stale branch changes are superseded. No wholesale merge. |
| `feature/microsoft-store-msix` | 7 / 49 | Main already contains the Store workflow, Store guide, package script and Electron Store path. Current main copies differ from branch snapshots and are more recent. | Optional Microsoft Store path has already been ported and refined in main. Keep optional; no merge. |
| `phase-2-workforce-project-costs` | 12 / 190 | Branch `PayrollPage.tsx` lacks main's revision-aware period approval/edit safeguards; its `AttendancePage.tsx` lacks the current pending-only edit workflow; its `ProjectsPage.tsx` lacks current project editing, phase and contract/milestone workflows; its routes are an older baseline. | Superseded by newer main implementation. Do not merge stale schema/routes/UI. No distinct safe feature was identified in inspected files. |

## Branches behind main with zero ahead commits

The compare endpoint reported zero commits ahead for all of these branches. They are preserved; no replay is needed based on commit ancestry:
- `docs/ideal-master-build-spec`
- `feature/ideal-consolidation-audit`
- `freebuff/ideal-cancel-reverse`
- `freebuff/ideal-command-palette`
- `freebuff/ideal-e2e`
- `freebuff/ideal-empty-states`
- `freebuff/ideal-import-lifecycle`
- `freebuff/ideal-kpi-cleanup`
- `freebuff/ideal-kpi-refactor`
- `freebuff/ideal-lifecycle`
- `freebuff/ideal-lifecycle-cleanup`
- `freebuff/ideal-lifecycle-complete`
- `freebuff/ideal-lifecycle-extend`
- `freebuff/ideal-lifecycle-permissions`
- `freebuff/ideal-lifecycle-tests`
- `freebuff/ideal-responsive`
- `freebuff/ideal-retention-review`
- `freebuff/ideal-ui`
- `freebuff/ideal-ui-broad`
- `freebuff/89e1d46b2d98e443480a3e20`
- `freebuff/4297814add6fbe572ed9139d`
- `phase-1-foundation`
- `phase-2-workforce-final`
- `phase-3-debts-finance`
- `phase-3-debts-validation`
- `phase-4-documents-exports`
- `phase-5-data-protection`
- `phase-6-ui-overhaul`
- `phase-7-french-only`

## Important interpretation

- “Behind with zero ahead commits” means the branch has no unique commits to replay; it does not mean every file is byte-identical.
- “Superseded” means the inspected main implementation is newer or already includes the relevant feature. It is not a license to delete the source branch.
- If future evidence identifies a distinct user-facing behavior not represented in main, port that behavior as a small reviewed change onto a current feature branch with tests.
- No force-push, branch deletion, history rewrite or direct main modification was performed.

## Mise à jour du 2026-11-26

- Nouvelle branche de travail `feature/ideal-full-erp-completion`, créée depuis `main` (`c5562db`), poussée puis fusionnée par la PR #23 (`main` = `f979cf0`). Aucun commit d’une autre branche n’a été rejoué.
- Aucune branche existante n’a été supprimée, renommée, forcée ou réécrite. Le ledger précédent reste la référence pour les branches divergentes (`feature/complete-module-actions`, `feature/ideal-windows-trust-hardening`, `feature/microsoft-store-msix`, `phase-2-workforce-project-costs`) : aucune de leurs modifications n’a été identifiée comme nécessaire à cette tranche.
- Branche de documentation `docs/release-188-fr` : audit daté et notes de version uniquement.
- La release `windows-build-188` est construite depuis `main` (`f979cf0`), pas depuis une branche de travail.
