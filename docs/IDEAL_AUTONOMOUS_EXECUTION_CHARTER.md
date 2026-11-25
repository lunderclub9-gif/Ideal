# IDEAL — Official Autonomous Development & Release Charter
**Document ID:** IDEAL-ENG-CHARTER-001  
**Status:** Approved for execution by the repository owner  
**Approved execution mode:** Autonomous, sequential, no routine pauses  
**Release authorization:** Publish only after every mandatory acceptance gate passes  
**Primary repository:** https://github.com/lunderclub9-gif/Ideal  
**Default stable branch:** `main`  
**Language:** French-only user interface  
**Market:** Algerian BTP companies  
**Currency:** DZD  
**Runtime:** Windows desktop, Electron + local web UI/API + SQLite  
**Connectivity:** Offline-first; no mandatory cloud dependency  
**AI policy:** No AI features in IDEAL

---

## 1. Binding instruction to the coding agent

You are the autonomous engineering agent responsible for completing IDEAL according to this charter and the linked master specification. Do not stop after producing an audit, a plan, a mockup, or a partial implementation. Execute the roadmap in order, continue automatically through routine engineering decisions, create isolated feature branches, implement the work, test it, document it, integrate safe changes, and prepare a Windows release.

Do not ask the owner to approve ordinary technical decisions, naming, file organization, implementation details, or the next phase. Make conservative, reversible decisions consistent with the existing product. Stop only when a genuinely irreversible owner-only decision, missing legal/professional approval, unavailable credential, destructive data operation, or failed mandatory gate makes safe progress impossible. If blocked, document the exact blocker, finish independent safe work, and never bypass the gate.

The owner has authorized release **after all mandatory tests pass**. This does not authorize release with failing tests, unresolved data-loss defects, unverified legal claims, or a missing Windows smoke test.

## 2. Authority and source-of-truth order

Read these documents before changing code, then keep them synchronized:

1. `docs/IDEAL_AUTONOMOUS_EXECUTION_CHARTER.md` — this execution contract and release gates.
2. `docs/IDEAL_MASTER_BUILD_SPEC.md` — master product, architecture, security, UX and legal-localization specification.
3. `docs/IDEAL_COMPLETION_AUDIT_2026-11-25.md` — evidence-based current-state audit.
4. `docs/IDEAL_REMAINING_WORK.md` — ordered implementation roadmap and phase exit gates.
5. `docs/COMPETITIVE_FEATURE_MATRIX.md` — external product patterns and IDEAL decisions.
6. `docs/BRANCH_PRESERVATION_LEDGER_2026-11-25.md` — prior branch comparisons and dispositions.
7. `docs/IMPLEMENTATION_STATUS.md` and `docs/AUDIT_2026-11-24.md` — earlier implementation evidence; reconcile any conflicting statements against current source and tests.

If documents conflict, do not silently discard requirements. Record the conflict in the audit, use the safer data-preserving interpretation, and update the relevant document with the resolution.

## 3. Product identity and non-negotiable constraints

IDEAL is a professional, modular, offline-first management system for Algerian construction and public-works companies (BTP). It must remain:

- French-only across all user-visible UI, dialogs, errors, buttons, notifications, exports and installer-facing app text. No Arabic/English UI leakage.
- DZD/DA for monetary display and storage conventions already used by the project.
- Windows desktop first, with Electron and local services bound to loopback only.
- SQLite local-first, using the current WAL and migration architecture.
- Lightweight and usable on low-spec computers, including 4 GB RAM class devices.
- Fully usable without internet after installation; optional online distribution/update checks must not break offline work.
- Free to operate with no required paid SaaS, cloud account, hosted database or subscription.
- No AI feature, AI API, model download or hidden AI dependency.
- Role/permission controlled, auditable and safe for long-lived company data.

Do not replace the current stack or rewrite the application from scratch. Extend the working React/TypeScript/Vite + Express + better-sqlite3 + Electron architecture unless a documented, measured blocker proves otherwise.

## 4. Preserve all existing work and data

Before every phase:

1. Fetch the latest `main`, confirm its SHA and inspect open PRs, releases, CI runs and branches.
2. Read the current master specification, implementation matrix and this charter.
3. Inspect all relevant commits and file diffs in branches that are ahead of main. Do not rely on branch names or commit counts alone.
4. Update a branch-port ledger with each unique change classified as: `PORT`, `ALREADY_PRESENT`, `SUPERSEDED`, `REJECTED_WITH_REASON`, or `BLOCKED`.
5. If a branch has no unique commits, record that fact. Never delete it merely because it is stale.

