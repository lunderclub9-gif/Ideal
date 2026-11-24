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

> Read \`docs/IDEAL_MASTER_BUILD_SPEC.md\` completely, including Sections 14, 15, and 16, and treat every section as the product and engineering contract for IDEAL. Work from the latest \`main\` in a new feature branch. First audit the actual source, database schema/migrations, routes, permissions, UI, tests, and CI; create an evidence-based gap matrix and identify documentation drift. Do not rebuild or duplicate existing features. Then implement the highest-priority missing/incomplete work end-to-end, preserving all existing functionality and real data. Every visible button, icon, link, form, search, filter, dashboard indicator, notification, and menu action must work, enforce server-side permissions/validation, persist correctly, show French feedback, and have tests. Implement the complete blue/white redesign and logo/interaction system (Section 14); implement Algerian SCF accounting, TVA, IBS, IRG, IFU, applicable taxes, payroll/social contributions, and BTP tax workflows from verified effective-dated official legal sources (Section 15); and implement operational intelligence, auditability, document control, resilience, reconciliation, and full-company acceptance workflows (Section 16). Never guess legal rates/deadlines or activate draft laws. Keep the current lightweight Windows/Electron + React/TypeScript + Express + SQLite architecture, offline-first operation, French-only UI, DZD localization, no mandatory paid/cloud/AI services, and 4 GB RAM target. Use additive migrations, isolated synthetic test data, safe backups/rollback, and never touch real user data. Run relevant tests after each change and the full scenario suite before reporting. Continue implementation rather than stopping at a plan. Do not merge to main, force-push, publish a release, or perform destructive changes without explicit owner approval. Report exact branch, commits, files, tests/results, legal-source versions/review status, risks, and remaining work. If you discover a valuable new idea, evaluate it against this specification and add it only when it improves IDEAL without compromising safety, offline use, simplicity, or performance.

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


---

## 14. Complete visual redesign, company branding, and interaction design

This is a first-class product requirement, not optional decoration. The agent must audit the current interface and then deliver a coherent, professional visual system across **every screen and module**. Do not redesign only the dashboard while leaving the rest of the application inconsistent.

### 14.1 Company identity and blue/white brand

Create a recognizable IDEAL/company visual identity using a professional **blue and white** palette.

- Inspect the repository for an existing company logo, brand assets, company name, and identity files before creating anything.
- If an approved logo already exists, preserve it and build the interface around it.
- If no approved logo exists, create a clean, original, professional logo concept for the company using blue and white. The mark should communicate construction, engineering, precision, trust, and reliability without looking like a generic template.
- Do not invent a legal company name, registration details, or slogan. Use the actual company identity configured in the app; allow the owner to enter or update it in Company Settings.
- Provide a full logo, compact/icon mark, light-background version, and dark-background version if needed. Keep them visually consistent.
- Store brand assets locally in the repository/app assets or the configured local company branding directory. The app must not require an online logo service.
- Use the logo consistently in the login/setup screen, application header/sidebar, dashboard, loading/splash screen, reports, quotations, invoices, purchase orders, certificates, and printable/PDF documents.
- Add Company Settings controls to upload/change the logo, preview it, and safely restore the default. Validate file type and size; do not allow arbitrary paths or unsafe SVG execution.
- Preserve sufficient contrast and legibility at small sizes. Do not stretch or distort the logo.

### 14.2 Design system and visual direction

Build a small reusable design system and apply it consistently:

- Primary brand: professional blue, supported by white and carefully selected neutral greys.
- Use dark navy/blue for strong structure and headings, clean white surfaces for work areas, and restrained blue accents for primary actions and selected navigation.
- Use semantic status colors only where they communicate meaning: success, warning, danger, information. Do not use bright colors as decoration.
- Define design tokens for colors, typography, spacing, border radius, shadows, borders, focus rings, and elevation. Avoid scattered hard-coded colors.
- Use a consistent font stack that renders French accents and numbers cleanly and works offline. Do not fetch fonts from the internet at runtime.
- Use a clear typographic hierarchy: page title, section title, field label, helper text, table text, metadata.
- Keep visual density appropriate for an ERP: information-rich but readable, with aligned columns and predictable spacing.
- Use consistent icons from one icon family already installed or a carefully selected lightweight library. Avoid mixing unrelated icon styles.
- Avoid excessive gradients, glassmorphism, glowing borders, giant rounded cards, unnecessary shadows, and decorative clutter.
- Provide light theme as the default. A dark theme may be added only if it is complete and tested across every screen, dialog, chart, table, and document preview.
- Do not use color alone to convey status; include text/icon labels.

### 14.3 Application shell and navigation redesign

Reorganize the entire application so users can understand where they are and reach frequent tasks quickly.

- Create a consistent application shell with a branded sidebar, top bar, main content region, and optional contextual panel.
- Group navigation into understandable business sections, for example:
  - Accueil
  - Ventes & Clients
  - Projets & Chantiers
  - Études & Devis (BOQ, estimates, rate analysis)
  - Achats & Fournisseurs
  - Stocks & Matériaux
  - Personnel & Paie
  - Parc & Maintenance
  - Finance & Trésorerie
  - Qualité & Sécurité
  - Documents & Rapports
  - Administration & Paramètres
- Use the real modules discovered in the repository. Do not create duplicate navigation destinations or links to pages that do not exist.
- Support collapsible sidebar behavior with clear active-page indication and accessible tooltips when collapsed.
- Keep navigation labels and icons aligned. Use consistent spacing and clear section separators.
- Add a top bar with page context/breadcrumbs, global search entry, notifications, current user/account menu, and quick access to settings where appropriate.
- Provide a clear page title and primary action at the top of every major page.
- Ensure the shell adapts to smaller window sizes without hiding critical actions.
- Keep keyboard navigation and focus order logical.
- Preserve direct navigation/deep links and browser/Electron back behavior where currently supported.

### 14.4 Dashboard and workspace layout

Redesign the dashboard as a useful operational command center, not a decorative landing page.

- Show real, permission-filtered KPIs from the database: active projects, work progress, outstanding customer balances, supplier obligations, cash/bank summary, stock alerts, workforce/attendance, equipment maintenance, and overdue actions.
- Use a sensible grid with consistent card sizes and hierarchy.
- Allow date/project filters where meaningful; show the active filter state.
- Make each KPI card clickable only when it can navigate to a relevant filtered list or detail view.
- Add a concise “À traiter” / pending actions area for approvals, overdue invoices, low stock, expiring documents, maintenance, and delayed tasks.
- Use compact charts only when they answer a business question; provide labels, legends, accessible text summaries, and empty states.
- Do not display fake numbers, demo charts, or hard-coded percentages.
- Avoid loading every report on initial dashboard render. Load only the data needed for the visible dashboard and lazy-load secondary details.

### 14.5 Button hierarchy and action placement

Audit and standardize every button in every module.

- Each page should have one visually dominant primary action (for example “Nouveau projet”, “Ajouter un client”, or “Créer une facture”) when the user has permission.
- Secondary actions should be visually quieter and grouped logically.
- Destructive actions must be visually distinct, require confirmation, and never be placed beside primary actions in a way that invites accidental clicks.
- Use consistent button sizes, heights, icon placement, labels, padding, and states.
- Prefer explicit French text labels for important actions; use icon-only buttons only for universally recognizable actions and provide accessible labels/tooltips.
- Group related actions into a clear toolbar or overflow menu when space is limited.
- Keep row-level actions consistent across tables (view, edit, print/export, archive, more).
- Do not show actions the current user cannot perform.
- Prevent duplicate submissions and show progress while saving.
- Make disabled states visibly disabled and explain why an action is unavailable where useful.
- Every action must follow the universal interaction contract in Section 4; visual polish must never hide missing functionality.

### 14.6 Forms, cards, panels, tables, and dialogs

- Standardize form layouts, label widths, field spacing, required markers, help text, validation messages, and footer actions.
- Break long forms into meaningful sections or steps; preserve entered data when moving between sections.
- Use two-column forms only when the window width permits; collapse to one column on narrow screens.
- Use consistent cards/panels for related content, not a card around every field.
- Improve tables with readable headers, row hover/focus, aligned numeric columns, clear status chips, responsive overflow, search, filters, sorting, and pagination/incremental loading.
- Use sticky headers only when they improve usability and do not create nested-scroll problems.
- Make row selection and bulk actions explicit, permission-aware, and safe.
- Standardize modal/dialog width, title, close behavior, focus handling, confirmation copy, and action placement.
- Avoid opening a modal for every simple action; use inline editing or a dedicated page where that creates a clearer workflow.
- Add well-designed loading, empty, error, and no-results states with useful next actions.
- Keep print layouts clean and hide application navigation and interactive-only controls when printing.

### 14.7 Mouse, hover, click, and micro-interactions

Add subtle, polished interactions so the app feels responsive and modern:

- Buttons: restrained hover color/brightness change, clear pressed state, and a short transition.
- Sidebar items: subtle hover background, active indicator, and clear focus state.
- Cards: small hover elevation or border emphasis only when the card is actionable.
- Tables: subtle row hover and selected-row state; do not make non-clickable rows look clickable.
- Inputs: clear focus border/ring and validation state.
- Menus and dialogs: smooth, short open/close transitions with no disorienting movement.
- Tooltips: appear after a short delay and never cover the control being explained.
- Click feedback: clear pressed/selected state; avoid exaggerated ripple effects.
- Loading: lightweight progress indicator or skeleton that does not shift the layout.
- Use pointer cursor only on genuinely interactive elements. Use default cursor for static content and text selection where appropriate.
- Ensure hover is never the only way to reveal an action; touch and keyboard users must have equivalent access.
- Avoid custom cursor replacements, cursor-following visual effects, continuous particle effects, heavy 3D scenes, and animations that distract from business work.
- Keep typical interaction transitions short (roughly 120–220 ms) and use transform/opacity where possible to avoid expensive layout recalculation.
- Respect operating-system reduced-motion preferences and provide an in-app motion setting: System / Reduced / Off.
- All core actions must remain understandable and usable with animations disabled.

### 14.8 Animation and performance constraints

Animations are allowed when they improve clarity and feedback, but they must not compromise performance or accessibility.

- Use CSS transitions and lightweight CSS keyframes for simple UI motion.
- Avoid adding a heavy animation framework unless the existing project already uses it and there is a measured need.
- Do not animate large lists, entire dashboards, or every table row continuously.
- No autoplay video, animated background, particle field, or continuous decorative motion in the ERP workspace.
- Animate only opacity and transform where practical.
- Avoid expensive blur/filter/backdrop effects and large shadow animations.
- Disable or simplify non-essential animation on low-power devices or when reduced motion is enabled.
- Verify scrolling, typing, opening tables, and switching modules remain responsive on the 4 GB RAM target.
- Include a manual UI performance checklist and, where possible, automated checks for layout stability and interaction responsiveness.

### 14.9 Responsive behavior and window management

- Support maximized desktop use and smaller resizable windows.
- At wide sizes, use sidebar + main workspace and optional right-side context panels.
- At medium sizes, collapse the sidebar and stack secondary panels.
- At narrow sizes, use a compact navigation drawer and single-column forms.
- Ensure dialogs fit within the viewport and remain scrollable.
- Prevent horizontal overflow except inside intentionally scrollable wide tables.
- Do not hide save, cancel, search, or critical actions outside the visible viewport.
- Test at representative window sizes, including 1280×720, 1024×768, and a narrow window.

### 14.10 Branding in business documents

The visual identity must carry through to generated business documents:

- Company logo and company details in quotations, invoices, purchase orders, payment receipts, progress certificates, payslips where authorized, and reports.
- Consistent blue/white document styling with restrained use of brand color.
- Clear document title, reference, dates, customer/supplier details, line-item tables, totals, tax breakdown, payment terms, signatures/stamps where configured, and page numbers.
- Ensure documents remain legible in grayscale printing.
- Never fabricate company identifiers, tax numbers, legal text, or signatures.
- Provide a preview before issuing/printing high-impact documents.
- Keep the original data and calculations authoritative; the document template must not recalculate financial values differently from the backend.

### 14.11 Visual QA and acceptance

The agent must complete a visual audit of every page and reusable component, not just a screenshot of the home page.

Required process:

1. Inventory every route/page and shared UI component.
2. Capture baseline screenshots at representative desktop and narrow window sizes where tooling permits.
3. Identify inconsistent spacing, typography, colors, button placement, icon styles, table patterns, empty states, and responsive breakage.
4. Implement shared design tokens/components first, then migrate pages in coherent groups.
5. Check every interaction with mouse, keyboard, and touch-equivalent input where supported.
6. Verify hover, focus, active, pressed, disabled, loading, success, and error states.
7. Verify that every clickable KPI/card/table row navigates to the correct permitted destination.
8. Verify all dialogs, forms, search, filters, sorting, pagination, and exports.
9. Check French text overflow, long customer/project names, large DZD values, and date formatting.
10. Confirm light/dark logo variants and print output if a dark theme exists.
11. Re-run functional, permission, end-to-end, and packaged Windows tests after the redesign.
12. Compare performance before and after; remove effects that materially slow the app.

**Visual redesign acceptance gate:**

- The application has a consistent blue-and-white company identity and a usable logo.
- Every page follows the same layout, typography, spacing, button hierarchy, and component behavior.
- Navigation and dashboard are clear, functional, and based on real data.
- All controls remain discoverable and operable with mouse and keyboard.
- Hover/click/transition animations are subtle, accessible, and optional.
- No dead buttons, fake links, decorative controls masquerading as actions, or hover-only functionality remain.
- The redesign does not break existing workflows, permissions, data, printing, or offline operation.
- Performance remains acceptable on the 4 GB RAM target.

### 14.12 Add this requirement to every coding-agent task

When implementing any module, do not treat UI as a final cosmetic pass. Build the feature using the shared design system from the start. Match the blue/white brand, standard page shell, button hierarchy, form/table/dialog patterns, responsive behavior, and subtle interaction states. Test the feature visually and functionally. If an existing page is inconsistent, improve it without removing any working capability.

### 14.13 Updated compact prompt supplement

Append this instruction to the compact execution prompt whenever delegating visual work:

> Also implement Section 14, “Complete visual redesign, company branding, and interaction design.” Audit and redesign every page consistently around a professional blue-and-white company identity and an original/approved company logo. Reorganize the sidebar, top bar, dashboard, page sections, buttons, forms, tables, cards, dialogs, and document templates. Make all mouse hover, click, focus, pressed, loading, and navigation interactions polished and functional. Add only subtle lightweight animations, with System/Reduced/Off motion settings and full keyboard/touch accessibility. Do not use heavy effects or custom cursors. Preserve the existing workflows and 4 GB RAM/offline constraints. Validate every page and every control, not only the dashboard.


---

## 15. Algerian accounting, taxation, payroll, and legal compliance engine (2026–2027 and future years)

This section is a high-priority product requirement. IDEAL is intended for Algerian businesses, especially construction and public-works companies (BTP). Financial and tax calculations must be accurate, explainable, traceable to legal sources, and maintainable as Algerian law changes. A plausible-looking total is not sufficient. Incorrect tax treatment can cause financial and legal harm.

### 15.1 Non-negotiable legal accuracy principles

1. **Never hard-code tax rates, thresholds, exemptions, deadlines, penalties, or form rules in UI components or scattered business logic.** Store them in a versioned, effective-dated Algerian tax rules catalogue.
2. Every tax rule must include: jurisdiction (Algeria and any applicable local scope), tax type, legal regime, taxpayer/entity eligibility, activity/sector, taxable base, rate or calculation method, exemptions/exclusions, deductibility/recovery conditions, rounding rule, effective-from date, effective-to date (if known), tax period, legal source, article/paragraph, source publication date, verification status, and reviewer/approval metadata.
3. Apply the rule that was legally effective on the **tax point / transaction date**, not simply the current calendar year or the date the user opens the record. Preserve historical calculations and issued documents.
4. Distinguish clearly between: enacted and published law; implementing regulation/instruction; official DGI guidance; parliamentary bill or draft; unofficial commentary. A bill, amendment proposal, press report, or draft must never silently become an active tax rule.
5. When a rule is uncertain, missing, contradictory, or not verified against an authoritative source, mark the calculation **À vérifier** / **Non validé**, explain what is missing, and prevent silent finalization of a tax-sensitive document. Do not guess a rate.
6. Tax rule updates must be reviewed, tested, approved by an authorized administrator/accountant, versioned, and auditable before activation. Keep prior versions immutable.
7. Display the legal basis and calculation breakdown beside each important tax result. Allow an accountant to trace a figure from the invoice/entry to the tax return and ledger.
8. Do not present IDEAL as a substitute for a certified Algerian accountant or legal/tax adviser. Provide a clear notice that final filing and interpretation remain subject to official law and qualified professional review.

### 15.2 Algerian official-source registry and annual legal updates

Maintain a local, searchable legal-source register. Prefer sources in this order:

1. Journal officiel de la République algérienne démocratique et populaire (JORADP): promulgated laws, decrees, and regulations.
2. Ministry of Finance and Direction Générale des Impôts (DGI): current tax codes, official forms, notices, instructions, and taxpayer guidance.
3. Official parliamentary documents and government/finance ministry publications: bills and explanatory reports, clearly marked as drafts until promulgated.
4. Other sources may help discover changes, but must not be the sole legal basis for activating a tax rule.

Seed the legal register with the 2026 DGI tax-code publications and the 2026 tax legislation relevant to the application, including at least:
- Code des impôts directs et taxes assimilées (CIDTA).
- Code des taxes sur le chiffre d'affaires (CTCA), including TVA.
- Code des procédures fiscales (CPF).
- Code du timbre.
- Code de l'enregistrement.
- Code des impôts indirects where applicable.
- Loi de finances 2026 and its applicable amendments and implementing texts.
- Algerian Système Comptable Financier (SCF), accounting regulations, and applicable chart-of-accounts guidance.
- Relevant labour, social-security, CNAS/CASNOS, and payroll contribution legislation and official guidance, maintained as a distinct social/payroll rules domain.

**2027 status control:** as of 24 November 2026, the 2027 Finance Law material located for this specification is still identified as a *Projet de Loi de Finances pour 2027*. The APN adopted the PLF on 16 November 2026, and the Minister of Finance presented it to the Council of the Nation committee on 23 November 2026. Therefore, treat its provisions as proposed/pending until the final enacted text is adopted, promulgated, published in JORADP, and its effective dates are confirmed. Reconcile the final enacted text against the APN/Senate versions and amendments before activating any 2027 rule. Never label a draft as current law.

At each annual update, create a legal-change report showing: old rule, new rule, legal reference, effective date, affected modules, affected historical/future transactions, required migration or recalculation, test cases, and approval status. Preserve the original legal source file and a checksum where practical. Provide an offline manual import/review workflow; do not require paid APIs or continuous internet access.

### 15.3 Tax regimes and taxpayer profile

During company setup and in Company > Fiscal Settings, capture and validate the fields required to determine the company's real legal/fiscal profile, including as applicable:
- Legal form and company type.
- NIF, NIS, RC, AI, and other official identifiers where applicable.
- Main and secondary activities, NAE/activity codes, BTP activity classification, and relevant registrations/approvals.
- Wilaya, tax centre/service, establishment locations, and multiple establishments.
- Tax regime: régime réel, régime simplifié, IFU, or another legally applicable regime, with effective dates and eligibility checks.
- VAT status: subject, exempt, non-recoverable, partially recoverable, or other legally applicable status.
- IBS/IRG liability and other taxes applicable to the legal form and activity.
- Fiscal year opening/closing, filing frequency, and tax payment method.
- Social-security employer affiliation and employee coverage details, kept distinct from tax registration.

Do not infer legal regime solely from turnover or business name. Validate eligibility using the current law and prompt for accountant confirmation when the profile is incomplete. Support separate establishments and activity segments where required by law.

### 15.4 VAT / TVA engine — full required behavior

Implement TVA as a first-class tax engine, not as a single percentage field.

- Support all legally defined standard/reduced/special rates, exemptions, zero-rated or suspended treatments only where the current Algerian law actually provides them. Load exact rates and eligible operations from the verified CTCA and Finance Laws; do not assume that every product/service uses the same rate.
- Support product/service tax classification, customer/supplier status, transaction type, place and date of supply, taxable base, discounts, advances, credit notes, returns, and legally relevant tax point rules.
- Calculate TVA collectée, TVA déductible, non-deductible TVA, TVA due, excess credit, carry-forward, and refunds/credits only according to the applicable legal rules and documentation requirements.
- Support purchases and sales, subcontracting, imported goods/services where relevant, fixed assets, construction works, equipment, materials, transport, rentals, and mixed taxable/exempt activity.
- Apply deductibility restrictions, supporting-document requirements, allocation/prorata rules, and adjustments only where confirmed by law.
- Show HT, rate, TVA amount, TTC, tax base, and legal treatment per line and per document. Use decimal-safe arithmetic and explicit rounding rules; never use binary floating-point for monetary totals.
- Support deposits/advances, partial invoices, progress certificates/situations de travaux, retention/garantie retenue, credit notes, cancellations, and corrections without double-counting tax.
- Handle exempt transactions with the legal exemption reason and reference; never treat a blank rate as an exemption.
- Provide VAT reconciliation by period: sales ledger vs collected VAT, purchase ledger vs deductible VAT, general ledger vs return, credit carried forward, payments, and differences requiring review.
- Produce a tax breakdown on quotations, invoices, purchase documents, credit notes, and reports. The document renderer must use the backend's authoritative calculation result.
- Include tests for every configured rate and treatment, date boundary changes, mixed-rate invoices, exemptions, advances, partial payments, returns, rounding, and invalid or missing tax classifications.

### 15.5 Direct taxes and other tax families

Provide a rule-driven calculation and tracking framework for taxes that apply to the company's legal form, activity, and regime. At minimum, assess and support as applicable:

- **IBS** (Impôt sur les bénéfices des sociétés): taxable profit reconciliation from accounting result to fiscal result; deductible and non-deductible expenses; amortization/depreciation; provisions; reinvestment-related treatments; loss carry-forward where legally permitted; instalments/advances; annual return; liquidation balance; and payment tracking. Support distinct activity rates or allocations only where the law requires them. The DGI's published guidance currently lists BTP among activities with a specific IBS rate; the exact active rate and conditions must be loaded from the applicable CIDTA/Finance Law version, not copied permanently into code.
- **IRG** (Impôt sur le revenu global): applicable categories, salary withholding, taxable income, allowances/exemptions, progressive scales, annual reconciliation, and non-salary income where in scope.
- **IFU** (Impôt forfaitaire unique): eligibility, exclusions, thresholds, payment/declaration schedule, and VAT implications exactly as defined by the active law. Do not apply IFU and ordinary TVA/IBS logic simultaneously unless the legal provisions require a specific combination.
- **TAP and historical/renamed/abolished taxes:** maintain legal status by period. Never show a repealed tax as currently payable; retain historical records and calculations for old periods.
- **Withholding taxes and source deductions** where applicable to suppliers, service providers, non-residents, or other payment types.
- **Stamp duty (droit de timbre)**, registration duties, and other transaction/document taxes where applicable.
- **Local taxes, property/land/building-related taxes, vehicle taxes, and parafiscal levies** where applicable to the company and assets.
- **Professional training and apprenticeship taxes/contributions**, with the employer-size, base, exemptions, and employee/stage eligibility rules controlled by the current legal version.
- Customs duties and import-related taxes where relevant, including correct separation of customs duty, VAT, and any advance/creditable tax.
- Penalties, late interest, surcharges, and limitation periods only from verified legal provisions, with manual accountant review before posting.

Do not enable every tax for every company. Use a tax applicability matrix based on entity, regime, activity, transaction, asset, and period. Each tax family must have an on/off/applicability reason and a legal reference.

### 15.6 Algerian payroll, social contributions, and employee obligations

Build a payroll rules module separated from the corporate tax engine but connected to accounting and employee management.

- Support gross salary, taxable salary, allowances, benefits in kind, overtime, bonuses, leave, absences, advances, deductions, net salary, and employer cost.
- Calculate IRG salary withholding and applicable exemptions/allowances using effective-dated official scales.
- Calculate employee and employer social-security contributions (CNAS and other applicable schemes), occupational accident contribution if applicable, and other mandatory contributions only using verified current rates and bases.
- Distinguish tax withholding from social-security contributions and from employer expenses.
- Support payslips, payroll journal, monthly declarations, annual summaries, employee identifiers, hiring/termination dates, and correction runs.
- Support legal minimum wage (SNMG) and statutory changes as effective-dated rules, not constants.
- Keep payroll calculations reproducible: every payslip stores the exact ruleset version used.
- Test salary boundaries, partial months, unpaid leave, overtime, bonuses, contract changes, termination, and year-boundary changes.
- Never invent CNAS/CASNOS rates, salary scales, SNMG values, or deadlines.

### 15.7 SCF accounting engine and bookkeeping controls

Implement a real double-entry accounting core aligned with the Algerian Système Comptable Financier (SCF), not merely income/expense lists.

- Maintain a configurable SCF chart of accounts with account codes, names, account type, parent/child hierarchy, and valid posting rules.
- Support journals (sales, purchases, bank, cash, payroll, fixed assets, inventory, general journal), general ledger, subsidiary ledgers, trial balance, balance sheet, income statement, cash-flow reporting where applicable, and period closing.
- Enforce that every posted journal entry balances debit and credit. Use atomic database transactions.
- Link every journal entry to its source document, user, timestamp, approval, and audit trail.
- Support analytic accounting/cost centres by project, worksite, contract, activity, vehicle, equipment, and department.
- Support accruals, prepayments, depreciation, provisions, inventory valuation, work in progress, customer/supplier balances, advances, retention money, and foreign-currency transactions only according to applicable SCF and tax treatment.
- Provide bank reconciliation, cash reconciliation, customer/supplier statements, aged receivables/payables, and period-end checklists.
- Lock closed periods. Reopening requires authorized approval, reason, and a complete audit record.
- Never edit a posted journal entry in place without an auditable reversal/correction workflow.

### 15.8 BTP-specific tax and contract accounting

Because IDEAL targets construction and public works, verify and support the special accounting/tax implications of:
- Contracts and subcontracts, progress-based billing (situations de travaux), work completion certificates, advances, retention/guarantee deductions, provisional/final acceptance, variation orders, price revisions, penalties, and contract amendments.
- Tax treatment and timing of invoices and payments for works, supplies, rentals, equipment, and subcontracting.
- Project cost allocation, stock/material consumption, equipment depreciation/use, labour cost, transport, fuel, and overhead allocation.
- Joint ventures/consortiums and multi-company projects only if legally and technically supported.
- Public procurement documentation and tax certificates/clearances where legally required.
- Reconciliation of contract HT/TTC, progress statements, advances, retentions, collected amounts, VAT, costs, and project margin.

Do not assume that all BTP contracts have identical tax timing or VAT treatment. Make contract type and transaction nature explicit, and require review when the applicable legal treatment is unclear.

### 15.9 Fiscal calendar, declarations, and supporting documents

Provide a configurable Algerian fiscal calendar generated from the taxpayer profile and current legal rules:
- Monthly, quarterly, and annual declarations and payments as applicable.
- DGI declaration forms and identifiers (for example G50, G4, G8, G29 and other forms only when applicable to the taxpayer and current rules).
- Deadlines, reminders, payment receipts, filing status, late-filing risk, and evidence attachments.
- Reconciliation reports before a return can be marked ready.
- Exportable declaration workpapers and supporting schedules in practical formats (PDF, CSV, XLSX) where appropriate.
- Record the filing reference, submission date, payment reference, and receipt.
- Do not claim electronic filing or payment integration unless an official supported interface exists and has been implemented and tested. Otherwise prepare accurate files and a clear manual submission checklist.
- Keep a history of filed declarations and amended/corrected declarations.

### 15.10 Tax calculation UX and accountant review

For every tax-sensitive result, show a readable calculation trace:
1. Source transaction and date.
2. Taxpayer profile and applicable regime.
3. Rule name, version, effective dates, legal citation, and verification state.
4. Tax base and adjustments.
5. Rate/formula and intermediate values.
6. Rounding method and final amount.
7. Ledger accounts and declaration line mapping.
8. Warnings, missing evidence, and reviewer approval.

Provide an accountant review queue for unclassified transactions, uncertain treatments, rule updates, reconciliation differences, unusual tax values, and manual overrides. Manual overrides require a reason, user identity, timestamp, before/after values, and approval according to permissions. No silent override is allowed.

### 15.11 Precision, auditability, and security

- Use decimal/fixed-point arithmetic or integer minor units with a documented precision strategy. Never use JavaScript floating-point arithmetic for authoritative monetary/tax totals.
- Define and test currency precision, tax rounding per line/document/return, and allocation of rounding differences.
- Store source amounts, tax bases, calculated amounts, rule identifiers, and calculation snapshots so historical results can be reproduced.
- Prevent duplicate posting and duplicate declaration totals through idempotency and source-document constraints.
- Apply role permissions for accountant, admin, project manager, and other roles; sensitive payroll data must be restricted.
- Log changes to tax profiles, tax rules, invoices, journal entries, declarations, and payroll.
- Back up tax-rule versions and accounting data together; test restore consistency.
- Do not expose NIF, employee identifiers, payroll, or financial data in logs or error messages unnecessarily.

### 15.12 Mandatory automated and scenario-based acceptance tests

Create isolated test companies and fixtures for at least:
- A BTP company under each supported tax regime and a company with multiple activities/establishments where legally relevant.
- Sales invoice with one rate, mixed-rate invoice, legally exempt invoice, credit note, purchase invoice, fixed asset, subcontractor invoice, import transaction, advance, partial progress invoice, retention, cancellation, and refund/credit scenario.
- IBS calculation from accounting profit to fiscal result, including deductible/non-deductible expenses and year-end adjustments.
- IRG payroll with multiple salary levels, allowances, overtime, absences, partial month, termination, and a change in annual scale.
- Social contribution calculation with effective-date changes.
- Filing calendar and declaration workpapers for monthly/annual obligations applicable to each fixture.
- Tax rule change effective mid-year and on 1 January; old transactions must retain old rules and new transactions must use the new rules.
- Unverified draft 2027 rule must not activate; approved final published rule must activate only from its legally effective date.
- Journal balancing, period lock, reversal/correction, bank reconciliation, and project analytic accounting.
- Rounding, decimal precision, very large DZD amounts, zero amounts, negative credit notes, missing tax classification, and boundary values.
- Permission tests proving that unauthorized users cannot edit rules, approve overrides, view restricted payroll, or post/close periods.
- Backup/restore of tax rules, ledger, declarations, and source documents.

Acceptance requires independent review of a representative set of calculations by a qualified Algerian accountant/tax professional using the same source documents and legal version. Record the review evidence and any differences. Passing unit tests alone is not proof of legal correctness.

### 15.13 Definition of done for Algerian tax compliance

The tax/accounting work is not complete until:
- The official 2026 legal source pack is recorded and versioned.
- The 2027 Finance Law is not treated as enacted until final promulgation and publication are verified.
- Every enabled rate, threshold, exemption, deadline, penalty, and formula has a traceable legal citation and effective date.
- TVA, IBS, IRG, IFU, applicable withholding/stamp/registration/local/parafiscal taxes, payroll, and social contributions are implemented only to the extent legally applicable and verified.
- The SCF ledger is balanced and connected to invoices, payroll, inventory, projects, and declarations.
- Historical transactions remain reproducible after legal updates.
- Accountant review and reconciliation scenarios pass with documented evidence.
- No tax-sensitive operation silently falls back to a guessed or default rate.
- The module works fully offline after its legal rules/source pack is installed; updates are imported and reviewed explicitly.
- The user interface is French-only in accordance with the product language requirement, with accurate Algerian terminology and DZD formatting.

### 15.14 Required sources for the initial legal research pack

Use and verify the current versions of these official resources during implementation (URLs are references for discovery; always check for newer official publications):
- DGI 2026 tax-code publication page: https://mfdgi.gov.dz/about-us-ar/actu-ar/codes-fiscaux-ar
- DGI TVA guidance: https://www.mfdgi.gov.dz/professionnels/identifier-regime-fiscal-ar/regime-reel-ar/tva-ar
- DGI IBS guidance: https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-reel/ibs
- Ministry of Finance / DGPP 2027 Finance Bill explanatory report: https://dgpp.mf.gov.dz/wp-content/uploads/2026/11/PLF-2027_APN_FR.pdf
- APN adoption of PLF 2027 (16 November 2026): https://www.aps.dz/fr/economie/banque-et-finances/mwj5be13-adoption-a-la-majorite-du-plf-2027
- Ministry presentation to Council of the Nation committee (23 November 2026): https://www.aps.dz/fr/economie/banque-et-finances/mwt2n19i-lebbou-presente-le-texte-de-loi-de-finances-2027-devant-la-commission-competente
- JORADP portal: https://www.joradp.dz/

The agent must verify exact URLs, publication dates, legal status, article numbering, and final enacted text. If an official URL has moved, locate the current official equivalent and record the replacement. The links above are research starting points, not permission to treat a draft as law.

### 15.15 Updated compact execution prompt supplement

Append this instruction to the compact execution prompt:

> Implement Section 15, “Algerian accounting, taxation, payroll, and legal compliance engine (2026–2027 and future years).” Treat Algerian legal accuracy as a P0 requirement. Research official DGI/JORADP/Ministry of Finance sources, build a versioned effective-dated rules engine, and implement TVA, IBS, IRG, IFU, applicable withholding/stamp/registration/local/parafiscal taxes, payroll/social contributions, Algerian SCF double-entry accounting, and BTP-specific progress billing and retention workflows according to the company's actual legal profile. Do not guess rates or deadlines, do not hard-code legal constants, and do not activate draft 2027 provisions before promulgation/publication and verification. Preserve historical calculations, show legal citations and full calculation traces, require accountant review for uncertain cases, and run the full scenario-based acceptance suite. Work offline after rule packs are installed; no paid/cloud dependency. Do not merge to main or publish a release without explicit approval.


---

## 16. Operational intelligence, business control, auditability, resilience, and company-wide acceptance

This section consolidates the additional requirements proposed during product planning. They are requirements for a connected ERP, not decorative dashboard features. Audit the existing implementation first and extend it without duplicating working modules.

### 16.1 Business control center and actionable alerts

Create a rules-driven monitoring and alerting layer using real persisted business data:
- Overdue customer invoices and unpaid installments; supplier invoices approaching or past due.
- Low-stock, reorder-point, reserved-stock, stockout risks, and materials insufficient for planned site work.
- Project budget overruns, abnormal cost growth, low margin, delayed progress, and schedule slippage.
- Contract, insurance, guarantee, employee-document, vehicle-document, and equipment-inspection expiries where relevant.
- Equipment maintenance due, unusual fuel consumption, idle equipment, and breakdown history.
- Cash/bank thresholds, overdue receivables/payables, upcoming cash commitments, and liquidity warnings.
- Missing documents, unapproved transactions, incomplete timesheets, payroll exceptions, and pending approvals.
- Tax declaration/payment deadlines generated from the verified company fiscal profile and Section 15 rules.

Each alert must include severity, source record, reason, detection time, due date where applicable, responsible role/person, recommended next action, and status (new, acknowledged, assigned, resolved, dismissed with reason). Alerts must deep-link to the actual authorized record. Avoid duplicate alert storms; group repeated alerts and provide configurable thresholds. Never generate an alert from demo data or stale KPIs.

Provide daily and weekly company summaries generated locally from actual records. Each summary identifies its data period and last refresh time, shows missing/stale-data warnings, and links to source records. No AI or internet dependency is permitted for ordinary summaries; optional AI must never silently send company data externally.

### 16.2 Project profitability, cost control, and forecasting

For each project, contract, site, work package, and cost code, provide a traceable financial view:
- Original approved budget, approved revisions, current budget, commitments, actual costs, accruals, work in progress where applicable, billed amount, collected amount, retention, outstanding amount, forecast cost to complete, and estimated final cost.
- Planned vs actual quantities, progress, schedule, labour hours, material consumption, equipment hours, subcontractor cost, transport, fuel, overhead, and configured cost categories.
- Revenue and cost recognition must follow the configured accounting policy and applicable SCF/tax treatment. Do not equate cash received with earned revenue without an explicit accounting rule.
- Compare estimate/BOQ baseline, contract amendments, progress certificates, invoices, supplier invoices, payroll, stock issues, equipment usage, and payments.
- Highlight unexplained variances, duplicate costs, unusual unit prices, over-consumption, negative margin, and budget overruns for human review.
- Forecast scenarios (optimistic/base/pessimistic) are allowed only with explicit, editable, dated assumptions and a clear distinction from actuals.
- Every KPI/chart must drill down to the exact permission-checked source records.
- Export project financial statements and variance reports with clear actual/forecast/provisional labels.

Never display a single “profit” number without defining its period, source data, accounting basis, and provisional/closed status.

### 16.3 Full audit trail, approvals, and financial governance

For critical actions, record actor/user ID, role at action time, timestamp, module, entity type/ID, action, reason, correlation/request ID, and before/after values or safe structured diff. Cover create/edit/archive/restore/approve/reject/post/reverse/export/print, login/security events, permission and tax-rule changes, company settings, backup/restore, and period close/reopen.

Protect audit records from ordinary users and prevent editing/deleting them through application APIs. Document the limits of local-machine tamper resistance; do not claim cryptographic immutability if a local administrator can alter the SQLite file. Provide authorized audit filters/exports and mask sensitive payroll, personal, banking, and tax identifiers.

Add configurable approvals for high-impact operations: purchase orders above thresholds, credit notes, payment release, payroll finalization, tax-rule activation, manual accounting adjustments, period reopening, stock write-offs, and destructive archive/purge. Support separation of duties where practical; enforce no self-approval when policy prohibits it.

Posted invoices, payments, stock movements, payroll runs, and journal entries must not be silently overwritten or deleted. Use linked cancellation, reversal, correction, and replacement workflows. Manual overrides require reason, identity, timestamp, before/after values, and approval.

### 16.4 Document generation, archive, and records management

Provide one consistent document service for French business/legal documents: quotations, invoices, credit notes, purchase orders, goods-received notes, receipts, customer/supplier statements, progress certificates, work-completion documents, payslips, project reports, tax workpapers, and accounting statements where supported.

Documents must use the backend's authoritative calculation snapshot and include applicable company identity/logo, identifiers, reference, dates, recipient, line items, HT, tax breakdown, TTC, payment terms, configured payment details, signature/stamp placeholders, page numbers, and verified legal notes. Never invent identifiers, stamps, signatures, legal text, or certifications.

Use immutable issued-document snapshots or equivalent versioning so reprinting an old invoice cannot silently change its amounts or tax rules. Preview high-impact documents before issue. After issue, corrections follow credit-note/cancellation/reissue workflows.

Use unique, configurable numbering sequences by document type, fiscal year, and establishment where required; prevent duplicate references under concurrent operations. Store attachment metadata, linked entity, category, upload actor/time, version, and safe local path. Search by reference, party, project, date, type, status, amount, and identifiers with permission checks. Validate spreadsheet exports against formula injection and preserve numeric values.

### 16.5 Data protection, disaster recovery, and upgrade resilience

Strengthen backup/lifecycle into a tested recovery system:
- Configurable automatic backups (e.g. daily and before upgrades/restores), local destination selection, retention, and visible last-success/failure status.
- Include database, attachments, retained generated documents, and tax/legal ruleset versions needed to reproduce calculations.
- Verify archive structure, checksums, DB integrity, schema compatibility, file inventory, and disk space before restore.
- Restore into staging first; validate DB, attachments, migrations, and cross-record references before atomically switching active data.
- Keep a verified pre-restore snapshot until the restored installation passes validation.
- Inject failures at archive read, checksum, DB open, migration, file copy, rename/swap, restart, and post-restore validation; prove rollback keeps previous data usable.
- Test forced process termination, Windows shutdown/power-interruption approximations, disk-full conditions, denied paths, corrupt archives, and interrupted updates.
- Provide a guided new-PC migration using verified backup/import and record-count/document-link checks.
- Verify update artifact integrity and document whether Windows code signing is configured. Never claim an installer is signed without verifying its signature.
- On update failure, retain the previous working app/data and provide recovery instructions.
- Show backup age, destination, size, integrity state, and last restore-test date. A ZIP existing is not proof of a valid backup.

### 16.6 Search, productivity, and everyday usability

Provide a consistent productivity layer:
- Global search across authorized customers, suppliers, projects, contracts, invoices, payments, employees, materials, equipment, documents, and accounting references.
- Enforce permissions at query time; do not leak the existence or snippets of restricted payroll, banking, or confidential records.
- Lightweight prefix/typo-tolerant search only if measured SQLite performance remains acceptable.
- Module filters, date ranges, status filters, sorting, pagination, and useful saved filter views.
- User-specific table columns/order/page size preferences.
- Keyboard shortcuts and visible hints for frequent safe actions; never bind destructive actions without confirmation.
- Preserve form drafts safely on navigation or unexpected close where practical; distinguish drafts from submitted/posted records.
- Consistent French loading, empty, success, validation, permission-denied, offline, and failure states.
- Actionable error messages with a support reference ID; never expose stack traces or secrets.
- Accessible keyboard operation, visible focus, sensible tab order, accessible icon labels, contrast, scalable text, and reduced motion.
- Avoid clutter: surface controls according to role and workflow context.

### 16.7 Cross-module consistency and reconciliation

Create reconciliation checks so modules cannot silently drift:
- Invoice line/tax totals, customer balance, receivables, receipts, and ledger postings.
- Supplier invoice, purchase order, goods receipt, stock quantity/value, supplier balance, payments, and ledger.
- Payroll, payslips, deductions, social contributions, payments, and payroll journal.
- Material receipts/transfers/issues/returns/wastage, inventory valuation, and project cost.
- Equipment use, fuel, maintenance, depreciation/cost allocation, and project cost.
- Contract value/amendments, progress certificates, advances, retention, invoices, collections, and remaining balance.
- Tax declarations/payments vs sales, purchases, payroll, ledger, and Section 15 rules.
- Backup manifest vs actual database/document inventory.

Show expected and actual values, difference, severity, affected records, and safe resolution workflow. Never silently auto-adjust financial records to force a match. Corrections require authorization, explanation, and audit history.

### 16.8 Operational dashboards and reporting standards

Dashboards must be role-specific (owner/admin, accountant, project manager, storekeeper, HR, driver/site staff) and must not expose unauthorized data. Every KPI must define formula, period, source, last refresh, and provisional/closed status. Every KPI/chart must drill down to exact underlying records.

Include reports for project status/delays, labour attendance, stock/consumption, procurement commitments, equipment utilization/maintenance, receivables/payables, cash flow, project margin, tax deadlines/declaration reconciliation, and document expiry. Support relevant date/project/customer/supplier/establishment filters and permission-checked PDF/XLSX/CSV exports. No fake numbers, arbitrary targets, or fabricated trend lines.

### 16.9 Complete company simulation and realistic acceptance

Before declaring IDEAL pilot-ready, run a complete isolated synthetic-company simulation for a realistic BTP company with multiple projects, customers, suppliers, subcontractors, employees, vehicles/equipment, warehouses, and fiscal periods.

The simulation must exercise the connected lifecycle:
1. Configure company identity, fiscal profile, roles, and opening balances in an isolated test database.
2. Create customer, quotation, BOQ, estimate, contract, amendment, budget, work packages, and schedule.
3. Purchase materials, approve order, receive goods, store stock, transfer to site, consume/return/waste, and reconcile stock.
4. Assign employees/equipment, record attendance/hours/fuel/maintenance, calculate labour/equipment cost, and allocate to project.
5. Record daily site reports, measured progress, subcontractor work, advances, deductions, retentions, and approvals.
6. Issue progress certificates and customer invoices, apply date-specific Algerian tax treatment, record partial/full collections and credit notes, and reconcile customer balance.
7. Record supplier invoices, tax treatment, payments, bank/cash transactions, and reconcile supplier balances.
8. Run payroll and applicable social/tax calculations from the approved legal ruleset; post payroll journal.
9. Generate applicable tax workpapers/declarations from the same versioned ruleset and reconcile to ledger.
10. Calculate project actual cost, commitments, forecast cost to complete, billed/collected values, retention, and provisional/closed profitability.
11. Generate PDF/XLSX reports and documents; verify printed totals against backend calculations and ledger.
12. Test restricted users, rejected approvals, manual overrides, reversals/corrections, and period lock/reopen.
13. Backup and restore to a separate directory; verify counts, hashes, links, calculations, tax rules, and attachments.
14. Simulate failed restore/update and confirm original data remains usable.
15. Restart packaged Windows app offline and confirm core functions remain available.

Keep simulation data isolated from real company data. Save reproducible fixtures, commands, expected totals, actual results, and negative/error cases. Include at least two fiscal-rule versions where applicable.

### 16.10 Independent accounting, tax, and business acceptance review

A qualified Algerian accountant/tax professional must review representative TVA, IBS, IRG, IFU (where applicable), payroll/social contribution, SCF journal, tax declaration, and BTP progress-billing scenarios. Compare IDEAL with independent calculations using identical source documents and legal versions. Record sources, assumptions, expected and actual results, differences, resolutions, reviewer evidence, and date.

Review project cost/profit calculations with a construction cost-control professional or experienced BTP accountant. A software test is not professional legal/accounting validation. If professional review is unavailable, label the scope “technically tested, not professionally validated” and do not claim production-grade legal compliance.

### 16.11 Performance and reliability acceptance on modest Windows hardware

Test a realistic dataset and record startup time, idle memory, memory during search/report/export, DB size, and navigation responsiveness. Target 4 GB RAM; avoid heavyweight background analytics, continuous polling, huge in-memory exports, and expensive animation. Use indexes, pagination, chunked exports where appropriate, and efficient alert computation.

Provide a diagnostic report with app/schema/OS/runtime versions, backup status, and recent non-sensitive error IDs; never include passwords, tokens, or private business content by default. Do not claim performance acceptance without measurements on actual target hardware or a clearly labelled CI approximation.

### 16.12 Final acceptance gates

IDEAL is not ready for a real company pilot until:
- Core modules work end-to-end and share authoritative records.
- Alerts/dashboards use live data and drill down correctly.
- Project costs/margins reconcile to source transactions and accounting basis.
- Audit, approval, reversal, and period controls work and respect roles.
- Issued documents are stable and match backend calculations.
- Backup/restore pass failure-injection tests.
- Search, filters, saved views, and shortcuts work without permission leaks.
- Financial, tax, payroll, stock, project, and party balances reconcile.
- Full synthetic-company simulation passes reproducibly.
- Algerian legal/accounting calculations have official citations and independent review, or are explicitly marked not professionally validated.
- Offline operation and 4 GB RAM performance have evidence.
- Known limitations and recovery steps are documented.
- No merge to \`main\` or release occurs without explicit owner approval.

### 16.13 Updated compact execution prompt supplement

Append this instruction to the compact execution prompt:

> Implement Section 16, “Operational intelligence, business control, auditability, resilience, and company-wide acceptance.” Add actionable real-data alerts and daily/weekly summaries; detailed project cost, budget, progress, and profitability controls; audit history and approval/reversal governance; stable professional document generation and archive; verified automatic backups, restore failure-injection, PC migration and update recovery; global search, saved filters, keyboard shortcuts and draft recovery; cross-module reconciliation; role-specific dashboards; and a reproducible end-to-end synthetic BTP company simulation with independent accounting/tax review. Every KPI must drill down to source records. Do not use fake figures or silently adjust mismatches. Preserve offline operation, French-only UI, 4 GB RAM, and all data-safety rules.
