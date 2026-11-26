# IDEAL — Implementation status and gap matrix

Living status table required by `docs/IDEAL_MASTER_BUILD_SPEC.md` §10.
Last updated: 2026-11-26. Branch: `feature/ideal-full-erp-completion`. Schema version: 13.
Spec baseline: `main` at `1d4015df8f30b3ac840d0d9e80151072f675d22d` (spec authored on `docs/ideal-master-build-spec`).

Statuses: **Verified** (workflow + tests confirmed), **Not fully verified** (code exists, important paths untested),
**Partial** (some layers exist), **Missing** (nothing found in UI, API or schema), **Blocked** (needs owner/legal decision).

## Delivery phases

| Phase | Status | Evidence | Remaining work |
|---|---|---|---|
| 0 — Audit and safe baseline | Verified | `docs/AUDIT_2026-11-24.md`; module/route inventory (141 → 156 endpoints); all suites green | Keep matrix current after each change |
| 1 — Stability, security, data protection | Verified | `test:data-protection` (SHA-256 backup/restore, session), lifecycle lockout rules, loopback-only server, isolated test dirs. Backups rotate, copy to an owner-chosen local folder (OneDrive/network), run an integrity check at startup and warn on the dashboard when stale. `test:migrations` runs the whole chain against a captured schema-9 company database | — |
| 2 — Construction project controls | **Partial** | Contracts, change orders, milestones, phases/tasks exist. BOQ: versions, sections, items, rate analysis, approval, revision duplication, conversion of an approved version into a devis | WBS dependencies + Gantt, baseline schedule, planned vs actual progress/cost, BOQ → contract linkage, BOQ version comparison |
| 3 — Field execution and subcontractors | **Partial — daily site reports complete** | Journal de chantier: schema 13 (`site_reports`, workforce, equipment, materials), API with draft → submitted → approved/rejected workflow, per-project/day uniqueness, optimistic revisions, attachments through the document register, XLSX export, printable French report, `sites:read/write/approve` permissions and audit trail; `test:site-reports` green | Measured quantities/IPC, retention/advance recovery, subcontractor entity |
| 4 — Finance and accounting integrity | Partial | Payments with reversal, cash closings, reconciliation, aging, receivables/payables | Double-entry ledger decision (§3.13 target) — **Blocked** on accounting architecture approval |
| 5 — Inventory, procurement, fleet | Partial | Purchases/receipts/payments, stock ledger, fuel, repairs, maintenance, tool checkouts | Multiple warehouses, reservations, stocktake, purchase requests with thresholds, rental assets |
| 6 — Quality, HSE, documents, notifications | Partial | Document register (upload/edit/archive/download), retention notifications | Quality/HSE entirely missing; document versioning; expiry/task/stock notification feeds |
| 7 — UX consistency and global search | Partial | Navigation search, command palette (clients/projects/invoices), consistent page shell | Palette must cover employees, materials, purchases, documents, tasks; per-module pagination/sorting |
| 8 — Full-company simulation and Windows release | Partial | `test:simulation` covers one business chain; Windows workflows exist in CI | Multi-role company simulation, legacy migration, packaged smoke test, release notes |

## Module matrix (§3)

| Domain | Status | Tests | Main gap |
|---|---|---|---|
| 3.1 Setup, users, roles, audit | Not fully verified | setup/login/permissions in all suites | Custom roles, audit-log filtering UI |
| 3.2 Customers / CRM | Partial | clients in simulation + regressions | Duplicate detection/merge, multiple contacts, statement print |
| 3.3 Suppliers and subcontractors | Partial | suppliers/purchases in simulation | **Subcontractor entity and certificates missing** |
| 3.4 Projects, contracts, amendments | Verified | projects/contracts/milestones in regressions | Multiple sites per project, project cost codes |
| 3.5 BOQ, estimates, rate analysis, quotations | **Partial — core + devis conversion** | BOQ block in `test:regressions` (versions, sections, items, resources, approval, duplication, permissions, conversion to a linked devis with VAT, totals and amount in words) | BOQ → contract conversion, version comparison, BOQ print/export of its own layout |
| 3.6 WBS, planning, scheduling | Partial | Existing phases/tasks; schema 12 task dependencies with same-project constraints, cycle prevention, task-date validation, French UI add/remove; `test:project-scheduling` and Windows packaged-app smoke test passed in PR #20 | WBS hierarchy, Gantt/timeline, baseline/revised schedule, milestones and critical path |
| 3.7 Daily site reports | **COMPLETE (core)** | `site_reports` + child tables (schema 13), `server/routes.ts` `/site-reports` endpoints, `src/pages/SiteReportsPage.tsx`, `scripts/test-site-reports.ts`: CRUD, weather/temperature/site condition, workforce hours, equipment hours, materials consumed, incidents, submit/approve/reject with mandatory reason, draft-only deletion, duplicate-day refusal, attachments, XLSX export and print layout | Photo galleries/before-after sequences; certification links to IPC (Phase 3 remainder) |
| 3.8 Progress measurement and billing | Missing | — | Measured quantities, IPC, retention/advance rules |
| 3.9 Workforce, attendance, payroll | Not fully verified | attendance/payroll in simulation | Locked-period correction flow, configurable formulas with effective dates |
| 3.10 Procurement | Partial | purchases/receipt/payment in simulation | Purchase requests + approval thresholds, supplier quote comparison |
| 3.11 Inventory and warehouses | Partial | stock movements in simulation | Multi-warehouse, reservations, stocktake, negative-stock policy |
| 3.12 Fleet and maintenance | Partial | vehicles/fuel/repairs in simulation | Ownership vs rental, document expiry alerts |
| 3.13 Finance and treasury | Partial | treasury/reversal/cancellation in regressions | General ledger (Blocked pending decision) |
| 3.14 Taxes and Algerian localization | Partial — **Blocked** on legal validation | tax-rule CRUD/uniqueness/IRG guard in regressions | Verified official rate pack, IFU/CASNOS, declaration calendar, rule version stamped on documents |
| 3.15 Quality, HSE, inspections | Missing | — | Entire module |
| 3.16 Documents | Partial | upload/edit/archive in simulation | Document versioning, expiry reminders |
| 3.17 Reports and dashboards | Partial | dashboard KPIs in simulation | Budget vs actual by phase/cost code, safety/quality KPIs, filters |
| 3.18 Notifications | Partial | retention notifications + lifecycle suite | Invoice, stock, maintenance, document expiry, task and payroll feeds |
| 3.19 Global search | Partial | palette covers clients/projects/invoices | Extend to all entities with permission scoping and keyboard navigation |

