# IDEAL — Remaining work and execution roadmap

This roadmap is based on `docs/IDEAL_COMPLETION_AUDIT_2026-11-25.md`, `docs/IMPLEMENTATION_STATUS.md`, and `docs/IDEAL_MASTER_BUILD_SPEC.md`. It is a delivery sequence, not a statement that the work is already implemented.

## Execution rules

- Work from the current `main` baseline using short-lived feature branches.
- Before touching a domain, inspect the current schema, API, UI, permissions, tests and all relevant ahead commits.
- Preserve existing records and historical documents. Prefer additive migrations and explicit reversible business operations.
- Do not mix unrelated domains in one feature branch.
- Every feature requires API validation, server-side permissions, audit history, French UI, regression tests and an end-to-end path.
- Do not use production/sample company data in tests. Use unique temporary data directories.
- No AI, mandatory cloud, paid service or always-online dependency.
- No legal claims without current official Algerian sources and independent professional review.
- Merge only after CI and code review. Do not force-push or delete branches.
- Stage 0 is audit and planning only. Stop and obtain explicit owner approval before any product-code, schema, migration or release change. Approval is limited to the selected scope; release authorization is separate.

## Phase 0 — Baseline and branch preservation

**Deliverables**
- This audit, competitive matrix and roadmap.
- A branch-port ledger covering all ahead commits in the four diverged branches.
- A list of duplicate/stale branches (do not delete them).
- Confirmed main SHA, test workflow, Windows packaging workflow and release metadata.

**Exit gate**
- Every branch with commits ahead of main has a file/commit-level disposition: port, already present, superseded, or rejected with reason.
- No unique change is silently lost.

## Phase 1 — Stability and core UX

- Re-run lint, French-only, data-protection, lifecycle, regressions, migrations, simulation and production build.
- Fix reproducible defects without changing unrelated behavior.
- Reconcile README, app version, installer artifact naming and actual workflow behavior.
- Establish design tokens and page/component inventory before redesign.
- Add a permissions and dead-action audit for all screens.

**Exit gate:** all baseline tests pass; migration chain is clean; no unresolved data-loss/security defect.

## Phase 2 — Construction planning and cost control

- WBS hierarchy for project → phase → work package → task.
- Task dependencies with cycle detection and valid date constraints.
- Baseline and revised schedules, milestones, Gantt view and critical-path indicators where justified.
- Planned vs actual quantities, hours, cost and progress by cost code.
- Link BOQ versions to contracts and project budgets; compare versions and print/export.
- Keep project phase/task records backward compatible.

**Exit gate:** a project can be planned, revised, executed and compared to actual results without duplicate source records.

## Phase 3 — Field execution and progress billing

- Daily site reports with date, project/site, weather (optional/manual), teams, equipment, materials, work performed, blockers, notes and attachments.
- Measured quantities against BOQ items and approved revisions.
- Progress certificates / situations de travaux with cumulative and period quantities.
- Contract retention, advance recovery, deductions and approval history.
- Correct/reverse issued certificates through audited credit/correction flows, never destructive edits.

**Exit gate:** quantities and certified amounts reconcile to BOQ, contract, customer invoice and project progress.

## Phase 4 — Subcontractors

- Dedicated subcontractor profiles and multiple contacts.
- Subcontract packages linked to project/BOQ/cost codes.
- Contracts, amendments, insurance/administrative document expiry.
- Daily work and measured quantities, certificates, retention, advances, deductions, invoices and settlements.
- Permission-scoped approvals and complete audit trail.

**Exit gate:** subcontractor commitment, earned amount, payable and paid amount reconcile.

## Phase 5 — Accounting and Algerian localization

