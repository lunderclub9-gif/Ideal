# IDEAL — Owner's Evidence-Based Audit, Product Scope and Controlled Rebuild Brief

**Document ID:** IDEAL-OWNER-BRIEF-2026-11-25  
**Status:** Owner instruction; audit first, implementation only after explicit approval  
**Repository:** https://github.com/lunderclub9-gif/Ideal  
**Product:** Windows desktop ERP for Algerian construction and public-works companies (BTP)  
**User interface:** French only  
**Currency:** DZD  
**Operating principle:** Preserve what is proven, repair what threatens trust, complete core workflows before expanding scope.

---

## 1. Purpose and decision rule

IDEAL is an existing product. This assignment is to inspect, evaluate and improve that product—not to assume that replacing the entire application is the right answer.

The desired outcome is a dependable ERP that connects contractual scope, execution, resources, costs, documents, approvals, invoicing and collection. A smaller number of complete and trustworthy workflows is preferable to many disconnected screens.

The system should let an authorized user answer:
- What has the company contracted to deliver?
- What work has actually been performed, measured, approved and invoiced?
- Which workers, materials and equipment were used?
- What has been spent, committed and forecast to complete?
- What is owed, collected or overdue?
- Which decisions require approval?
- Which source document proves each figure and transaction?

**Mandatory gate:** First perform a repository- and commit-specific audit and deliver the report and implementation plan. Do not modify application code during that first stage. Stop and wait for the owner's explicit approval. Approval of a report, roadmap or general product direction is not blanket authorization for every feature, migration or release.

A broad product redesign may ultimately be justified. It must be evidence-led and incremental where possible. “Rebuild” means improving the product experience and replacing demonstrably weak components—not discarding proven business logic, historical records, audit trails, migrations or customer data.

## 2. Non-negotiable product constraints

- Windows desktop application; French-only user-visible interface, including dialogs, errors, notifications, exports and installer-facing text.
- DZD monetary conventions.
- Offline operation for core business workflows after installation.
- Local SQLite remains the default unless measured evidence proves a material limitation.
- Support modest hardware, including a 4 GB RAM class target.
- No mandatory cloud, hosted database, subscription, paid service or AI feature.
- Local ownership of company data and attachments.
- Role-based access, auditability, PDF, printing, backup and restore.
- Maintainable upgrades and long-term data safety.
- No real company data, secrets or production database access without explicit authorization.

Do not change the technology stack, introduce heavy dependencies, microservices or cloud requirements based on preference alone.

## 3. Required audit method and evidence standard

Identify the exact repository, branch, commit SHA, date and environment used for every audit. Reconfirm the current default branch, open pull requests, releases, workflows and relevant branch differences.

Do not rely on README files or old specifications as proof of current behavior. Inspect source, schema, migrations, API routes, permissions, tests, workflows and packaged-app behavior where access permits.

Track two independent dimensions for every feature:

**Implementation state:** Unknown; Not present; Partial; Implemented.  
**Evidence level:** Documentation only; Source-code inspection; Automated test; Runtime/manual test; Installed Windows build test.

For every important finding record:
- Finding ID and module.
- Observed behavior, not assumed intention.
- Exact file, route, schema, migration, test or workflow evidence.
- Reproduction/re-verification steps.
- User and business impact.
- Severity and confidence.
- Recommended alternatives and acceptance test.

A page, button, API endpoint, database table or documentation statement does not prove an end-to-end feature. Distinguish code inspection from a test actually executed. If the app or Windows installer cannot be run, state that limitation and do not claim runtime verification.

Use the pattern: **Problem → evidence → impact → alternatives → recommendation → acceptance test.** Separate confirmed facts, assumptions, unknowns and recommendations.

## 4. Product scope and operating model decisions

Evaluate and explicitly distinguish:
- One computer / one user.
- One computer / multiple users taking turns.
- Multiple devices operating concurrently.
- Office and construction-site workflows.
- Independent offline devices.
- Single-company versus multi-company data.

Multiple application roles do not imply multi-device concurrency. Do not recommend copying or sharing SQLite database files over a network folder as a concurrency solution. If simultaneous multi-device work is essential, explain the trade-offs and local-first alternatives without imposing a mandatory cloud service.

Evaluate a small or medium BTP contractor managing several projects as the initial launch segment. Do not make equipment rental, wholesale distribution or corporate groups mandatory launch scope without evidence.

Compare two accounting scopes:
1. Operational ERP with controlled, structured exports for an external accountant.
2. Integrated general ledger and accounting workflows based on verified Algerian requirements.

Treasury/cash management is not general-ledger accounting. Explain the differences in cost, risk, testing, legal review and release impact.