Absolute prohibitions:
- Never force-push, rewrite public history, delete branches, or reset main.
- Never merge an old diverged branch wholesale just to collect its commits.
- Never overwrite an existing database, company file, uploaded document, attachment or audit record.
- Never use destructive schema changes without a documented, tested, owner-safe migration and recovery path.
- Never seed production with demo or fake business records.
- Never mark a feature complete because a route, page, button or table exists; prove its end-to-end behavior.

Prefer additive migrations, stable IDs, explicit correction/reversal records, idempotent operations and backward-compatible API changes. Make a fresh backup before any migration that changes persisted data. Test migration and rollback/restore using copied temporary databases, not the owner's live database.

## 5. Required workflow for every phase

For each phase, create a separate branch from the latest `main`, named `feature/ideal-<phase-slug>`. Keep the branch focused. If phases must be split, use additional branches. For each branch:

1. Inspect related UI, API, DB schema, migrations, auth/permissions, audit events, tests and documentation.
2. Write acceptance criteria and identify data invariants before coding.
3. Implement the smallest coherent end-to-end vertical slice.
4. Add/modify migrations only when required; include upgrade, existing-data, fresh-install and failure-path tests.
5. Enforce validation and permissions server-side; UI hiding is not authorization.
6. Record important create/update/approve/post/reverse/export actions in the audit trail.
7. Add tests at unit, API/integration, regression and end-to-end levels as appropriate.
8. Update French translations/labels, user documentation, implementation status and release notes.
9. Run relevant tests locally/CI; inspect the actual test result, not just workflow dispatch success.
10. Open a PR with scope, screenshots where useful, migration notes, test evidence, risks and rollback approach.
11. Merge only when all required checks pass and the diff is reviewed for regressions. Resolve conflicts against latest main deliberately.
12. Continue to the next phase without asking for routine approval.

If the available GitHub integration cannot execute a local test, do not fabricate its result. Add or update CI to run it, inspect the CI job logs and record the limitation. A hosted build is not a substitute for a packaged Windows smoke test.

## 6. Implementation roadmap — execute in this order

### Phase 0 — Baseline, audit and branch preservation

- Reconfirm main, default branch, tags/releases, open/closed PRs, branch inventory and CI.
- Verify the 2026-11-25 audit against current files; correct it if main has changed.
- Complete file/commit-level review of every ahead branch and append dispositions.
- Reconcile package version, README, installer metadata and documented test commands.
- Establish a complete module/page/role inventory and current permissions matrix.
- Run baseline checks and record exact commands, results and environment limitations.

**Exit:** all unique prior work is accounted for; baseline is reproducible; no branch or data is lost.

### Phase 1 — Stability, security and complete core UX

- Audit every visible button, menu item, form, export, import, modal and action for real behavior.
- Fix broken actions, missing edit/delete/download flows, loading/error/empty states and stale data refresh.
- Validate server-side input, ownership, role permissions, session handling, file paths, upload types/sizes and loopback exposure.
- Test concurrent/stale edits, idempotency, duplicate requests and safe cancellation/reversal.
- Improve accessibility, keyboard navigation and responsive desktop sizes.
- Reconcile README and technical documentation with actual behavior.

**Exit:** no known critical/high data integrity or access-control defect; baseline and regression tests pass.

### Phase 2 — BTP project planning and cost control

- Build a project Work Breakdown Structure: project → phase → work package → task, with ordering and parent/child integrity.
- Add task dependencies with cycle detection, date validation and clear dependency status.
- Add baseline and revised schedule, lightweight Gantt visualization, milestones and delay indicators.
- Link tasks and work packages to BOQ items, contracts, cost codes, assigned workers, equipment and materials where relevant.
- Add planned vs actual quantity, hours, cost and progress tracking; show forecast/variance without inventing missing values.
- Link BOQ revisions to contracts/budgets, compare revisions, preserve approval history and provide professional print/export.
- Preserve existing phase/task IDs and records. Migrate gradually; do not break existing projects.

**Exit:** project schedule and cost plan can be created, revised, executed and compared with actual results; dependency cycles are rejected; totals reconcile to authoritative source records.