- Design an append-only double-entry journal with chart of accounts, journal entries/lines, source-document references, posting state, fiscal period, reversals and idempotency.
- Enforce balanced debits/credits per journal transaction in the service layer and database constraints where feasible.
- Map customer invoices, credit notes, supplier invoices, payments, expenses, payroll, stock valuation and fixed assets to postings.
- Trial balance, general ledger, journals, account reconciliation, period close/reopen with authorization.
- Preserve existing treasury as an operational cash/bank subledger; migrate by reconciliation, not replacement.
- Effective-dated tax/payroll rules with legal source, publication/effective date, scope and reviewer state.
- Keep unverified rules disabled; do not prefill assumed rates.
- Obtain qualified Algerian accountant/tax review for representative scenarios.

**Exit gate:** accounting postings balance, source records reconcile, reversals are traceable, migrations preserve all existing balances, and professional validation is documented. If professional validation is unavailable, keep legal outputs clearly labelled unvalidated and do not claim compliance.

## Phase 6 — Procurement and inventory

- Purchase requests, budget checks, approval thresholds and supplier quotation comparison.
- Multiple warehouses and site stores with transfer records.
- Reservations against project/task/BOQ and stock availability.
- Issue, return, waste, adjustment and stocktake with approvals.
- Barcode/QR support as optional offline identifiers.
- Explicit negative-stock policy and valuation/reconciliation rules.

**Exit gate:** every quantity movement has source, destination, actor, reason, timestamp and audit trail; stock reconciles by location.

## Phase 7 — Workforce, fleet, quality and HSE

- Workforce cost allocation by project/task and controlled payroll corrections.
- Owned/rented equipment, utilization, assignments, downtime and operating cost.
- Maintenance and administrative document expiry alerts.
- Quality inspections, checklists, non-conformities, corrective actions and closure evidence.
- HSE risk assessments, toolbox talks, incidents/near misses and follow-up actions.
- Role-based privacy and access controls for sensitive personnel/safety records.

**Exit gate:** each workflow is integrated with projects, costs, documents and permissions; safety and quality dashboards drill down to evidence.

## Phase 8 — Operational intelligence, search and documents

- Event-based notification center for invoices, stock, maintenance, documents, tasks, approvals and payroll.
- Permission-aware global search with pagination and keyboard navigation.
- Saved filters/views where useful.
- KPIs for budget vs actual, forecast-to-complete, certified/billed/collected, stock, fleet, quality and HSE.
- Every KPI links to source records and reconciles to financial/operational data.
- Document versioning, retention and expiry workflows.

**Exit gate:** no fake KPIs; all alert counts and totals derive from current authoritative records.

## Phase 9 — Visual redesign and Visual Identity Studio

- Apply a consistent blue/white design system across every page and role.
- Create a professional IDEAL logo set and company-branding assets.
- Standardize typography, spacing, tables, forms, dialogs, empty/loading/error states, focus and responsive behavior.
- Keep light mode default; retain dark mode only if fully supported and tested.
- Build admin-only Visual Identity Studio with live preview, draft/publish, restore previous version and safe asset validation.
- Keep animations subtle and respect reduced motion; avoid heavy 3D.
- Test 1280×720, 1024×768 and narrow desktop windows.

**Exit gate:** visual regression/manual QA across all modules; brand settings persist and cannot break app access.

## Phase 10 — Full-company acceptance and Windows release

- Synthetic BTP company with multiple roles, projects, sites, BOQs, workers, suppliers, stock locations, fleet, subcontractors and fiscal periods.
- Full lifecycle from tender/BOQ through contract, procurement, site execution, measurement, progress billing, payroll, accounting, collection and project close.
- Negative tests for permission denial, invalid tax rules, stale edits, failed restore, interrupted migration, duplicate posting and reversals.
- Migration test from captured legacy database; backup and restore to separate path.
- Offline packaged Windows smoke test and update/recovery checks.
- Measure startup, idle/use memory, search, report/export and DB growth on target hardware; do not infer 4 GB acceptance from a cloud runner.
- Verify French-only UI, DZD, installer metadata, SHA-256, unsigned installer warnings and release notes.
- Publish only when all mandatory gates pass; provide exact release tag, installer link, SHA-256, CI run and known limitations.



