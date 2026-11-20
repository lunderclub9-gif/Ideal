# IDEAL — Branch consolidation audit

Audit baseline: `main` at `fa500fe99777a31158140e27ff2ed404f6f36ca7` (Windows Build 170).

The repository's useful product history is consolidated into `main`. Branches were compared by commit ancestry and changed-file lists; old branches were not blindly merged because several are stale, duplicate, or based on superseded phase snapshots.

## Diverged branches

| Branch | Audit result | Handling |
|---|---|---|
| `feature/complete-module-actions` | PR #10 merged; PR #13 is an unmerged duplicate follow-up with the same feature branch | Keep the merged implementation already in `main`; do not replay the stale snapshot |
| `phase-2-workforce-project-costs` | PR #2 closed as superseded by PR #3 (`phase-2-workforce-final`), which was merged | Keep the final workforce implementation already in `main` |
| `feature/microsoft-store-msix` | Seven commits not in the latest `main`; based on an older commit | Ported and corrected in PR #16; old branch is superseded by the consolidation |

## Already contained or behind main

The following branch families had no unique commits ahead of the audited `main` snapshot: phase 1; final phase 2; phases 3–7; UI and responsive work; KPI and empty-state work; command palette; E2E setup; lifecycle implementation, extension, permissions, tests and retention review; cancellation/reversal; import lifecycle; and the SQL validation/AI-configuration cleanup.

Their work is already represented by merged commits or later versions in `main`. No stale branch snapshot should overwrite the current implementation.

## Consolidation additions

PR #16 adds:
- the distinct Microsoft Store AppX path, with corrected workflow expressions;
- a named isolated simulation test `scripts/test-simulation.ts`;
- a Windows CI step for the simulation;
- explicit isolation of `IDEAL_DATA_DIR` and `GESTIONPRO_DATA_DIR` for all automated test environments;
- a dedicated Playwright port and no reuse of an existing server.

Old branch refs are retained for history; `main` is the single integration source of truth after PR #16 merges.