## 5. Architecture and security review

Inspect the real implementation and versions. Evaluate separation between UI, local communication/API, use-case services, business rules, persistence, documents/files, reports, migrations, backup and diagnostics. Do not impose extra layers unless they solve an evidenced problem.

Review repeated financial calculations and rounding; module coupling and transaction boundaries; database consistency and concurrency; error handling and idempotency; file storage, path validation and upload limits; Electron security settings and renderer isolation; loopback binding and local API protection; password storage, sessions, authorization and role boundaries; secrets, logs and dependency health; direct database access and backup consistency; money/quantity precision, tax, discounts, allocation and correction.

Test permissions in the backend. Hiding a button is not authorization. Distinguish the application user, Windows account and local machine administrator; explain honestly what local-only security can and cannot protect against.

Evaluate separate permissions for payroll visibility, bank details, project costs, purchase approval, payment entry, payment approval, cancellation/reversal, export, backup, restore and legal-rule changes.

## 6. Core business workflows to trace end to end

### 6.1 Estimate to contract, execution and collection

Trace:

Étude de prix → Devis → Approbation → Contrat → Budget → Exécution → Mesure des travaux → Validation → Situation / Facture → Encaissement

Verify estimate revisions and comparisons; links between estimate, quote, contract and measured items; contractual, performed, approved and invoiced quantities; prior/current/cumulative periods; variations and additional work; duplicate billing prevention; and corrections without erasing history. Assess advances, retention and deductions only where applicable and professionally/legal validated.

### 6.2 Purchase to receipt, supplier payment and site consumption

Trace:

Demande d'achat → Validation → Consultation → Commande → Réception → Facture fournisseur → Contrôle → Paiement → Transfert / Consommation chantier

Check partial/full receipts, returns, quantity and price variance, purchase-order/receipt/invoice matching, approved exceptions, services, duplicate payment/movement prevention, warehouses, transfers, stocktake, negative-stock policy, valuation and unit conversions.

### 6.3 Daily site report and measurement

Assess project/site/date, work performed and quantities, workers/hours, equipment/hours, materials, stoppages, photos, quality and safety observations, and draft/review/approval/correction lifecycle.

Identify the authoritative source for each value. Do not create duplicate attendance or inventory movements when the original transaction already exists.

### 6.4 Workforce and payroll

Trace employee → project assignment → attendance → approval → payroll preparation → review/close → labor-cost allocation.

Separate recorded time, approved time, payable time and project labor cost. Do not claim legal payroll compliance without qualified Algerian review.

### 6.5 Backup and recovery

Test the complete chain:

Company data + attachments → backup → integrity verification → simulated loss/corruption → restore to clean location → reconciliation → resume work

A code path for backup or restore is not proof that recovery has been tested on the installed Windows application.

## 7. Project budget, cost codes and change control

Evaluate configurable cost codes linking purchasing, materials, labor, equipment and subcontractors. Define and display separately:
- Original budget.
- Approved budget changes.
- Current budget.
- Open commitments.
- Actual cost.
- Estimate to complete.
- Forecast final cost.
- Certified/measured value.
- Invoiced amount.
- Collected amount.

Define the source and calculation for each figure. Prevent double counting between commitments, receipts, invoices, stock consumption, payroll and payments. Do not call cash received minus cash paid “project profitability.”

Assess a change register with source/reason, description, quantity/price/time impact, supporting documents, approval and incorporation into contract and billing.

## 8. Subcontractors and equipment

Determine what belongs in launch scope and what can wait.

Subcontractors may require profiles and compliance documents, project work packages, contracts/amendments, measurements, certificates, approvals, advances/retention where applicable, invoices, settlements and payment tracking. Keep subcontractor costs distinct from employee payroll and ordinary supplier purchases.

Equipment may require project assignment, utilization hours, fuel, maintenance, downtime, documents/expiry and project cost. Reuse existing authoritative records and avoid double counting.

## 9. Company profile and controlled onboarding

Evaluate a company identity/settings module separate from IDEAL's own brand:
- Legal and trading names, activity and logo.
- Address, wilaya, commune and contact channels.
- Applicable official identifiers, only where relevant.
- Restricted bank details and authorized signatories.
- Signature/stamp images where appropriate.
- Document defaults, payment terms and commercial conditions.

Assess a guided onboarding sequence:
1. Company identity.
2. Users and roles.
3. Opening date.
4. Import customers, suppliers and materials.
5. Opening stock.
6. Opening balances and receivables/payables.
7. Validation/reconciliation report.
8. Explicit approval and activation.

Imports must support preview, row-level errors, duplicate detection, source documentation and controlled approval. Never silently adjust opening balances.

