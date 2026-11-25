# IDEAL — Competitive feature matrix

## Purpose

Use mature ERP, project-management, accounting and inventory products as **workflow references**, not as templates to copy. IDEAL's target remains Algerian BTP companies, offline-first Windows, French-only, DZD, local SQLite, modest hardware, and no AI or mandatory paid/cloud dependency.

Reference products:
- ERPNext and Odoo — integrated ERP patterns and cross-module workflows.
- Dolibarr — practical SME CRM, invoicing, purchasing and stock workflows.
- OpenProject and Plane — project planning, work packages, dependencies and progress visibility.
- GnuCash — accounting concepts, journals, ledgers and reconciliation.
- InvenTree — inventory traceability, locations, stock movements and reservations.
- Construction ERP products such as BuildSuite/OpenConstructionERP — construction-specific project cost, BOQ, field progress and subcontracting concepts.

This is a product-capability mapping, not a claim that a current feature-by-feature vendor benchmark or legal certification has been completed. Before adopting a detailed workflow, verify the relevant product documentation and record the source and review date in the implementation issue.

## Candidate matrix

| Reference pattern | Useful capability to learn from | IDEAL current state | IDEAL decision | Priority |
|---|---|---|---|---|
| ERPNext / Odoo — integrated ERP | One authoritative record shared by sales, purchasing, stock, projects and finance | Several modules exist; integration and ledger are incomplete | Strengthen shared IDs, source-document links, posting/reversal rules and reconciliation | Critical |
| ERPNext / Odoo — approval workflows | Role-based approvals, limits, traceable decisions | Role permissions exist; full configurable approval matrix is not evidenced | Add approval policies by amount, document type, project and role | High |
| Dolibarr — SME CRM | Multiple contacts, customer history, statements, duplicate handling | Basic client management exists | Add contacts, interaction history, duplicate detection/merge and statement print | Medium |
| OpenProject — planning | WBS/work packages, dependencies, Gantt, baseline and milestones | Phases/tasks/milestones exist; dependency/Gantt/baseline gaps remain | Implement lightweight native WBS and Gantt; avoid heavy third-party runtime | Critical |
| Construction ERP — field execution | Daily site diary, workforce/equipment/materials, weather/notes/photos | Missing as a connected workflow | Build daily site reports linked to project, phase, task, worker, equipment and stock | Critical |
| Construction ERP — progress billing | Measured quantities, IPC/situation de travaux, retention and advance recovery | Missing | Build measured progress and certificates linked to BOQ and contracts | Critical |
| Construction ERP — subcontracting | Subcontractor contracts, work packages, measurement, certificates, deductions and settlement | Dedicated entity/workflow missing | Add subcontractor register and full commercial lifecycle | High |
| GnuCash / ERPNext — double-entry accounting | Chart of accounts, journals, general ledger, trial balance and reconciliation | Blocked / not implemented | Design append-only journal, balanced postings, period locks and source links; validate with Algerian accountant | Critical |
| ERPNext — cost centers / project accounting | Cost allocation and budget vs actual | Project cost indicators exist, but detailed reconciliation is incomplete | Cost codes by project/phase and committed/actual/forecast cost | High |
| InvenTree — stock traceability | Locations, transfers, reservations, stocktakes and movement history | Single/limited stock ledger exists; multi-warehouse controls missing | Add warehouse/location model, reservation, issue/return, stocktake and reconciliation | High |
| InvenTree — identifiers | Barcode/QR labels and scan-to-open | Not verified | Add optional offline QR/barcode generation and scan input; no cloud service | Medium |
| Odoo / ERPNext — procurement | Purchase requests, supplier quotations, comparison and approvals | Purchase orders/receipts/payments exist | Add request → quote comparison → approval → PO → receipt → invoice → payment | High |
| Fleet ERP patterns | Asset register, utilization, rental/owned status, maintenance and document expiry | Vehicles/fuel/repairs/preventive maintenance exist | Add rental assets, assignment history, document expiry and utilization cost | Medium |
| Quality management patterns | Inspections, checklists, non-conformities and corrective actions | Missing | Add inspection templates, findings, corrective actions and close-out evidence | High |
| HSE patterns | Risk assessments, toolbox talks, incidents, near misses and safety actions | Missing | Add safety register and role-based incident workflow with privacy controls | High |
| ERP notifications | Event-based alerts with drill-down to source record | Retention/lifecycle alerts exist | Add invoice due, stock min, maintenance, document expiry, task overdue, payroll and approval alerts | High |
| ERP search | Permission-aware global entity search and saved filters | Command palette covers only clients/projects/commercial docs | Extend to all entities, enforce server-side permission scoping and pagination | High |
| ERP reporting | Drill-down KPIs, saved filters and export | Basic reports/KPIs exist | Every KPI must reconcile to source transactions and drill down to records | High |
| Document management | Versioning, retention, metadata and audit | Register/upload/archive/download exists | Add version history, checksum, expiry reminders and linked source records | Medium |
| ERP resilience | Backup, restore, audit and data migration | Strong backup/migration foundation exists | Expand failure-injection, multi-role recovery and PC migration acceptance | Critical |
| Visual customization | Brand settings and reusable design system | Full redesign and admin studio not verified | Blue/white design system, logo/company assets, preview, publish/restore and role protection | High |

## Explicit non-goals

- Do not copy proprietary source code, assets, branding, text or exact interface layouts.
- Do not add features just to match a competitor's checklist.
- Do not add AI or external cloud requirements.
- Do not add heavy scheduling/analytics frameworks if a lightweight native implementation is adequate.
- Do not activate tax or payroll legal rates without official Algerian sources and independent professional validation.
- Do not make optional barcode hardware, Store distribution or cloud backup mandatory.

## Recommended implementation order

1. WBS, task dependencies, cycle prevention, Gantt and baseline.
2. Daily site reports, measured quantities and progress certificates.
3. Subcontractor contracts, measurements, certificates and settlement.
4. Accounting journal architecture and cross-module posting/reconciliation.
5. Multi-warehouse, reservations, stocktake and procurement approvals.
6. Quality/HSE.
7. Event-driven notification center and global search.
8. Full design-system refresh and Visual Identity Studio.
9. Complete company simulation, performance and release acceptance.

Every candidate must have: user story, schema/API/UI design, permission matrix, migration plan, audit/reversal rules, tests, documentation and a demonstrated end-to-end workflow before being marked complete.