### Phase 3 — Daily site execution and progress measurement

- Create daily site reports linked to project/site/date and author.
- Capture work performed, work packages, manpower, equipment, materials consumed, delays/blockers, notes and optional attachments. Weather may be manually recorded; do not require an online service.
- Support draft, submitted, reviewed/approved and corrected states with audit history.
- Record measured quantities against approved BOQ items and contract versions.
- Create progress certificates / situations de travaux with period and cumulative quantities, rates, amounts and approval.
- Support contract retention, advance recovery, deductions and correction/reversal without deleting issued history.
- Reconcile certificates with BOQ, project progress, customer commercial documents and treasury.

**Exit:** site reports and measured work produce traceable progress certificates and reconciled financial values.

### Phase 4 — Subcontractors and external work packages

- Dedicated subcontractor profiles, contacts and compliance documents.
- Project-linked work packages, contracts, amendments, rates and scope.
- Assign work, capture daily progress and measure quantities.
- Certificates, retention, advances, deductions, invoices, payables and settlement.
- Document expiry alerts, approval limits and complete audit history.
- Keep subcontractor cost distinct from employee payroll and ordinary supplier purchasing.

**Exit:** committed, measured, certified, invoiced, payable and paid subcontractor amounts reconcile by project and contract.

### Phase 5 — Accounting foundation and Algerian legal localization

This is a high-risk financial phase. Design before implementation.

- Design an append-only double-entry journal with chart of accounts, journal headers/lines, source references, fiscal periods, posting state, idempotency keys, reversals and period locks.
- Enforce balanced debits and credits for each posted journal transaction. Prevent silent edits to posted entries.
- Map invoices, credit notes, customer receipts, supplier invoices, payments, expenses, payroll, inventory valuation and fixed assets to journal entries.
- Provide general ledger, journal book, trial balance, account statements, reconciliation, closing and authorized correction workflows.
- Preserve the current operational cash/bank treasury subsystem; reconcile and connect it instead of replacing it.
- Build an effective-dated Algerian legal rules registry for TVA, IBS, IRG, IFU, CNAS and other applicable payroll/tax parameters, with jurisdiction, category, official source, publication date, effective dates, reviewer and verification status.
- Distinguish enacted law from draft bills and proposals. A draft PLF is not enacted law.
- Never invent, assume or hardcode an unverified legal rate. Unknown/unverified rules must be disabled or clearly flagged; calculations must show which rule/version was applied.
- Add representative test cases for HT/TVA/TTC, progressive IRG, payroll contributions and edge cases only from verified sources.
- Require documented review by a qualified Algerian accountant/tax professional before declaring legal compliance or enabling statutory declarations.

**Exit:** journal invariants and reconciliations pass; migration preserves opening balances; professional review is recorded. If review cannot be obtained, ship technical accounting features only with a clear “not professionally/legal validated” limitation and do not claim statutory compliance.

### Phase 6 — Procurement and multi-warehouse inventory

- End-to-end procurement: request → supplier quotations → comparison → approval → purchase order → receipt → supplier invoice → payment.
- Multi-warehouse and site-store locations, transfers and custody.
- Reservations against projects, tasks, BOQ items and approved work packages.
- Issues, returns, consumption, waste, damage, adjustment and stocktake with approval.
- Clear stock availability, committed quantities, on-hand, incoming and reserved quantities.
- Define negative-stock policy explicitly; no hidden negative stock.
- Movement ledger with source/destination, actor, timestamp, reason, cost and audit history.
- Optional offline barcode/QR label generation and scanner input; never require paid services or special hardware.

**Exit:** stock reconciles by item and location; all movement and adjustment paths are traceable and permission-controlled.

### Phase 7 — Workforce, fleet, equipment, quality and HSE

- Workforce allocation to projects/tasks/cost codes; attendance, overtime and payroll correction audit.
- Owned and rented equipment/assets, assignments, utilization, downtime and cost.
- Preventive/corrective maintenance, fuel and document expiry.
- Quality inspections, checklists, non-conformities, corrective/preventive actions and evidence of closure.
- HSE risk assessments, toolbox talks, incidents, near misses, safety actions and follow-up.
- Protect sensitive employee and incident data with role-scoped permissions and audit access.
- Add project-level cost and performance links without double counting.