## Product transformation workstream — complete rebuild of the user experience

This workstream is required in addition to the technical phases above. Follow Section 13–14 of `docs/IDEAL_AUTONOMOUS_EXECUTION_CHARTER.md`. The target is a cohesive professional product, not a collection of incremental CRUD screens.

### A. Re-architecture and redesign across every module
- Rework the information architecture, navigation, dashboards, record details, forms, tables, dialogs, filters, search, settings and role-specific workflows.
- Redesign every module and every user-facing screen with one consistent French-first design system.
- Consolidate duplicate workflows only after preserving their behavior and data.
- Add contextual activity timelines, related-record navigation, clear lifecycle states and role-specific actions.
- Validate all major screens at supported Windows resolutions and on low-memory hardware.

### B. Company profile and reusable identity
- Build a complete company profile: legal/commercial name, logo, business activity, full address, wilaya/commune, phone/mobile, email, website, applicable registration/tax identifiers, bank details, authorized signatories and default commercial terms.
- Validate identifier applicability and legal wording; never fabricate company details.
- Reuse approved company details automatically in every relevant document template.
- Include permissions, preview, versioning and audit history for sensitive settings.

### C. Professional documents and PDF workflow
- Build a unified template and document-generation engine for quotations, invoices, credit notes, receipts, statements, purchase orders, delivery notes, contracts, BOQ/BPU/DQE, progress certificates, site reports, HR documents, fleet/equipment forms and management reports.
- Support professional A4 layouts, company logo/contact block, partner details, unique numbering, dates, line items, HT/TVA/TTC where applicable, payment terms, signature areas, page numbering and reliable page breaks.
- Provide draft preview, issue/approval, PDF generation, download, re-open, reprint and immutable issued snapshots.
- Prevent duplicate document numbers and preserve historical documents when company data or templates change.
- Enable statutory claims only after official-source and qualified-professional validation.

### D. Document archive, photos and attachments
- Create a central searchable archive with categories, tags, metadata, versions, links to business records, expiry reminders and permission-controlled actions.
- Attach multiple photos/files to projects, sites, reports, tasks, inspections, incidents, vehicles, equipment, materials and other relevant records.
- Provide galleries, thumbnails, full-size preview, captions, before/during/after sequences, photo reports and selected-image PDF exports.
- Preserve original files, generate separate thumbnails, and include files plus metadata in backup/restore.
- Keep all file storage local and offline; validate uploads and prevent path traversal and unauthorized access.

### E. Rich contacts and operational reporting
- Upgrade customer/supplier profiles with legal identity, multiple contacts/addresses, phone/email, identifiers where applicable, payment terms, activity history, balances and attached documents.
- Provide printable/exportable reports for project profitability, budget vs actual, receivables/payables, cash flow, taxes, payroll, stock, purchasing, fleet, equipment, subcontractors, quality and HSE.
- Make every important KPI traceable to source records and prevent double counting.

### Product transformation exit gate
- All modules have a coherent redesigned workflow, not just a refreshed dashboard.
- Company profile data appears correctly in generated documents.
- At least one end-to-end acceptance scenario per document family verifies create → preview → issue/approve → PDF → archive → retrieve → download → print.
- Issued documents remain immutable snapshots and numbering is concurrency-safe.
- Photos and attachments can be added, previewed, retrieved, exported and restored from backup.
- Role permissions, offline operation, French-only UI, DZD calculations, migration safety and 4 GB-class performance are tested.
- Existing company data and historical records survive upgrades with reconciliation evidence.

## Release decision

A passing TypeScript check or browser build alone is not release approval. A release candidate must pass all relevant automated tests, migration/data-protection checks, Windows packaging and packaged smoke test. Legal/accounting compliance must be independently reviewed or explicitly labelled not professionally validated. Preserve all existing branches and historical releases.
