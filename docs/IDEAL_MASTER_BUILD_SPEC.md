# IDEAL — Master Product, Architecture & Execution Specification

**Document type:** Authoritative product and engineering specification  
**Project:** IDEAL — Specialized Algerian Construction ERP  
**Repository:** \`lunderclub9-gif/Ideal\`  
**Primary branch at specification time:** \`main\`  
**Working branch for this document:** \`docs/ideal-master-build-spec\`  
**Baseline commit:** \`1d4015df8f30b3ac840d0d9e80151072f675d22d\`  
**Audience:** Autonomous coding agents, software engineers, QA agents, maintainers  
**Language of this specification:** English (to make implementation instructions unambiguous for coding agents)  
**User-facing application language:** French only, unless the product owner explicitly changes this requirement  
**Status:** Product target and execution contract; NOT proof that every listed feature already exists.

---

## 0. Mission — read this first

Build and continuously improve **IDEAL**, a reliable, professional, offline-first Windows desktop ERP designed primarily for Algerian construction, building, and public-works companies (BTP).

IDEAL must help a real company manage its entire operating lifecycle in one coherent application:

- Company setup, users, roles, permissions, and audit history.
- Customers, suppliers, employees, subcontractors, projects, sites, contracts, and amendments.
- Estimates, quotations, bills of quantities, work packages, schedules, progress, and project costs.
- Attendance, payroll preparation, workforce allocation, and labour cost.
- Procurement, receipts, warehouses, stock movements, site consumption, and equipment.
- Vehicles, machinery, fuel, maintenance, and operating costs.
- Invoices, credit notes, payments, receivables, payables, cash, banks, expenses, and financial reports.
- Quality, safety, incidents, inspections, non-conformities, and corrective actions.
- Documents, attachments, printable forms, PDF/Excel exports, backups, restore, updates, and lifecycle controls.
- Global search, notifications, dashboards, analytics, and operational reports.

The goal is not to add a large number of disconnected screens. The goal is to make every module part of a consistent, traceable business system. A visible button is not a completed feature. Every action must work end-to-end, respect permissions, validate data, persist correctly, provide feedback, and be covered by tests.

**The agent must inspect the current repository before changing code.** Preserve and improve existing functionality. Do not replace the project with another ERP or rewrite it from scratch.

## 1. Product identity and non-negotiable constraints

### 1.1 Product positioning

**IDEAL — Specialized Construction ERP for Algeria.**

It is a focused ERP for BTP companies, not a generic accounting package and not a cloud SaaS product. Its workflows must reflect how a construction company operates: contract → estimate/BOQ → project → work packages → labour/material/equipment → progress measurement → client billing → payments → project profitability.

### 1.2 Deployment and resource constraints

These requirements are mandatory:

1. Windows desktop application, distributed as a Windows x64 installer.
2. Local-first and fully usable offline after installation.
3. SQLite remains the local database unless a documented, measured technical blocker proves otherwise and the owner approves a change.
4. Electron remains the desktop shell; React + TypeScript remain the UI foundation; Express + TypeScript remain the local backend unless the current code proves a safe, necessary change.
5. The local server must bind only to loopback (127.0.0.1), never expose the company database to the LAN by default.
6. Target modest computers, including 4 GB RAM. Avoid heavyweight services, containers, background workers, excessive animation, and unnecessary dependencies.
7. No mandatory paid service, subscription, cloud database, cloud storage, AI API, telemetry service, or external account.
8. No mandatory internet connection for ordinary business operations. Internet may be used for optional update downloads only.
9. Keep all company data, documents, and backups under a clearly defined user-controlled local data directory.
10. The application must remain usable when disconnected from the internet.

### 1.3 User interface language and regional defaults

- French is the single language of the application interface.
- Translate every visible UI string: navigation, headings, forms, validation, tooltips, notifications, empty states, confirmation dialogs, loading states, updater, errors, exports, and print labels.
- Do not translate or erase user-entered business data, names, notes, filenames, or historical records.
- Default currency: DZD (Algerian dinar).
- Use local date/time consistently; store timestamps in a documented canonical format and display them in the user's local timezone.
- Use French number/date formatting and clear DZD formatting.
- Do not hard-code legal tax, payroll, or social-contribution rates as if they were guaranteed current law.

### 1.4 Integrity principles

- Existing company data is more important than convenience or speed.
- Never silently delete, truncate, reset, or overwrite production data.
- Never seed demo records into a real company database.
- Use additive, versioned, reversible database migrations whenever possible.
- Prefer archive/deactivate/status transitions over physical deletion.
- Financial operations must be traceable and safely reversible through cancellation/reversal entries, not by silently rewriting history.
- Every important change must record actor, timestamp, entity, action, and relevant before/after values where appropriate.
- Do not claim a feature is complete unless the UI, API, database, permissions, error handling, and tests all support it.

---

## 2. Repository baseline and source-of-truth rules

The baseline repository inspected for this specification contains, among other items:

- \`src/App.tsx\`, \`src/pages/\`, \`src/components/\`, \`src/lib/\`
- \`server.ts\`, \`server/auth.ts\`, \`server/backup.ts\`, \`server/calculations.ts\`, \`server/db.ts\`, \`server/lifecycle.ts\`, \`server/routes.ts\`
- \`electron/main.cjs\`
- \`scripts/\`, \`e2e/\`, \`.github/workflows/\`
- \`docs/ROADMAP_GESTIONPRO_DZ.md\`, phase status documents, and simulation/testing documentation.

The inspected UI already includes pages for several existing domains, including dashboard, login, administration, attendance, clients, debts, fleet, invoices, lifecycle, materials, payroll, and projects. The repository also documents suppliers, employees, stock, purchasing, treasury, documents, reports, backups, and permissions. **These observations are a starting map, not a complete code audit.**

The inspected package manifest identifies the current stack as React 19, TypeScript, Vite, Tailwind CSS 4, Express 4, SQLite through better-sqlite3, Electron, and related libraries. Confirm exact versions and scripts from the checked-out branch before running commands.

### 2.1 Resolve documentation conflicts

Some repository documents may describe earlier names, versions, release states, scripts, or feature status. Before implementation:

1. Inspect the current branch and commit.
2. Read \`package.json\`, lockfiles, TypeScript/Vite/Electron configuration, workflow files, and actual source.
3. Inspect current migrations and database schema.
4. Inspect current routes, permission checks, and UI navigation.
5. Inspect tests and CI results.
6. Compare documentation against source and mark outdated claims.
7. Never copy an old command, release filename, branch name, or version without checking it.

Use this evidence hierarchy:

1. Current checked-out source code and database migrations.
2. Current tests and CI configuration/results.
3. Current package/configuration files.
4. Current documentation that agrees with source.
5. Historical status documents and old README statements.

When evidence is incomplete, write **“not verified”** rather than assuming a feature exists or is missing.

### 2.2 Required initial audit

Before coding, create or update an implementation matrix with these statuses:

- **Implemented and verified:** full workflow and tests confirmed.
- **Implemented, not fully verified:** code exists but important paths/tests are missing.
- **Partial:** some layers exist, others are incomplete.
- **Missing:** no implementation found after searching UI, API, schema, and tests.
- **Blocked / needs owner decision:** legal, accounting, security, or product decision required.

For every feature, record:
- Current UI page/component.
- Current API route and permission.
- Current database table/columns/relationships.
- Existing tests and their coverage.
- Gaps and risks.
- Proposed implementation files and migration.
- Acceptance tests required.

Do not create duplicate pages, tables, APIs, or overlapping calculations when an existing implementation can be safely extended.

---

## 3. Core modules and target capabilities

The sections below define the product target. They do not assert that every capability is already present. The agent must audit first and implement only what is missing or incomplete.

### 3.1 Company setup and administration

Provide a controlled first-run setup and company profile:

- Legal/company name, trade name, legal form, registration identifiers, address, phone, email, logo, stamp, and document header/footer details.
- Configurable fiscal year and local settings.
- User accounts, roles, granular permissions, password changes, session management, and account status.
- Role templates for owner/admin, accountant, project/site manager, storekeeper, HR/payroll, driver/equipment operator, and read-only auditor.
- Allow custom roles/permission assignment where safe.
- Audit log with filtering by user, module, action, date, and record.
- Configuration history for sensitive settings.
- Safe first administrator setup; never ship a universal default password.

### 3.2 Customers and CRM

Customer records should support:

- Individual/company identity and contact details.
- Registration and billing information.
- Multiple contacts and addresses where useful.
- Customer category, status, notes, and attached documents.
- Linked projects, contracts, quotations, invoices, payments, outstanding balances, and correspondence notes.
- Search by name, code, phone, email, identifier, and status.
- Duplicate detection with safe merge workflow; never auto-merge records without review.
- Customer statement and printable account history.

### 3.3 Suppliers and subcontractors

Supplier records should support:

- Legal identity, contacts, addresses, payment terms, bank/payment details where required, tax identifiers, and documents.
- Supplier categories and status.
- Linked purchase requests/orders, receipts, invoices, payments, credit notes, debts, and statements.
- Subcontractor profile, specialties, insurance/qualification documents, contract history, assigned projects, measured work, certificates, retentions, advances, and payments.
- Expiry reminders for configurable documents.
- Search and duplicate detection.

### 3.4 Projects, sites, contracts, and amendments

Project/site management is the operational center:

- Unique project code, title, customer, location, project manager, site manager, dates, status, description, and contract value.
- Multiple sites/locations under a project when needed.
- Contract records: reference, signed date, start/end dates, amount, payment terms, retention settings, guarantees, and attachments.
- Contract amendments/change orders with version, reason, amount delta, date, approval, and impact on budget and schedule.
- Project lifecycle states such as draft, awarded, active, suspended, completed, archived.
- Project overview with financial, schedule, labour, material, equipment, procurement, document, and safety indicators.
- Project-level activity history.
- No deletion of a project with linked financial or operational records; use archive and lifecycle rules.

### 3.5 BOQ, estimates, rate analysis, and quotations

Build a proper construction estimating workflow:

- Bill of Quantities (BOQ) with sections, items, item codes, descriptions, units, quantities, unit prices, totals, and revision history.
- Configurable units: m, m², m³, kg, tonne, unit, day, hour, lump sum, and custom units.
- Cost breakdown per work item: materials, labour, equipment, subcontracting, transport, overhead, and margin.
- Rate analysis with editable resource quantities and unit costs.
- Estimate versions and comparison between revisions.
- Link estimates to quotations, contracts, budgets, and project cost codes.
- Quotation workflow: draft → review → approved → sent/printed → accepted/rejected/expired.
- Quote conversion to project/contract without duplicating or losing line-item detail.
- Configurable taxes and discounts, calculated server-side.
- Printable professional French documents with company branding and page numbering.
- Prevent negative quantities/prices unless a specific credit/adjustment workflow explicitly permits them.
- Use decimal-safe calculations; avoid floating-point money errors.

### 3.6 Work breakdown structure, planning, and scheduling

Support a structured project plan:

- Work Breakdown Structure (WBS): phases, activities, work packages, tasks, and subtasks.
- Task owner, planned start/end, actual start/end, duration, priority, status, progress, predecessor/dependency, and notes.
- Gantt timeline with clear dependencies and milestone markers.
- Baseline schedule and revised schedule history.
- Delay reasons, blockers, responsible person, and corrective actions.
- Planned vs actual progress and cost.
- Calendar/list/board views as useful, without duplicating the underlying task records.
- Critical date warnings and overdue filters.
- Ensure date and dependency validation prevents impossible cycles.

### 3.7 Daily site operations and field reports

A site manager should be able to record:

- Daily site report by project/site/date/shift.
- Weather and site conditions when useful.
- Workers present, hours, tasks, and subcontractor teams.
- Materials received, consumed, transferred, or missing.
- Equipment used, operating hours, downtime, and fuel.
- Work completed and quantities achieved by BOQ/work-package item.
- Photos and attachments with timestamp and linked project/task.
- Delays, obstacles, incidents, instructions, and decisions.
- Draft → submitted → reviewed/approved workflow with reviewer and timestamps.
- Corrections must preserve previous approved versions in history.
- Offline capture must work locally. If future multi-device synchronization is introduced, define conflict handling explicitly; do not silently overwrite records.

### 3.8 Progress measurement and client billing

Support measured work and payment certification:

- Record measured quantities by BOQ line and period.
- Compare cumulative previous quantity, current-period quantity, and cumulative total.
- Enforce contract/BOQ limits with explicit approved variation handling.
- Generate progress statements and Interim Payment Certificates (IPC) or equivalent progress certificates.
- Track advances, deductions, retention, taxes, and net payable using configurable rules.
- Link certificates to invoices and payments.
- Track review, approval, issue, correction, and cancellation history.
- Never invent legal retention or tax rates. Make rules configurable and require professional validation.

### 3.9 Workforce, attendance, HR, and payroll preparation

Preserve existing workforce and payroll features while strengthening them:

- Employee profile, job, contact details, hire/exit dates, status, compensation type, rate, work schedule, documents, and notes.
- Employee statuses: active, suspended, leave, and exited; preserve historical records.
- Assign employees to projects, sites, tasks, and supervisors.
- Attendance by date/site/shift with present, absent, half-day, paid/unpaid leave, sickness, public holiday, overtime, and correction reason.
- Approval workflow for attendance.
- Prevent invalid dates, duplicate attendance, negative hours, and edits to locked payroll periods unless an authorized correction/reopen flow exists.
- Payroll periods, earnings, deductions, advances, payslips, approval, payment status, and locked history.
- Configurable formulas and rates with effective dates and change logs.
- Payroll calculations must be server-side and reproducible from saved inputs.
- Separate payroll preparation from actual payment recording.
- Do not claim compliance with Algerian labour, tax, or CNAS rules without up-to-date official validation by a qualified professional.

### 3.10 Procurement and purchasing

Provide a traceable purchasing cycle:

- Internal purchase request with requester, project/site, needed-by date, items, quantities, reason, and approval status.
- Supplier quotation comparison where useful.
- Purchase order with supplier, lines, price, delivery terms, tax, and project allocation.
- Approval thresholds configurable by company.
- Partial/full goods receipt and discrepancy reporting.
- Supplier invoice matching against order and receipt.
- Payment status and linked treasury movement.
- Returns, cancellations, and supplier credit notes with traceable reversal.
- Prevent duplicate supplier invoice references where possible.
- Do not count an unapproved internal request as a supplier debt.

### 3.11 Inventory, warehouses, and material control

Use a stock movement ledger as the source of truth:

- Multiple warehouses and site stores.
- Item catalog with code, name, category, unit, description, minimum level, preferred supplier, and optional barcode/QR.
- Opening balance through a controlled opening-stock operation.
- Receipts, issues, returns, transfers, adjustments, reservations, and project/site consumption.
- Every movement records item, quantity, source/destination, date, actor, reference document, and reason.
- Current stock is derived from validated movements, not freely overwritten in a profile form.
- Project/site material reservations and allocations.
- Low-stock alerts, stock valuation method configured by the company/accountant, and stocktake reconciliation.
- Prevent negative stock by default; allow an explicit, permission-controlled exception only if business policy requires it.
- Traceability from purchase order → receipt → warehouse → site issue → project cost.
- Barcode/QR scanning may be added as an optional workflow, but keyboard/manual search must remain available.

### 3.12 Equipment, vehicles, fleet, and maintenance

Support owned and rented assets:

- Asset identity, type, plate/serial number, ownership/rental status, supplier, project assignment, operator, documents, and status.
- Meter readings (kilometres/hours), fuel logs, usage logs, operating cost, and downtime.
- Preventive maintenance by date, mileage, operating hours, or configurable interval.
- Repair orders, work performed, spare parts, external provider, cost, and downtime.
- Insurance, inspection, registration, and document expiry reminders.
- Equipment assignment and return with condition notes.
- Cost allocation to project/site and comparison of owned vs rented equipment.
- Alerts for upcoming maintenance and expired documents.
- Preserve maintenance and usage history.

### 3.13 Finance, treasury, receivables, and payables

Provide a consistent financial model:

- Cash boxes and bank accounts.
- Receipts, payments, internal transfers, expenses, refunds, and cash closing.
- Customer receivables and supplier payables linked to source documents.
- Employee advances and recoveries linked to attendance/payroll where appropriate.
- Payment methods, references, dates, counterparties, and attachments.
- Partial payments and outstanding balances.
- Reconciliation of bank/cash movements against statements.
- Reversal/cancellation entries with reason and actor.
- Prevent duplicate payment posting and double counting.
- Aging reports and due-date reminders.
- Financial totals must reconcile across invoices, credit notes, payments, cash, banks, and debt screens.

**Accounting architecture target:** evaluate and implement a proper double-entry ledger if the current accounting implementation is not sufficient. Do not bolt on a second conflicting source of financial truth. Define chart of accounts, journal entries, debit/credit balance validation, posting periods, reversals, and trial balance before introducing general-ledger screens. Migrate existing data additively and reconcile opening balances. Do not pretend a list of cash movements is a complete double-entry accounting system.

### 3.14 Taxes, payroll contributions, and Algerian localization

- Provide configurable tax/contribution rules with effective dates, categories, and calculation basis.
- Keep rates, exemptions, rounding, and thresholds outside hard-coded UI logic.
- Record which rule/version was used for each issued document or payroll calculation.
- Allow an authorized accountant to configure rates.
- Provide a visible “requires professional validation” warning for unverified rules.
- Never invent current Algerian VAT, IBS, IRG, CNAS, CASNOS, withholding, labour, or accounting requirements.
- If a legal change is requested, verify it against current official Algerian sources and document the source/date; otherwise leave the rule configurable and request professional review.
- Preserve historic documents and calculations when rates change.

### 3.15 Quality, HSE, inspections, and non-conformities

Add a practical quality and safety workflow:

- Site safety checklist templates.
- Equipment pre-use inspection.
- Risk register with likelihood, impact, mitigation, owner, and status.
- Incident and near-miss reports.
- Injury/damage details with strict permission controls for sensitive records.
- Quality inspections by work package/BOQ item.
- Defect and non-conformance report (NCR), evidence, responsible party, due date, corrective action, verification, and closure.
- Inspection approvals and document attachments.
- Safety toolbox talks and attendance record.
- Alerts for overdue corrective actions.
- Reports by project, category, severity, status, and date.
- Keep personal/sensitive data access limited to authorized roles.

### 3.16 Document management and records

- Central document register with categories, title, reference, issue date, expiry date, linked entity, tags, notes, and uploader.
- Attach documents to company, employee, customer, supplier, subcontractor, project, contract, purchase, invoice, equipment, quality, or safety records.
- Preserve original file bytes when editing metadata.
- Version documents when replacement is an intentional, audited operation.
- Logical archive and restore; no silent physical deletion.
- Search by title, filename, category, reference, linked record, tags, and date.
- Secure file path handling; never trust a user-supplied path.
- Preview/download with correct permission checks.
- PDF and Office attachments where supported by the existing local stack.
- Retention and backup coverage for all attachments.

### 3.17 Reports, analytics, and dashboards

Dashboards must use real database values, not mock values:

- Company overview: active projects, outstanding receivables/payables, cash/bank balances, workforce, stock alerts, equipment alerts.
- Project profitability: contract value, approved variations, invoiced, collected, committed cost, actual cost, forecast cost, margin.
- Budget vs actual by project, phase, cost code, and period.
- Planned vs actual progress.
- Labour hours and cost by project/site/task.
- Material consumption and variance.
- Equipment utilization, fuel, maintenance, and cost.
- Supplier performance and purchasing lead times.
- Customer aging and supplier aging.
- Payroll totals and employee advances, restricted by permission.
- Safety/quality KPIs.
- Date, project, site, customer, supplier, and status filters.
- Export to Excel and print/PDF with consistent totals and clear “as of” date.
- Explain calculation definitions in report help or documentation.

### 3.18 Notifications and reminders

Provide an in-app notification center for actionable events:

- Overdue invoices and payments.
- Purchase requests awaiting approval.
- Low stock.
- Maintenance due.
- Document expiry.
- Task/project deadline and delay.
- Payroll period pending approval.
- Safety corrective action overdue.
- Backup status and update availability.
- Each notification links to the relevant record, respects permissions, can be marked read, and avoids duplicate spam.
- Notifications must work offline based on local data and local time.

### 3.19 Global search and navigation

A complete ERP must be easy to navigate:

- Global search across entities the current user is allowed to view: clients, suppliers, employees, projects, contracts, invoices, payments, materials, purchase orders, documents, equipment, and tasks.
- Search by human-readable name, code, reference, phone/email, invoice number, and relevant identifiers.
- Results grouped by entity type with clear labels and a direct “open record” action.
- Debounced search, loading state, empty state, error state, and keyboard navigation.
- Do not leak records through search if the user lacks read permission.
- Each module list should also have contextual search, filters, sorting, pagination or efficient incremental loading, and reset filters.
- Preserve the current navigation search if it exists; distinguish “search navigation menu” from “search business records”.
- Add breadcrumbs, active navigation state, consistent page titles, and useful back navigation.

---

## 4. Universal interaction contract — no dead buttons

This section is mandatory for every screen and every new or existing action.

### 4.1 Every visible control must have a real behavior

For every button, link, icon button, menu item, row action, tab, filter, form, dropdown, checkbox, date picker, search field, and keyboard shortcut:

1. Identify the intended action.
2. Confirm the action is actually implemented.
3. Connect it to the correct UI state and API operation.
4. Enforce authorization on the server.
5. Validate inputs on the server, not only in the browser.
6. Persist changes in the database when appropriate.
7. Show loading/disabled state while an operation is running.
8. Prevent accidental double submission.
9. Show a clear French success or error message.
10. Refresh or update the affected data consistently.
11. Add tests for success, validation failure, unauthorized access, and server failure.

If a control is decorative or intentionally unavailable, label it clearly as disabled or remove it. Never leave a button that appears functional but does nothing.

### 4.2 CRUD and lifecycle consistency

For every business entity, define which actions are allowed:

- Create.
- View details.
- Edit.
- Archive/deactivate.
- Restore/reactivate where supported.
- Delete only when safe, permitted, and not linked to historical records.
- Print/export.
- Attach/view/download documents.
- View related records and activity history.

Do not expose all actions for every entity blindly. Apply lifecycle rules and permissions. For financially posted records, use cancellation/reversal rather than destructive edit/delete.

### 4.3 Forms

- Clear labels, required/optional markers, units, currency, date formats, and help text.
- Inline validation and a summary for long forms.
- Preserve user input when a recoverable API error occurs.
- Warn before discarding unsaved changes.
- Use sensible defaults without inventing business facts.
- Disable submit while saving and prevent duplicate submissions.
- Display server validation errors in French.
- Use accessible labels, keyboard navigation, focus states, and logical tab order.

### 4.4 Tables and lists

- Search, filters, sorting, pagination or efficient loading.
- Loading skeleton or status, empty state, error state, and retry.
- Clear row actions and consistent column alignment.
- DZD values formatted consistently.
- Date and status filters.
- Export only the rows the user is authorized to export.
- Avoid loading huge datasets into memory on 4 GB PCs.

### 4.5 Confirmations and feedback

Require confirmation for destructive or high-impact operations such as archive, restore, reverse payment, close cash, approve payroll, issue invoice, restore backup, or apply a migration. Explain what will happen.

Every async operation must provide:
- Idle state.
- Loading state.
- Success state.
- Validation/error state.
- Retry or recovery path where appropriate.

### 4.6 Accessibility and responsive behavior

- Keyboard-operable controls.
- Visible focus rings.
- Accessible names for icon-only buttons.
- Dialog semantics and focus management.
- Contrast and readable font sizes.
- Reduced-motion preference.
- Responsive layouts for small screens and window sizes.
- Avoid excessive motion, blur, shadows, and large images that harm performance.

---

## 5. Technical architecture and engineering rules

### 5.1 Architecture boundaries

Maintain clear separation:

- **React UI:** presentation, local interaction state, form state, client-side formatting.
- **API client layer:** typed requests, consistent error handling, session handling.
- **Express backend:** authorization, validation, business rules, transactions, file operations.
- **SQLite data layer:** schema, indexes, migrations, constraints, transactions.
- **Electron shell:** secure window configuration, lifecycle, local server startup/shutdown, update workflow, app data directory.

Do not place business calculations only in React. Critical calculations and permission checks belong on the server.

### 5.2 Database design

- Inspect existing schema before adding tables.
- Use stable primary keys and foreign keys.
- Add indexes for common search/filter/join fields.
- Use unique constraints for codes/references where appropriate.
- Add created_at/updated_at and actor fields where useful.
- Use explicit status fields and archive timestamps.
- Use transactions for multi-table business operations.
- Store money as integer minor units where currency precision permits, or use a well-defined decimal strategy; never rely on binary floating-point for financial totals.
- Store quantities/rates with an explicit precision policy.
- Use SQLite foreign keys and WAL settings only as appropriate to the current architecture.
- Ensure the database can be backed up safely while open.
- Document every migration and rollback/recovery implications.

### 5.3 API contract

For each endpoint:
- Define method, route, request schema, response schema, permissions, and error codes.
- Validate all input server-side.
- Use parameterized SQL.
- Use transactions for related writes.
- Avoid returning secrets, password hashes, or unauthorized fields.
- Use consistent HTTP status codes and safe error messages.
- Prevent mass assignment of protected fields.
- Add idempotency or duplicate protection to financial posting and other retry-prone operations.
- Do not place authentication tokens in URLs.
- Ensure document download endpoints enforce authorization and safe file resolution.

### 5.4 Security

- Password hashing using a strong, salted password-hashing method already supported by the project.
- Signed, expiring sessions; secure secret storage; safe logout and session invalidation.
- Rate limiting/lockout for repeated login failures.
- Server-side role and permission enforcement on every protected route.
- Input validation and output encoding.
- Protect against SQL injection, path traversal, unsafe uploads, ZIP bombs, malicious archives, and arbitrary file reads.
- Restrict upload size, allowed types, and storage paths.
- Electron context isolation and safe preload/API exposure; no unnecessary Node integration in renderer.
- Bind local server to 127.0.0.1 only.
- Do not log passwords, session tokens, sensitive personal information, or file contents.
- Security-sensitive changes require tests and a clear threat/risk note.

### 5.5 Backups, restore, migration, and data lifecycle

- Backup must include database and all linked documents.
- Include manifest, schema version, file inventory, sizes, and cryptographic hashes.
- Write to a temporary archive, verify it, then atomically publish.
- Restore must validate the entire archive before replacing active data.
- Reject path traversal, unexpected files, duplicate archive entries, missing files, hash mismatch, invalid SQLite DB, and unreasonable expansion size.
- Create a verified pre-restore safety backup.
- Restore transactionally or with a tested rollback plan for both DB and documents.
- Never delete the current data before the replacement is proven valid.
- Test failure injection at each restore stage.
- Migrations must be tested against a copy of a realistic older database, not only an empty database.
- Lifecycle/archive/purge actions must honor retention, legal holds, dependencies, and user confirmation.
- Do not auto-purge financial or legal records merely to save space.

### 5.6 Performance for 4 GB RAM

- Measure startup, idle memory, navigation, search, large tables, reports, and backup on a modest Windows machine or CI approximation.
- Use pagination and indexed queries.
- Avoid repeated full-table reads and unnecessary React re-renders.
- Lazy-load heavy pages and large report modules where beneficial.
- Keep images/files out of memory when not needed.
- Avoid heavy charting or visualization dependencies unless justified.
- Do not add Redis, Docker, database servers, or background services.
- Add performance budgets and record measurements rather than claiming “lightweight” without evidence.

### 5.7 Dependencies and licenses

- Prefer the existing dependency set.
- Add a dependency only when it solves a documented need and is compatible with offline Windows packaging and 4 GB RAM.
- Check maintenance status, license, native binary support, bundle size, and security advisories.
- Do not copy code from external ERP projects without checking license obligations and attribution.
- Reusing general ideas or workflows is not the same as copying source code.
- Avoid AGPL/GPL code integration without explicit license review and owner approval.

---

## 6. Suggested delivery phases

The agent must adjust these phases after auditing the actual code. Do not rebuild a phase that is already implemented and verified.

### Phase 0 — Repository audit and safe baseline

- Confirm branch and clean working tree.
- Read all relevant docs, source, schema, migrations, workflows, and tests.
- Build the module/feature matrix.
- Identify documentation drift.
- Run existing tests and record baseline failures.
- Create a backup of any test database.
- Produce a risk list and implementation order.
- No feature coding until the baseline is understood.

**Exit gate:** an evidence-based gap matrix and a reproducible baseline report.

### Phase 1 — Stability, security, and data protection

- Resolve critical startup/auth/permission/data-loss risks.
- Validate backup/restore and rollback.
- Validate migrations against realistic legacy DB copies.
- Fix high-risk file handling and token exposure.
- Improve CI coverage and isolated test data.
- Verify installer and update behavior.

**Exit gate:** no known critical data-loss/security defect; required protection tests pass.

### Phase 2 — Construction project controls

- BOQ and estimate/rate analysis.
- Contract revisions and change orders.
- Cost codes and WBS.
- Project budget and baseline schedule.
- Gantt and dependency validation.
- Planned vs actual progress and cost.

**Exit gate:** one complete project workflow from estimate to approved progress and cost report.

### Phase 3 — Field execution and subcontractors

- Daily site reports.
- Labour/material/equipment usage.
- Photo/document evidence.
- Subcontractor contracts and measured work.
- Progress certificates, advances, deductions, and retentions.
- Approval history.

**Exit gate:** complete site-period report and certified work linked to project records.

### Phase 4 — Finance and accounting integrity

- Reconcile current financial flows.
- Define ledger strategy and chart of accounts if needed.
- Receivables/payables, cash/bank, payments, reversals, reconciliation.
- Link invoices, procurement, payroll, and project cost.
- Audit reports and aging.

**Exit gate:** sample transactions reconcile across source documents, ledger, cash/bank, and reports.

### Phase 5 — Inventory, procurement, and fleet

- Purchasing workflow.
- Warehouse/stock movement ledger.
- Site transfers and consumption.
- Barcode/QR optional flow.
- Equipment/fleet usage, fuel, repair, maintenance, and cost allocation.

**Exit gate:** trace a material from purchase through receipt, warehouse, site issue, and project cost; trace equipment use and cost to a project.

### Phase 6 — Quality, HSE, documents, and notifications

- Inspection, incident, NCR, corrective action, and safety checklists.
- Document versions, search, expiry alerts, and links.
- In-app notifications and reminders.
- PDF/Excel templates and reports.

**Exit gate:** complete a quality/safety/document workflow with role restrictions and audit history.

### Phase 7 — UX consistency and global search

- Audit every page, button, icon, link, form, tab, filter, and menu.
- Implement global search and module-specific search.
- Harmonize CRUD actions, tables, dialogs, feedback, accessibility, French UI, and responsive layout.
- Remove dead controls and duplicate navigation.
- Verify all modules with multiple roles.

**Exit gate:** no known dead visible controls; all core workflows are navigable and tested.

### Phase 8 — Full-company simulation and Windows release

- Run isolated end-to-end company simulation with synthetic data only.
- Test every major role.
- Test migration from supported older DB snapshots.
- Test backup, restore, restart, update, uninstall/reinstall, and data retention.
- Build Windows x64 installer.
- Run packaged-app smoke tests.
- Produce release notes, checksums, and known limitations.
- Keep real user data untouched.

**Exit gate:** all mandatory tests pass, release artifact verified, known limitations documented, and owner explicitly approves release/merge.

---

## 7. Mandatory test strategy

Testing is part of implementation, not a final optional task.

### 7.1 Test layers

- Unit tests for calculations, validators, permissions, formatting, and state transitions.
- API integration tests with a temporary isolated SQLite database.
- Database migration tests from supported historical schemas.
- Component tests for forms, dialogs, filters, search, and table actions where practical.
- Playwright end-to-end tests for full workflows.
- Windows installer/package smoke tests.
- Manual acceptance checklist for real Windows UI and business scenarios.

### 7.2 Required workflow scenarios

At minimum, test these complete workflows:

1. First-run company setup → create administrator → login → logout → login.
2. Create customer → create project → add contract → add BOQ/estimate → create tasks.
3. Assign workers → record attendance → approve attendance → prepare payroll → lock payroll.
4. Create purchase request → approve → purchase order → receive materials → update stock.
5. Transfer material to site → record consumption → update project cost.
6. Assign equipment → record hours/fuel → maintenance → project cost.
7. Create quotation → approve → convert to invoice → partial payment → remaining balance.
8. Record supplier invoice → partial payment → reversal/correction → reconcile balance.
9. Create subcontractor measurement → certificate → retention/advance → payment.
10. Create daily site report → submit → approve → attach photos/documents.
11. Record quality defect or safety incident → corrective action → verification → closure.
12. Search globally for records with different user roles; confirm no permission leaks.
13. Export PDF/Excel and compare totals against source records.
14. Create backup → verify → restore to isolated directory → compare database and attachments.
15. Simulate failed restore/update/migration and confirm rollback.
16. Restart the packaged Windows application and confirm data persistence.
17. Run without internet and confirm all core workflows remain available.

### 7.3 Button and interaction audit tests

Create a screen/action inventory. For each visible action record:
- Page and control name.
- Intended behavior.
- Required permission.
- API route or local handler.
- Success test.
- Validation/error test.
- Unauthorized test.
- Loading/double-click test.

A feature is not complete if a visible action has no tested behavior.

### 7.4 Test-data isolation

- All simulations must use a unique temporary directory and temporary database.
- Set all supported data-directory environment variables consistently.
- Use a dedicated loopback port.
- Never point tests at the user's actual AppData directory or a production database.
- Clean up test data only after the test process has stopped.
- Never create synthetic customers, invoices, payroll, or stock movements in the real company database.

---

## 8. Definition of Done

A task/feature is complete only when all applicable criteria are met:

- [ ] Existing code and behavior were inspected before modification.
- [ ] No duplicate feature/table/route was created unnecessarily.
- [ ] UI exists and is connected to a real operation.
- [ ] All visible buttons and controls work.
- [ ] Search, filters, sorting, and pagination work where applicable.
- [ ] Server-side validation and permission checks exist.
- [ ] Database writes use safe transactions and constraints.
- [ ] Audit/history behavior is appropriate.
- [ ] Errors and success feedback are clear and in French.
- [ ] Loading and duplicate-submit states are handled.
- [ ] Related modules and reports remain consistent.
- [ ] Tests cover normal, invalid, unauthorized, and failure paths.
- [ ] Existing data is preserved; migrations are tested.
- [ ] Offline behavior is preserved.
- [ ] Windows build/package remains valid.
- [ ] Performance impact is acceptable for 4 GB RAM.
- [ ] Documentation and changelog are updated.
- [ ] Remaining limitations are stated honestly.

A passing TypeScript check or successful build alone does not prove that a business workflow works.

---

## 9. Agent operating instructions and safety contract

The autonomous coding agent must follow these rules for every session:

1. Start from the latest \`main\` unless the owner explicitly specifies another base.
2. Create a dedicated feature branch. Never make unreviewed changes directly on \`main\`.
3. Inspect git status, recent commits, open PRs, relevant branches, and current CI before editing.
4. Read this document completely, then read relevant existing docs and source.
5. Audit before implementation. Never assume the requested feature is absent.
6. Preserve all working functionality, existing data, and compatible user workflows.
7. Do not mass-rewrite the app, replace its framework, or import another ERP.
8. Do not delete files, tables, routes, UI pages, or data unless proven obsolete and the change is safe, tested, and documented.
9. Make small, coherent commits with descriptive messages.
10. Run the narrowest relevant tests after each change, then run the full required test suite.
11. If a test fails, investigate and fix the root cause; do not remove or weaken the test to get a green build.
12. Never bypass TypeScript, lint, security, or CI checks just to ship.
13. Never fabricate test results, screenshots, manual verification, performance measurements, legal compliance, or release status.
14. Never insert demo data into real company data.
15. Never publish a release, merge to \`main\`, force-push, rewrite history, or change repository settings without explicit owner authorization.
16. If a requirement conflicts with data safety, legal compliance, or the current architecture, stop that specific change, document the conflict, and choose the safest non-destructive path.
17. Do not ask the owner to make routine engineering decisions. Use the safest sensible implementation consistent with this specification. Ask only when a genuinely irreversible, legal, security-critical, or product-owner decision is required.
18. Do not stop after producing a plan if the task is to implement. Continue through code, tests, review, and documentation within the authorized branch.
19. At the end, report exact branch, commit(s), changed files, tests actually run and their results, remaining risks, and next action.
20. Keep the owner informed with concise progress summaries at meaningful milestones; do not claim completion while work remains.

### 9.1 Handling new ideas

The agent may discover useful improvements not explicitly listed here. It must:

- Evaluate whether the idea solves a real BTP workflow.
- Check whether a similar feature already exists.
- Explain expected benefit, complexity, data impact, offline impact, and performance impact.
- Add low-risk, high-value improvements that fit the mission.
- Record larger ideas in a “Proposed Improvements” section or separate proposal before implementing.
- Never add speculative features that create clutter, cost, privacy risk, or maintenance burden.
- Never add a paid/cloud dependency without explicit owner approval.

### 9.2 External reference projects

External ERP projects may be used as functional inspiration for workflows and domain modeling. Do not copy source code without reviewing the exact repository license and obligations. Prefer independent implementation using IDEAL's existing architecture. Record any borrowed code and required notices.

---

## 10. Required deliverables from the agent

For each major phase, produce:

1. **Audit report:** what existed, what was partial, what was missing, and evidence.
2. **Implementation matrix:** features, files, DB tables, routes, permissions, and tests.
3. **Implementation:** working end-to-end code, not mockups.
4. **Migration notes:** schema changes, compatibility, backup, and rollback.
5. **Test report:** exact commands and actual pass/fail results.
6. **UI/action audit:** all visible actions and search/filter behavior.
7. **Performance/security notes:** measured or inspected findings, not guesses.
8. **Updated documentation:** status, decisions, limitations, and recovery instructions.
9. **Branch/commit summary:** exact references and whether a PR was opened.
10. **Next-step list:** only the genuinely remaining work.

Maintain a living status table in the repository, preferably \`docs/IMPLEMENTATION_STATUS.md\`, with columns:

| Domain | Status | Evidence | Missing work | Tests | Risk |
|---|---|---|---|---|---|

Do not mark a row “complete” based only on a page or component existing.

---

## 11. Priority order

When time or context is limited, prioritize in this order:

**P0 — Protect the company**
- Data safety, backup/restore, migrations, login, permissions, financial integrity, file security, installer/update safety.

**P1 — Make current workflows reliable**
- Existing customer, project, employee, attendance, payroll, invoice, purchasing, stock, fleet, treasury, debt, document, and report workflows.
- Every visible button, search, filter, and form must work.

**P2 — Construction-specific depth**
- BOQ, rate analysis, WBS, schedule/Gantt, daily site reports, measured progress, subcontractor certificates, project cost control.

**P3 — Operational excellence**
- Inventory traceability, equipment utilization, quality/HSE, notifications, global search, dashboards, and richer exports.

**P4 — Advanced improvements**
- Forecasting, optional barcode/QR workflows, richer analytics, optional data exchange/import integrations, and carefully scoped extensions.

Do not build P3/P4 while P0 data-loss or security defects remain unresolved.

---

## 12. Compact execution prompt — copy this into the coding agent

You do not need to send the full product idea again. Give the agent this short instruction and point it to this file:

> Read \`docs/IDEAL_MASTER_BUILD_SPEC.md\` completely and treat it as the product and engineering contract for IDEAL. Work from the latest \`main\` in a new feature branch. First audit the actual source, database schema/migrations, routes, permissions, UI, tests, and CI; create an evidence-based gap matrix and identify documentation drift. Do not rebuild or duplicate existing features. Then implement the highest-priority missing/incomplete work end-to-end, preserving all existing functionality and real data. Every visible button, icon, link, form, search, filter, and menu action must work, enforce server-side permissions/validation, persist correctly, show French feedback, and have tests. Keep the current lightweight Windows/Electron + React/TypeScript + Express + SQLite architecture, offline-first operation, French-only UI, DZD localization, no mandatory paid/cloud/AI services, and 4 GB RAM target. Use additive migrations, isolated synthetic test data, safe backups/rollback, and never touch real user data. Run relevant tests after each change and the full suite before reporting. Continue implementation rather than stopping at a plan. Do not merge to main, force-push, publish a release, or perform destructive changes without explicit owner approval. Report exact branch, commits, files, tests/results, risks, and remaining work. If you discover a valuable new idea, evaluate it against this specification and add it only when it improves IDEAL without compromising safety, offline use, simplicity, or performance.

---

## 13. Final product acceptance vision

IDEAL is ready for a controlled company pilot only when a real BTP company can complete its everyday work in one connected application without relying on spreadsheets to bridge broken modules:

- Create a customer and contract.
- Estimate work through BOQ and rate analysis.
- Plan the project and assign teams.
- Record daily work, labour, materials, and equipment.
- Measure progress and prepare client billing.
- Purchase and receive materials, move them to sites, and track consumption.
- Manage subcontractors and certificates.
- Track invoices, payments, cash, banks, expenses, debts, and project profitability.
- Manage employee attendance and payroll preparation.
- Track quality, safety, documents, and maintenance.
- Find records quickly, print/export accurate documents, and understand dashboards.
- Back up, verify, restore, update, and restart without losing company data.
- Operate offline on a modest Windows computer.

The standard is **reliable connected workflows**, not a long feature checklist. Accuracy, traceability, data preservation, usability, and honest testing take priority over adding features quickly.