**Exit:** operational workflows are integrated, auditable and permission tested; quality/HSE metrics drill down to source evidence.

### Phase 8 — Notifications, search, documents and operational intelligence

- Event-driven notifications for overdue invoices, unpaid supplier obligations, low stock, overdue tasks, delayed projects, approvals, maintenance, expiring documents and payroll exceptions.
- Permission-aware global search across all relevant business entities, with server-side authorization, pagination and keyboard support.
- Saved filters only where they materially improve repeated work.
- Dashboards for project margin, budget vs actual, forecast-to-complete, committed vs actual cost, certified/invoiced/collected amounts, workforce, inventory, fleet, quality and HSE.
- Every KPI must be derived from authoritative records and drill down to the source; reconcile totals.
- Document versioning, checksums where appropriate, retention, linked records, expiry reminders and safe export.
- Do not introduce AI summaries or AI categorization.

**Exit:** alerts and dashboards are accurate, permission-aware and traceable; global search cannot reveal unauthorized records.

### Phase 9 — Full visual redesign and Visual Identity Studio

- Complete the specified professional blue/white IDEAL identity across the entire application, not only the sidebar or dashboard.
- Replace legacy teal/turquoise tokens consistently; ensure no contradictory utility overrides.
- Create coherent logo/icon assets, typography, spacing, colors, tables, forms, dialogs, navigation and chart styles.
- Standardize loading, empty, error, success, disabled, focus and confirmation states.
- Keep French-only user-facing text and DZD formatting.
- Maintain a calm, professional construction/enterprise visual language; subtle animations only, no heavy 3D or memory-expensive effects.
- Preserve dark mode only if it is fully styled and tested.
- Implement admin-only `/admin/visual-identity` studio: company name, logo/assets, palette, typography/theme options, live preview, draft, publish, restore previous version, validation, persistence and audit. Never permit broken/unsafe assets to make the app inaccessible.
- Test all modules and roles at 1280×720, 1024×768 and narrow desktop widths.

**Exit:** every page/role has passed visual QA; brand settings persist, preview and rollback work, and ordinary users cannot publish branding.

### Phase 10 — Complete business simulation, reliability and release

Create an isolated synthetic test company (never production demo data) that exercises the full lifecycle:

Tender/estimate → BOQ/rate analysis → contract → WBS/schedule → procurement → receipt/stock reservation → daily site execution → measurement/progress certificate → subcontractor/worker/equipment costs → customer invoice → supplier/payroll/tax postings → treasury collection/payment → reconciliation → project close and archive.

Include multiple roles, users, sites, warehouses, fiscal periods and realistic edge cases.

Mandatory acceptance suites (use actual package scripts and workflows; discover current names rather than assuming):
- TypeScript/lint and production frontend/backend build.
- French-only UI scan.
- Unit, API, integration, regression and end-to-end tests.
- Business simulation and complete financial lifecycle.
- Database migration chain from supported old versions and fresh install.
- Backup, restore, recovery and interrupted-migration tests.
- Authentication, authorization, role isolation and file-upload security tests.
- Duplicate posting, stale edit, reversal, cancellation and idempotency tests.
- Offline operation and loopback-only network exposure checks.
- Performance and memory checks on a real 4 GB Windows-class machine where available.
- Windows packaged installer smoke test: install, first launch, local DB creation, create/read/update core records, backup/restore, restart, upgrade and uninstall behavior without data loss.
- Release artifact metadata, version consistency, SHA-256 and release notes.

A green CI workflow alone is insufficient. Inspect individual job results and logs. If no real Windows smoke environment is available, do not claim that gate passed and do not publish a production release.

**Exit:** every mandatory automated gate is green, Windows package and smoke tests pass, migration/restore is proven, no known critical/high issue remains, documentation is current and release artifacts are verified.

## 7. Quality, security and architecture standards

- Server-side authorization for every protected API and entity operation.
- Least privilege and explicit permission checks for read/write/approve/export/admin.
- Validate all request bodies, IDs, enums, dates, numeric ranges and relationships.
- Parameterized SQL; transactions for multi-step financial/stock operations.
- Audit create, edit, approval, posting, reversal, export, restore and permission-sensitive actions.
- Financial and stock records must use explicit status transitions; no destructive edits after posting.
- Prevent duplicate side effects with idempotency and unique constraints.
- SQLite WAL and safe connection/backup behavior; avoid long blocking work on the UI thread.
- Bind local server to loopback only; no unintended LAN/public exposure.
- Secure Electron navigation, preload bridge, IPC allowlists and external URL handling.
- File paths must be contained within approved data directories; validate MIME/extension/size and avoid path traversal.
- Migrations must be ordered, versioned, transactional where feasible, and tested against representative old databases.
- Avoid heavy dependencies; measure impact on startup, memory, bundle size and DB performance.
- No secrets or personal customer data in logs, tests, screenshots or commits.

