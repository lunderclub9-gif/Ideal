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

You are authorized to undertake a comprehensive product-level rebuild and re-engineering of IDEAL: redesign the information architecture, navigation, every module, every screen and every workflow so the result feels like a cohesive, modern, best-in-class professional product. This may involve replacing substantial UI and application layers where justified. However, “from scratch” means rebuilding the product experience and weak/incomplete implementation—not discarding valuable business logic, security controls, migrations, audit history, existing company data or proven features. Preserve the current React/TypeScript/Vite + Express + better-sqlite3 + Electron foundation by default; change the stack only when a documented, measured technical case demonstrates a clear net benefit and a safe migration path.

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


---

## 13. Owner-requested product transformation — rebuild IDEAL as a complete professional product

This section is an explicit owner-approved product direction and is binding. Do not interpret the roadmap as a request to merely patch the current screens. The goal is to transform IDEAL into a unified, polished, comprehensive BTP management product with a consistent experience from first launch to daily operations.

### 13.1 Rebuild the complete experience, not just selected pages

- Re-evaluate the entire information architecture, navigation, module hierarchy, dashboard structure, workflows and terminology.
- Redesign every module and every screen—not only the home page, sidebar or a few recently touched pages.
- Establish a coherent design system and apply it consistently to dashboards, tables, forms, detail views, calendars, kanban/boards, charts, dialogs, settings, reports, document previews and admin screens.
- Make common actions predictable: create, view, edit, duplicate, archive, restore, approve, reject, cancel, export, download and print wherever relevant.
- Use contextual actions, clear status indicators, useful filters, sorting, pagination, saved views where justified, bulk actions with safeguards, and meaningful empty/loading/error states.
- Create useful role-based home dashboards for company owner/admin, accountant, project/site manager, storekeeper and driver. Each dashboard must show actionable information appropriate to that role, not decorative metrics.
- Provide a consistent record-detail layout with tabs/sections for overview, commercial/financial data, activity history, documents, photos and related records where appropriate.
- Provide a global command/search experience across all authorized modules, with keyboard navigation and clear result types.
- Add an in-app help/onboarding layer and contextual explanations for complex BTP, accounting and stock workflows. Keep all user-facing content in French.
- Keep the application responsive for normal Windows desktop resolutions and usable on low-spec hardware. Prefer fast, restrained transitions over heavy animations or 3D effects.
- Remove redundant, confusing, duplicate or dead screens only after confirming that their functionality and data are safely migrated or intentionally consolidated.

### 13.2 Professional company identity and company profile

Create a complete company profile/settings area. Support multiple company branches or legal entities only if the data model and permissions can support them safely; otherwise design the foundation without pretending multi-company is already available.

Company profile fields should include, as applicable:
- Legal/company name and commercial name.
- Logo and optional secondary brand mark.
- Main business activity and BTP specialization.
- Full postal address: street, locality, commune, wilaya and postal code.
- Primary and secondary phone numbers, mobile number and optional WhatsApp contact.
- Professional email, website and other contact channels.
- Official registration and tax identifiers such as RC, NIF, NIS, AI and other applicable identifiers, with field applicability configurable and legal requirements verified before being presented as mandatory.
- Bank name, account holder and bank/RIB details, with strict access control and safe display/masking.
- Default currency (DZD), document language (French), date/number formats and company timezone.
- Authorized signatories, job titles, stamp/signature image where legally and operationally appropriate.
- Default document footer, payment instructions, commercial terms and contact details.

Company information must be reusable automatically in invoices, quotations, purchase orders, delivery notes, receipts, statements, contracts, certificates and other generated documents. Provide validation, preview, version history and audit logging for changes. Never invent official identifiers or prefill fake company information.

### 13.3 Professional document generation, storage, export and printing

Treat business documents as a core product capability, not a basic browser print button. Design a unified document engine and reusable professional templates for at least:

- Quotations/devis and estimates.
- Customer invoices/factures, deposits/acompte invoices, progress invoices/situations and credit notes/avoir.
- Receipts/reçus, payment confirmations and customer statements/relevés.
- Purchase requests, supplier quotation comparisons, purchase orders and goods-received notes.
- Delivery notes/bons de livraison, return notes and stock movement slips.
- Contracts, amendments, work orders and subcontractor documents.
- BOQ/BPU/DQE, rate analysis, progress measurement sheets and progress certificates.
- Daily site reports, attendance summaries, work completion records and handover/acceptance reports.
- Employee/work certificates, payroll slips and authorized HR documents.
- Vehicle/equipment assignment, maintenance and inspection forms.
- Inventory lists, stocktakes, transfer slips and asset registers.
- Financial, tax and management reports, with statutory reports enabled only after legal/professional validation.

Every generated document must:
- Use a clean, professional, print-ready layout with consistent typography, spacing, page numbering, headers and footers.
- Display the correct company logo/name/contact details and applicable legal identifiers.
- Display customer/supplier/employee/project identity and relevant address/contact details according to document type and permissions.
- Include a unique human-readable document number, issue date, status, linked source record and applicable due date/validity period.
- Present line descriptions, quantities, units, unit prices, discounts, tax bases, tax amounts, totals HT, TVA and TTC where applicable, plus amounts in words when appropriate.
- Clearly show payment terms, bank/payment information, notes, approvals and signature/stamp areas when relevant.
- Support long documents with repeated table headers, no clipped totals, no orphaned headings and sensible page breaks.
- Support A4 by default and other practical paper sizes only where needed; provide print preview and printer-friendly output.
- Export to PDF reliably without requiring an internet connection or paid service. Provide CSV/XLSX export for suitable structured reports where useful.
- Allow download, re-open, reprint and controlled regeneration. Issued documents must remain immutable snapshots: later edits to a customer, company profile, price or template must not silently alter an already issued document.
- Support draft preview before issue, controlled issue/approval, cancellation/credit-note/reversal flows and complete version/audit history.
- Prevent duplicate numbering during concurrent creation; numbering series must be configurable by document type, fiscal year and company where appropriate.
- Store the generated file and its metadata against the source record, with checksum/integrity verification where practical.
- Offer safe email-ready file export without requiring the app to send email or depend on a paid email service.
- Never label an ordinary management document as a legally compliant tax invoice unless its content and legal requirements have been verified for the applicable date and business regime.

### 13.4 Document center and permanent business archive

Create a central Documents & Archives module that acts as a searchable, organized company repository.

- Store generated PDFs and user-uploaded files with metadata: title, category, document number, date, company, project, customer/supplier, employee/asset, status, tags and related records.
- Support common office formats and images where safe and technically appropriate: PDF, PNG, JPG/JPEG, WebP, and selected office formats. Do not execute uploaded files.
- Allow multiple attachments per business record and show them in the record's Documents section.
- Support drag-and-drop where practical, multi-file upload, upload progress, preview, download, rename metadata, versioning, archive and restore.
- Add document categories, tags, filters, full-text metadata search and date/project/partner filters. Do not claim OCR or full-text content search unless implemented and tested.
- Store files under an application-controlled data directory with safe generated filenames, path-traversal protection, file size/type validation and backup/restore coverage.
- Preserve original uploads; do not overwrite or destructively compress them. Generate thumbnails/previews as separate derived files.
- Add retention/expiry reminders for contracts, insurance, vehicle papers, employee documents, certifications and other configurable categories.
- Use role permissions for viewing, uploading, downloading, deleting, restoring and exporting sensitive documents. Prefer archive/soft-delete with audit trail over permanent deletion.
- Include all required document files and metadata in backup/restore, and verify restored attachments can be opened.
- Keep the archive fully offline and local. No mandatory cloud storage, external drive, subscription or AI processing.

### 13.5 Photos, images and visual evidence

Make photo and image management a first-class feature throughout IDEAL.