## Cross-cutting spec sections

| Section | Status | Note |
|---|---|---|
| §4 No dead buttons | Verified for audited screens | Every control in the audit was wired or removed; the BOQ page follows the same contract (draft-only edits, French errors, confirmations) |
| §5 Architecture | Verified | React UI + typed API client + Express validation + SQLite migrations; money handled with `round2` (REAL columns), not integer minor units — documented deviation |
| §5 Document numbering | Verified | `document_sequences` (unique per prefix + exercise) reserved by a single upsert inside the document transaction, so numbering is gap-free and two writers cannot share a number; numbers issued before the sequence are seeded on first use. Regression covers rolled-back inserts, parallel creates and two processes on one database |
| Backups hors du poste | Verified | Verified archive copied to `backup_external_dir` (validated as an existing writable folder), retention for daily and manual archives including the external copies, `PRAGMA integrity_check` + `foreign_key_check` at startup, dashboard warning when the last backup is older than `backup_warn_after_days` or was not copied. `test:data-protection` covers copy, rotation, missing folder and health |
| §5 Migration safety | Verified | `test:migrations` loads `tests/fixtures/company-legacy-v9.sql` — a captured schema-9 company with contracts, invoices, a credit note, payments, purchases, stock, payroll, the cash journal and a BOQ — then runs the real startup chain 1→11 and asserts identical row counts and sums (28 tables, 17 amount columns), readable business facts, `integrity_check`/`foreign_key_check` clean, defaults on the new columns, and an idempotent second start. A build refuses a database whose `schema_migrations` is above `LATEST_SCHEMA_VERSION`: startup exits 1 with a French message and the file is left untouched |
| §5 Concurrent access | Verified | WAL plus a 5 s `busy_timeout`; documents, payments, payslips and payroll periods carry a `revision` that must match on save, so a stale save returns 409 with a reload message instead of overwriting. Regression covers document, payment, payslip and period conflicts |
| §7 Test strategy | Partial | API/integration tests strong; no component tests; Playwright cannot run in the Linux sandbox (missing `libnspr4`, no root). CI runs lint, the French-UI check, the migration chain, scheduling, site reports, data protection, lifecycle, simulation and regressions on Ubuntu (`.github/workflows/tests.yml`), and the packaging workflow runs the migration test first |
| §14 Visual redesign | **Partial — official palette applied** | `src/index.css` now uses the official `#12304A` / `#2563EB` / white identity (teal theme and teal utility overrides removed); sidebar brand mark and active navigation use the dark-blue/main-blue pair; all pages inherit the updated shell | Per-module visual QA at supported resolutions, Visual Identity Studio, dedicated logo assets |
| §15 Algerian tax/legal engine | **Blocked** | Requires verified official 2026–2027 sources and accountant validation before activation |
| §16 Operational intelligence | Partial | Lifecycle dashboard, alerts, audit trail exist; control center and forecasting missing |

## Highest-value next work (agreed order)

1. **Measured quantities + progress certificates** (§3.8): measurement records against BOQ items, IPC with cumulative/period quantities, retention, conversion to invoices.
2. **WBS + Gantt/baseline** (§3.6): hierarchical work packages, baseline/revised schedules, planned vs actual, critical path.
3. **Subcontractors** (§3.3): entity, contracts, work packages, certificates, settlements.
4. **Accounting journal** (§3.13): append-only double-entry ledger after owner approval of the architecture.
5. **Quality/HSE** (§3.15), notification feeds and global search expansion (§3.18, §3.19).
6. **Full blue/white visual QA across every module** and the Visual Identity Studio (§14).

## Known limitations

- Money is stored as SQLite REAL and rounded with `round2`; §5.2 prefers integer minor units. Changing the money representation is a cross-cutting migration and is not started.
- The BOQ module does not yet produce a printable French document, and does not feed quotations or contracts automatically.
- Tax rates are deliberately not seeded; the fiscal engine stays in "requires professional validation" state.