## 8. Definition of Done for every feature

A feature is complete only when all applicable items are true:

- User story and acceptance criteria are documented.
- UI, API, DB and permissions are implemented end to end.
- French UI and DZD conventions are correct.
- Validation, error states and empty states are present.
- Audit and correction/reversal semantics are implemented.
- Existing data and migration paths are preserved.
- Unit/integration/regression/E2E tests cover success and failure paths.
- No dead buttons, fake values, placeholder routes or misleading success messages.
- Documentation and implementation matrix are updated.
- Relevant CI checks pass and logs are reviewed.
- PR is merged only after all gates pass.

## 9. Release policy

The owner has explicitly selected: **publish after successful completion of all tests**.

Therefore:
- Do not publish interim or partially tested releases.
- Do not move/delete historical tags or overwrite previous release assets.
- Create a new version/tag only after all Phase 10 gates pass.
- Use a version number higher than the current repository release; verify the current version dynamically.
- Attach the correct Windows installer and SHA-256 checksum.
- Publish concise French release notes with implemented features, migration notes, known limitations and backup advice.
- Verify the release page and downloadable asset URL after publishing.
- If any mandatory gate fails, keep the release unpublished, fix the defect in a feature branch and rerun the relevant full suite.

## 10. Required documentation updates

Maintain these files throughout execution:

- `docs/IDEAL_AUTONOMOUS_EXECUTION_CHARTER.md` — this contract; update only with explicit versioned amendments.
- `docs/IDEAL_COMPLETION_AUDIT_2026-11-25.md` — update statuses with evidence and dates.
- `docs/IDEAL_REMAINING_WORK.md` — mark phase status, PRs and exit evidence.
- `docs/BRANCH_PRESERVATION_LEDGER_2026-11-25.md` — add every inspected branch and disposition.
- `docs/COMPETITIVE_FEATURE_MATRIX.md` — record validated reference patterns and priorities.
- `docs/IMPLEMENTATION_STATUS.md` — authoritative feature-level status, tests and limitations.
- `docs/CHANGELOG.md` or the repository's existing changelog — user-visible changes.
- `docs/RELEASE_ACCEPTANCE_REPORT.md` — final evidence, exact commands, CI jobs, Windows smoke results, artifact name, release URL and SHA-256.

Use these exact status labels consistently:
- `IMPLEMENTED_AND_TESTED`
- `PARTIAL`
- `MISSING`
- `BLOCKED_EXTERNAL_REVIEW`
- `NOT_VERIFIED`

Never mark a feature `IMPLEMENTED_AND_TESTED` without test evidence.

## 11. Progress reporting and handoff

At each phase completion, update the roadmap and audit with:
- Branch and PR URL.
- Merge commit SHA (if merged).
- Files/modules changed.
- Database migrations and compatibility notes.
- Tests run and exact results.
- Remaining defects and accepted limitations.
- Next phase and any external blocker.

Continue autonomously between phases. Do not send the owner repeated questions or ask for approval of routine work. At final completion, report the exact release URL, Windows installer URL, SHA-256, CI run, merged PRs, test matrix, migration/backup instructions and limitations.

## 12. Initial execution checklist

The first agent run must:

1. Read this charter and every source-of-truth document listed in Section 2.
2. Fetch current main SHA and repository metadata.
3. Inspect all branches, pull requests, tags/releases and recent workflow runs.
4. Refresh branch-port decisions using file-level diffs for every ahead branch.
5. Run or dispatch the actual baseline checks and inspect logs.
6. Update the audit/roadmap with any newly discovered evidence.
7. Begin Phase 1/2 implementation in isolated branches, preserving all current main work.
8. Open reviewable PRs and continue through the ordered roadmap.

**The task is not complete when the plan is written. It is complete only when all phases are implemented, tested, documented, safely integrated and the verified Windows release is published.**