- Allow users to attach multiple photos to projects, construction sites, daily reports, tasks, work progress, quality inspections, HSE incidents, equipment, vehicles, materials, deliveries, employees (only when justified and permission-controlled), customers/suppliers where useful, and general documents.
- Provide a photo gallery with thumbnails, full-size preview, zoom, captions, date, category, uploader and links to the related record.
- Support before/during/after progress photo sets and chronological project/site timelines.
- Allow a cover image for a project, company profile and selected assets; provide safe crop/thumbnail generation without altering the original.
- Support optional manually entered photo date, location/site zone and description. Do not assume GPS metadata is present or accurate.
- Support multiple photos per report/inspection and include selected images in generated PDF reports with captions and page-safe sizing.
- Allow users to download one image or a selected group and export a photo report/contact sheet.
- Preserve original image quality; generate optimized thumbnails for performance. Make compression optional and non-destructive.
- Validate file type and size, protect against malformed files, and ensure backups include original images and metadata.
- Enforce privacy and role access. Do not expose private employee/customer images through public URLs.
- Keep the UI fast on a 4 GB RAM computer by lazy-loading thumbnails and avoiding loading entire image collections at once.

### 13.6 Complete customer, supplier and contact records

Upgrade partner/contact records to be useful operational profiles rather than simple name-and-phone fields.

- Support individual/company type, legal name, commercial name, contact person, role, phone/mobile, email, full address, wilaya/commune, identifiers when applicable, payment terms, credit limit where authorized, notes and active/archive state.
- Allow multiple contacts and addresses where needed, with a clearly selected primary contact/address.
- Show a timeline of quotations, invoices, receipts, payments, orders, contracts, deliveries, disputes/notes and attached files.
- Provide customer balance and aging views from authoritative financial records, with drill-down.
- Provide supplier purchasing history, delivered items, outstanding obligations and document expiry information.
- Prevent duplicate records with safe matching suggestions; never auto-merge records without explicit confirmation and a reversible process.
- Support import/export templates with validation, duplicate preview and error reports.

### 13.7 Record lifecycle, traceability and company history

- Give each important business record a clear lifecycle and status history.
- Provide an activity timeline showing who created, edited, approved, issued, downloaded/exported where appropriate, archived, restored or reversed a record, with timestamps and meaningful change summaries.
- Keep immutable snapshots for issued commercial documents and posted accounting/stock movements.
- Support corrections through revisions, credit notes, reversals or compensating entries rather than silently rewriting history.
- Provide safe archive/restore and retention rules.
- Add global and per-record audit history with permission checks and exportable evidence for authorized administrators.
- Ensure backup/restore preserves IDs, relations, audit records, generated documents, uploaded files, photos and numbering state.

### 13.8 Reporting, dashboards and management outputs

- Provide polished, filterable reports with date range, project, customer, supplier, status and other relevant dimensions.
- Support printable PDF and structured export where useful.
- Include project profitability, planned vs actual cost, cash flow, customer receivables, supplier payables, tax summaries, payroll totals, stock valuation, purchasing, fleet costs, equipment utilization, subcontractor costs, quality and HSE indicators.
- Show formula definitions and source records for important totals. Avoid double counting and distinguish invoiced, certified, collected, committed and paid values.
- Allow authorized users to save report filters and generate period snapshots.
- Add charts only where they improve decisions; all charts must have accessible tabular detail and consistent filters.

### 13.9 Practical quality-of-life features

Evaluate and implement where they improve real workflows:
- Global quick-create menu and keyboard shortcuts.
- Recent records and favorites, per-user.
- Bulk import with preview, validation and downloadable error report.
- Bulk export and bulk actions with permission checks and confirmation.
- Duplicate/clone a project, quotation, task template or recurring setup without copying unique financial postings or audit history.
- Reusable document, BOQ, task, inspection and report templates.
- Configurable numbering series and document prefixes.
- Configurable company settings, tax rules and approval thresholds with effective dates and audit history.
- Notifications and reminders with read/unread state, priority and links to the source record.
- Data quality checks for missing company details, duplicate contacts, incomplete projects, unmatched payments and invalid relationships.
- Safe data portability: full company backup, verified restore, and structured export of company-owned records and attachments.
- Clear application health/status page showing database, backup age, storage usage, app version and diagnostic export without leaking secrets.