## 10. Documents, PDFs, photos and archive

Separate business record, preview, template, issued snapshot and incoming attachment.

Candidate lifecycle: Brouillon → À valider → Émis → Corrigé / Annulé → Archivé.

Printing or downloading must not change commercial state. Issued documents must preserve a historical snapshot of company/partner identity, lines, quantities, prices, calculations, terms, dates, actor, template version and final file as appropriate. Later edits to a customer or company profile must not rewrite historical issued documents.

PDF failure must not silently issue a new business document or consume a new number on retry. Use safe, concurrency-resistant numbering and idempotent issue operations.

Evaluate a reusable A4 document engine for quotations, invoices, credit notes, receipts, statements, purchase orders, delivery notes, contracts, BOQ/BPU/DQE, progress certificates, site reports, HR, fleet/equipment and management reports. Include professional page breaks, totals, applicable HT/TVA/TTC, payment terms and page numbering. Legal wording and statutory claims require verification.

A central local archive may include categories, tags, metadata, versions, linked records, search, expiry reminders and permissions. Photos should preserve originals and create separate thumbnails, captions, dates, categories and before/during/after groupings. Link them to projects/sites/tasks/inspections/incidents/vehicles/equipment. Include relevant files and metadata in backup/restore. Consider location metadata privacy on export.

A stamp or signature image is not automatically a legally recognized electronic signature.

## 11. UX, navigation and design system

The target is a calm, professional, fast blue/white interface—not decorative complexity.

Initial palette to validate with actual contrast testing:
- Structure/navy: #12304A
- Primary action: #2563EB
- Hover: #1D4ED8
- Selection: #EFF6FF
- Workspace: #F4F7FB
- Surface: #FFFFFF
- Main text: #172B4D
- Secondary text: #64748B
- Borders: #DCE4EE

Do not communicate state through color alone. Evaluate typography, spacing, buttons, fields, tables, dialogs, alerts, loading/empty/error states, print styles, keyboard focus and reduced motion.

Candidate navigation:
- Accueil
- Affaires & Chantiers
- Clients & Ventes
- Achats & Fournisseurs
- Stocks
- Personnel
- Parc & Matériel
- Finance
- Documents
- Rapports
- Administration

Hide unavailable modules and avoid duplicate records across navigation groups. Evaluate a sidebar, clear page title/breadcrumb, global search, obvious primary action, filtering/sorting/pagination, consistent financial alignment, field-level errors, unsaved-change warnings, keyboard navigation and Windows scaling.

Every visible control must have a real, permission-checked behavior, clear French feedback and duplicate-action protection. A disabled action needs a clear reason. Destructive actions need proportionate confirmation and audited correction/reversal behavior.

Review these reference screens: dashboard, record list, form, project detail, customer detail, invoice and document archive.

### Dashboard and Mon travail

The dashboard should answer: what needs a decision, what is late, where is the risk, and where does each number come from?

Evaluate liquidity, overdue receivables, near-term commitments, active projects, pending approvals, due dates, projects requiring attention, recent activity and backup status. Every KPI needs a definition, source, period, calculation, permission and drill-down.

Mon travail should show the current user's tasks, drafts and approvals—not duplicate the manager's dashboard.

## 12. Additional capabilities to evaluate by user value

Only recommend these when a concrete problem and proportionate cost are demonstrated: data-quality center for duplicates/missing links/discrepancies/missing attachments; saved filters, favorites and recent records; keyboard shortcuts and approval center; non-spammy document-expiry reminders; structured accountant export package and export log; project closeout checklist; basic quality/HSE observations with owner, due date, action, verification and closure; privacy-safe diagnostics; customer data export when leaving the product; French help and guided setup.

For every suggestion explain user problem, value, implementation cost, dependencies and why it is in or out of launch scope.

## 13. Algerian legal and accounting validation

Do not invent tax rates, deadlines, obligations, legal wording or official forms. Build a verification matrix containing topic, applicability, official source, legal text, publication date, effective date, product impact, interpretation, qualified reviewer, tests and verification status.

Research relevant topics only as applicable: SCF, TVA, IBS, IFU, IRG, social contributions, payroll, invoicing/corrections, declarations, advances, progress certificates, retention/guarantees and document retention.

Preserve historical rules by effective date. Do not activate proposed changes until official publication and effective date are verified. A draft Finance Law is not enacted law. State clearly what requires an Algerian accountant or legal/tax specialist.

## 14. Performance and maintainability

Measure on a representative target environment; record Windows version, CPU, disk type, RAM, data volume and attachment volume. Measure startup, navigation, search, save, PDF, CPU, memory, backup and restore.