### 13.10 Data safety and migration during the transformation

The product transformation must never be used as an excuse to discard existing data or rewrite history.

- Inventory all existing tables, fields, relations, files, migrations, APIs and business workflows before redesigning a module.
- Map old records to the new model and document every transformation.
- Prefer expand-and-contract migrations, compatibility adapters and staged rollout.
- Test upgrades using copies of representative real-version databases, including large datasets and attachments.
- Verify row counts, key relationships, balances, numbering sequences, audit history and file checksums before and after migration.
- Keep a tested backup and recovery path before migration.
- Do not silently drop, truncate, reset or reseed company data.
- If a clean installation experience is desired, provide it as a separate first-run path; it must not overwrite an existing company database.
- Maintain a clear migration report and recovery instructions.

**Exit criteria for this product transformation:** the redesigned application has a coherent end-to-end experience across all modules; company identity is reused correctly; professional documents can be created, issued, stored, downloaded and printed; images and attachments remain linked and backed up; all important records are searchable and auditable; all existing company data survives supported upgrades; and the complete workflow passes role-based, offline, performance, migration and Windows packaged tests.

## 14. Explicit product vision and acceptance principle

The final IDEAL must feel like one integrated professional business system—not a collection of disconnected CRUD pages. A user should be able to manage a company from its profile and contacts through projects, estimates, contracts, site execution, purchasing, stock, workforce, fleet, subcontractors, invoices, payments, accounting, reports and archive without losing context or re-entering the same information unnecessarily.

For every major workflow, the agent must demonstrate the complete journey with realistic synthetic data in the isolated test company, including document preview, PDF generation, archive retrieval, download and print layout. Screenshots or test artifacts should be attached to relevant PRs when they help verify visual quality. Never use real customer or employee personal data in test artifacts.

The owner values a substantial, complete, durable product over superficial feature counts. Prioritize correctness, data integrity, clarity, professional output and long-term maintainability. Do not claim completion based on mockups, static pages or buttons that do not perform the advertised action.


## 15. Locked visual direction, color tokens, interaction rules and functional reliability

This section makes the design direction explicit so the implementation agent cannot interpret “blue and white” loosely or redesign only a few pages.

### 15.1 IDEAL brand palette

Use this as the initial canonical light-theme palette. Define these as centralized design tokens/CSS variables and use them consistently. Do not scatter literal color values across components.

| Token | Color | Purpose |
|---|---|---|
| Brand navy | `#12304A` | Logo/nav structure, headings and strong brand surfaces |
| Primary blue | `#2563EB` | Primary buttons, active navigation, links and key focus accents |
| Primary hover | `#1D4ED8` | Hover/pressed primary action |
| Pale blue | `#EFF6FF` | Selected rows, soft highlights and information surfaces |
| App background | `#F4F7FB` | Main workspace background |
| Surface white | `#FFFFFF` | Forms, cards, dialogs and document surfaces |
| Main text | `#172B4D` | Primary readable text |
| Secondary text | `#64748B` | Helper text and metadata |
| Border | `#DCE4EE` | Dividers, input borders and table boundaries |

Semantic status colors must be restrained and consistent: success green, warning amber, danger red and informational blue. Always pair a semantic color with a French text label and/or recognizable icon; never communicate status through color alone. Validate WCAG contrast for text and controls, and adjust a token only with documented accessibility evidence. The palette above is the starting specification; do not substitute teal/turquoise as the primary brand.

The product should feel calm, modern, trustworthy and professional for BTP management. Use light theme by default. Dark mode is optional and must not be shipped as a half-themed collection of screens.

### 15.2 Logo and brand application

- Create a distinctive IDEAL logo system using the approved blue/white identity; provide full wordmark and compact application icon.
- Use the same identity in login/setup, application shell, sidebar, splash/loading, company settings, generated documents, PDF exports and installer/app metadata where supported.
- Do not use the current temporary “ID in a square” mark as the final identity unless it is deliberately redesigned and approved through the Visual Identity Studio.
- Allow the company to configure its own legal/commercial identity separately from the IDEAL software brand. Never confuse the software vendor identity with the customer's company identity.
- Provide preview and safe rollback for logo/brand asset changes.

### 15.3 Button and control contract

Every button/control must have a defined, tested action and state.

- One clear primary action per page/major workflow when permitted; secondary actions are visually quieter.
- Standardize button height, padding, radius, typography, icon placement and focus/hover/pressed/disabled/loading states.
- Use explicit French labels for important actions: `Nouveau`, `Enregistrer`, `Modifier`, `Annuler`, `Valider`, `Archiver`, `Restaurer`, `Télécharger`, `Imprimer`, etc., according to context.
- Use icon-only actions only for universally recognizable actions, with accessible labels/tooltips.
- Destructive actions such as delete/permanent removal require a clear confirmation, explain the impact, and use archive/soft-delete by default where possible.
- Do not show buttons a role cannot use. Enforce permissions again on the server.
- Disable duplicate submissions while an operation is in progress; use idempotency for sensitive operations.
- On success, show a clear French confirmation and refresh the affected view from persisted server data.
- On failure, preserve entered data, show a useful French error message, identify recoverable next steps and never display a false success state.
- Do not leave decorative, placeholder, dead or unimplemented buttons in production UI.

### 15.4 Required behavior for every module

For each entity/module, implement and test the applicable lifecycle:
1. Create a record with required-field validation.
2. Open and view its full details.
3. Edit permitted fields and preserve data on validation/network/database errors.
4. Search, filter, sort and paginate without leaking unauthorized records.
5. Link/unlink related records with referential integrity.
6. Attach, preview, download and archive relevant documents/photos.
7. Approve/reject/issue/post only when the role and business state allow it.
8. Print/export a correct document/report when applicable.
9. Archive/restore or cancel/reverse safely; do not silently delete posted history.
10. Inspect the activity/audit timeline and verify who changed what and when.

Not every entity needs every action, but each omission must be intentional and documented. A button existing in the UI is not evidence that its workflow works.

### 15.5 Error prevention, recovery and reliability

The app must be designed to prevent common user errors and recover safely from expected failures.

- Validate required fields, formats, dates, numeric ranges, references, totals and state transitions both client-side and server-side.
- Show field-level French validation and a clear summary for multi-field errors.
- Protect against duplicate clicks, duplicate requests, duplicate document numbers, duplicate payments/postings and stale concurrent edits.
- Use database transactions for multi-record operations. If any step fails, do not leave partial financial, inventory or document state.
- Handle missing files, unavailable printer, disk full, permission denied, corrupt attachment, failed export, failed backup, interrupted update and database busy errors without crashing or losing unrelated work.
- Preserve unsaved form values when safe; warn before navigation that would discard them.
- Provide retry only when the operation is safe/idempotent; otherwise explain how to verify the current status before retrying.
- Never swallow errors silently or log success before the database transaction commits.
- Add structured, privacy-safe diagnostics with no passwords, secrets, full bank details or unnecessary personal data.
- Provide a visible application health/backup status and clear recovery instructions.

### 15.6 Mandatory visual and functional acceptance

Before a module or redesign phase is accepted:
- Review every page, modal, drawer, table action, toolbar, keyboard shortcut and role state.
- Test primary/secondary/destructive actions with both allowed and denied roles.
- Test success, validation failure, server failure, duplicate submission, stale data, empty list, large list and offline/restart scenarios as applicable.
- Confirm all UI strings are French and all money values use the correct DZD formatting.
- Confirm the chosen brand tokens are used consistently and no legacy teal/turquoise primary theme remains.
- Check text contrast, focus visibility, keyboard navigation, reduced motion and print styles.
- Capture before/after screenshots for representative pages and attach visual evidence to the PR.
- Run regression tests after redesigning shared components; visual changes must not break calculations, permissions or persistence.
- Do not mark a page complete until the real action has been executed against the test database and its persisted result verified.

**Visual/functional exit gate:** every module uses the canonical blue/white system; every visible control has a real, permission-checked behavior; success and error states are clear; data remains correct after restart; and the full role-based regression suite passes.