Set numerical targets only after baseline measurements. Before changing technology inspect query plans/indexes, repeated queries, image loading, long-running work, rerenders, in-memory datasets and unused dependencies. Do not infer 4 GB acceptance from a hosted CI runner.

## 15. External product patterns

Use Odoo and Procore documentation only as workflow references, not as proof of legal compliance or a mandate to copy their design.

For each useful pattern explain: the pattern; the user problem it solves; how to simplify it for IDEAL; what not to copy; and performance/maintenance impact.

Verify the current source and version before relying on an external example. References include Odoo construction, purchase three-way matching and Procore daily logs/cost management.

## 16. Risk priorities and delivery phases

**P0 — Release blockers**
- Data loss/corruption.
- Financial calculation or posting errors.
- Permission bypass.
- Unproven recovery.
- Unsafe migrations.
- Unreconciled opening balances.
- Silent changes to issued financial documents.

**P1 — Core release workflows**
- Sales and collection.
- Purchasing, receipt and supplier payment.
- Inventory.
- Contracts and BOQ.
- Documents.
- Project cost foundation.
- Daily site report and measurement appropriate to the target segment.

**P2 — Important expansion**
- Data quality, global search and notifications.
- Project closeout.
- Basic quality/HSE.
- Subcontractors if validated as core for launch customers.

**P3 — Optional**
- Dark mode.
- Barcode where justified.
- Advanced planning.

Recommended phases:
0. Evidence-based audit and scope decisions.
1. Data, financial, backup, permission and migration safety.
2. Complete core business workflows.
3. Progressive UX consistency and redesign.
4. Execution, measurement and project cost control.
5. Expansion supported by customer need.

For each phase define objective, in/out of scope, dependencies, risks, tests, exit gate and relative effort based on stated assumptions. Do not invent precise delivery dates before code and team capacity are understood.

## 17. Feature specification and acceptance requirements

For each feature approved for near-term implementation, specify ID, problem/value and users; scope and exclusions; main scenario and exceptions; screens and French labels; backend/API behavior and validation; data/schema impact; permissions and audit events; dependencies and migration; unit, API, integration, regression and end-to-end tests; acceptance criteria, priority and complexity.

Test duplicate click/retry, partial and multiple payments, allocation across documents, partial receipt, edits after approval, changed customer data after issue, PDF failure, missing attachment, interrupted update, disk full and unauthorized access.

A feature is not complete merely because its screen or API exists. Verify persisted state and reports against source records, including legacy data.

## 18. Migration, release and owner approval

Before any consequential migration:
1. Inventory source data.
2. Capture a protected baseline backup.
3. Map fields and relationships.
4. Detect anomalies.
5. Agree a correction policy.
6. Run a migration rehearsal on a copy.
7. Reconcile counts, balances, quantities, totals, historical numbers, links, attachments and permissions.
8. Record exceptions.
9. Test recovery.
10. Obtain owner approval.

Never silently correct balances, delete inconvenient records or assume that reinstalling an old app reverses a database migration. Use additive/expand-and-contract migrations where practical and maintain a documented recovery path.

Launch through a controlled pilot with acceptance criteria, support plan and stop/rollback decision points.

## 19. Required Stage 0 deliverables

Before coding, deliver:
1. Executive summary and explicit recommendation.
2. Exact branch, commit SHA and inspected environment.
3. What was inspected and what could not be inspected.
4. Feature inventory with implementation state and evidence level.
5. Workflow maps and gaps.
6. Ranked risk register.
7. Architecture, security, data and permission review.
8. UX/UI review and proposed navigation/reference screens.
9. Operating-model and accounting-scope comparison.
10. Performance recommendations and baseline gaps.
11. Backup, recovery and migration plan.
12. Comparison of targeted fixes, gradual reorganization, selective replacement and broad re-engineering.
13. Phased roadmap with exit gates and relative effort.
14. First proposed feature cards and tests.
15. Decisions requiring owner approval.

End with one explicit recommendation: targeted improvement, gradual reorganization, partial rebuild or comprehensive re-engineering. Explain what remains, what changes and how data will be protected.

**Stop after presenting this report. Wait for explicit owner approval before changing application code.**

## 20. Rules after approval

- Work in small, reviewable branches from the latest main.
- Implement only the approved scope.
- Do not expand scope silently.
- Preserve all branches and history; do not force-push or delete branches.
- Add tests and document migrations.
- Report changed files, commit/PR, tests actually run and their results, Windows/runtime limitations and remaining risks.
- Do not claim completion without evidence.
- Do not merge or release unless separately authorized and all required gates pass.

**Final principle:** Keep what is proven, fix what threatens trust, complete the core before expanding it, and make every number, document and operation understandable, traceable, correctable and recoverable.
