-- IDEAL — captured company database, schema version 9 (before migrations 10 and 11).
--
-- This is the shape of a real customer's books when the durability work was shipped:
-- three projects, a signed contract with instalments, invoices with payments, a
-- purchase order, stock movements, a payroll month and the cash journal. It is
-- anonymised but internally consistent, and every amount below is asserted to survive
-- the remaining migration chain unchanged (scripts/test-migration-chain.ts).
--
-- Load it into a database built with runMigrations(db, 9), never into a current one.

INSERT INTO company_settings (id, name, legal_form, address, phone, email, nif, nis, rc, ai, currency, overhead_rate_percent, auto_backup_time, auto_backup_keep_daily, auto_backup_keep_monthly, setup_completed)
VALUES (1, 'Bâtir Tichy & Services', 'SARL', '12 rue des Oliviers, Tichy', '034 21 55 08', 'contact@batir-tichy.dz', '099816004512367', '000816045512', '16/00-1023456B21', '16045123456', 'DZD', 8.0, '19:00', 30, 12, 1);

INSERT INTO users (id, name, username, password_hash, role, status, last_login) VALUES
  (1, 'Karim Benali', 'kbenali', 'pbkdf2$legacy$fixture', 'admin', 'active', '2026-01-30 08:12:00'),
  (2, 'Nadia Saidi', 'nsaidi', 'pbkdf2$legacy$fixture', 'accountant', 'active', '2026-01-29 17:44:00');

INSERT INTO workers (id, full_name, job_title, wage_type, daily_wage, hourly_rate, monthly_salary, work_schedule, hire_date, cnas_number, phone, status) VALUES
  (1, 'Mohamed Ait Ali', 'Chef de chantier', 'monthly', 0, 0, 65000, '08:00 - 16:30', '2019-02-11', '160451200011', '0550 78 12 34', 'active'),
  (2, 'Rachid Meziane', 'Maçon', 'daily', 3200, 0, 0, '07:30 - 16:00', '2021-06-01', '160451200022', '0661 22 45 78', 'active'),
  (3, 'Sofiane Brahimi', 'Ferrailleur', 'daily', 3000, 0, 0, '07:30 - 16:00', '2022-09-12', '160451200033', '0770 11 23 45', 'active'),
  (4, 'Brahim Ouali', 'Chauffeur', 'daily', 2800, 0, 0, '07:00 - 15:30', '2020-01-20', '160451200044', '0555 98 76 54', 'active');

INSERT INTO tax_rules (id, code, name, rate, effective_date, status) VALUES
  (1, 'TVA_19', 'TVA 19 %', 19, '2025-01-01', 'active'),
  (2, 'TVA_09', 'TVA 9 % travaux immobiliers', 9, '2025-01-01', 'active');

INSERT INTO clients (id, client_type, name, phone, email, address, nif, rc, payment_terms, credit_limit, status) VALUES
  (1, 'company', 'SARL El Amel Promotion', '0550 12 34 56', 'compta@elamel.dz', 'Cité des Frères Bouadou, Tichy', '099816002145788', '16/00-0987654B19', 'Virement', 5000000, 'active'),
  (2, 'individual', 'M. Haddad Yacine', '0661 45 78 12', 'y.haddad@example.dz', 'Boulevard Krim Belkacem, Béjaïa', '099816007845123', '', 'Espèces', 400000, 'active'),
  (3, 'company', 'EURL Tlemcen BTP', '0770 33 21 09', 'contact@tlemcen-btp.dz', 'Zone industrielle, Akbou', '099816003369874', '06/00-1122334A17', '30 jours', 8000000, 'active');

INSERT INTO suppliers (id, name, contact_name, phone, email, address, nif, payment_terms, status) VALUES
  (1, 'Cimenterie du Centre', 'M. Larbi', '034 35 12 40', 'ventes@ciment-centre.dz', 'Route de la cimenterie, Sour El Ghozlane', '099816001122334', '30 jours', 'active'),
  (2, 'Quincaillerie Bab Ezzouar', 'Mme Feriel', '021 24 78 90', 'contact@quincaillerie-be.dz', 'Bab Ezzouar, Alger', '099816009988776', 'Comptant', 'active');

INSERT INTO materials (id, name, code, category, unit, current_quantity, purchase_price, selling_price, min_stock_level, preferred_supplier_id, storage_location, status) VALUES
  (1, 'Ciment CPJ 42.5', 'CIM-425', 'Liants', 'sac', 120, 780, 950, 50, 1, 'Dépôt principal', 'active'),
  (2, 'Sable 0/4', 'SAB-04', 'Granulats', 'm3', 40, 2200, 2800, 15, 1, 'Dépôt principal', 'active'),
  (3, 'Gravier 8/15', 'GRA-815', 'Granulats', 'm3', 25, 2400, 3000, 15, 1, 'Dépôt principal', 'active'),
  (4, 'Acier HA 12', 'ACR-12', 'Aciers', 'tonne', 3.5, 118000, 132000, 1, 2, 'Dépôt principal', 'active'),
  (5, 'Parpaing 15x20x40', 'PAR-1520', 'Maçonnerie', 'unité', 800, 55, 75, 300, 2, 'Dépôt annexe', 'active');

INSERT INTO projects (id, project_number, client_id, title, address, project_type, start_date, expected_end_date, status, manager_user_id, expected_cost, expected_selling_price, progress_percent, include_overhead) VALUES
  (1, 'CH-2025-0001', 1, 'Villa R+2 Tichy', 'Lotissement Les Oliviers, Tichy', 'Construction neuve', '2025-03-03', '2025-12-19', 'in_progress', 1, 6200000, 8500000, 62, 1),
  (2, 'CH-2025-0002', 3, 'Réhabilitation école primaire', 'École Ibn Badis, Akbou', 'Réhabilitation', '2025-06-09', '2025-11-28', 'in_progress', 1, 2450000, 3200000, 45, 1),
  (3, 'CH-2026-0003', 2, 'Extension atelier Haddad', 'Route de la gare, Béjaïa', 'Extension', '2026-01-12', '2026-04-30', 'draft', 1, 720000, 950000, 0, 0);

INSERT INTO project_phases (id, project_id, name, sort_order, status) VALUES
  (1, 1, 'Fondations', 1, 'completed'),
  (2, 1, 'Gros œuvre', 2, 'in_progress'),
  (3, 2, 'Démolition et reprise', 1, 'in_progress');

INSERT INTO project_tasks (id, project_id, phase_id, title, assigned_worker_id, due_date, status) VALUES
  (1, 1, 1, 'Coulage des semelles', 2, '2025-04-11', 'completed'),
  (2, 1, 2, 'Élévation des murs RDC', 2, '2025-09-30', 'in_progress'),
  (3, 1, 2, 'Poteaux et chaînages', 3, '2026-02-15', 'delayed'),
  (4, 2, 3, 'Dépose de la toiture', 4, '2025-08-22', 'completed');

INSERT INTO contracts (id, reference, client_id, project_id, signing_date, start_date, planned_end_date, contract_amount, retention_rate, retention_amount, status) VALUES
  (1, 'CT-2025-001', 1, 1, '2025-02-24', '2025-03-03', '2025-12-19', 8500000, 5, 425000, 'active'),
  (2, 'CT-2025-002', 3, 2, '2025-05-30', '2025-06-09', '2025-11-28', 3200000, 5, 160000, 'active');

INSERT INTO contract_milestones (id, contract_id, title, due_date, expected_amount, received_amount, status) VALUES
  (1, 1, 'Acompte de démarrage', '2025-03-20', 2550000, 2550000, 'paid'),
  (2, 1, 'Achèvement du gros œuvre', '2025-10-10', 2550000, 1000000, 'partial'),
  (3, 2, 'Acompte de démarrage', '2025-06-25', 1600000, 0, 'pending'),
  (4, 2, 'Réception provisoire', '2025-12-05', 1600000, 0, 'pending');

INSERT INTO commercial_documents (id, doc_type, doc_number, client_id, project_id, linked_doc_id, issue_date, due_date, status, discount_percent, total_ht, total_tva, total_ttc, amount_paid, created_by, locked_at) VALUES
  (1, 'devis', 'DEV-2025-0001', 1, 1, NULL, '2025-02-18', '2025-03-18', 'accepted', 0, 4000000, 760000, 4760000, 0, 1, NULL),
  (2, 'facture', 'FAC-2025-0001', 1, 1, NULL, '2025-03-21', '2025-04-20', 'paid', 0, 2000000, 380000, 2380000, 2380000, 1, '2025-04-02 09:15:00'),
  (3, 'avoir', 'AVO-2025-0001', 1, 1, 2, '2025-04-05', NULL, 'issued', 0, 100000, 19000, 119000, 0, 2, NULL),
  (4, 'facture', 'FAC-2025-0002', 3, 2, NULL, '2025-07-15', '2025-08-14', 'partial', 0, 1500000, 285000, 1785000, 500000, 1, NULL),
  (5, 'devis', 'DEV-2026-0002', 2, 3, NULL, '2026-01-20', '2026-02-19', 'draft', 0, 950000, 180500, 1130500, 0, 1, NULL);

INSERT INTO commercial_lines (id, document_id, description, unit, quantity, unit_price, tva_rate, line_ht, line_tva, line_ttc, sort_order) VALUES
  (1, 1, 'Terrassement et fondations', 'Forfait', 1, 1200000, 19, 1200000, 228000, 1428000, 1),
  (2, 1, 'Gros œuvre villa R+2', 'm2', 280, 10000, 19, 2800000, 532000, 3332000, 2),
  (3, 2, 'Acompte gros œuvre', 'Forfait', 1, 2000000, 19, 2000000, 380000, 2380000, 1),
  (4, 3, 'Remise sur béton non conforme', 'Forfait', 1, 100000, 19, 100000, 19000, 119000, 1),
  (5, 4, 'Démolition et évacuation', 'Forfait', 1, 800000, 19, 800000, 152000, 952000, 1),
  (6, 4, 'Reprise des enduits', 'm2', 350, 2000, 19, 700000, 133000, 833000, 2),
  (7, 5, 'Extension atelier 60 m2', 'Forfait', 1, 950000, 19, 950000, 180500, 1130500, 1);

INSERT INTO purchases (id, po_number, supplier_invoice_no, supplier_id, project_id, order_date, status, total_ht, total_tva, total_ttc, amount_paid, created_by) VALUES
  (1, 'BC-2025-0001', 'FA-CIM-2025-118', 1, 1, '2025-07-25', 'ordered', 1000000, 190000, 1190000, 0, 1),
  (2, 'BC-2025-0002', 'FA-QBE-2025-042', 2, 2, '2025-09-02', 'paid', 250000, 47500, 297500, 297500, 1);

INSERT INTO purchase_lines (id, purchase_id, material_id, description, quantity, unit_price, tva_rate, line_total) VALUES
  (1, 1, 1, 'Ciment CPJ 42.5 — 400 sacs', 400, 780, 19, 312000),
  (2, 1, 4, 'Acier HA 12 — 5,8 t', 5.8, 118000, 19, 684400),
  (3, 2, 5, 'Parpaings 15x20x40 — 1500 u', 1500, 55, 19, 82500);

INSERT INTO payments (id, receipt_number, direction, client_id, supplier_id, document_id, purchase_id, milestone_id, payment_date, amount, payment_method, reference, is_reversal, user_id) VALUES
  (1, 'REC-2025-0001', 'inflow', 1, NULL, 2, NULL, 1, '2025-03-21', 2380000, 'Virement', 'VIR-88213', 0, 1),
  (2, 'REC-2025-0002', 'inflow', 3, NULL, 4, NULL, 2, '2025-07-28', 500000, 'Espèces', 'CAI-0455', 0, 1),
  (3, 'REC-2025-0003', 'outflow', NULL, 1, NULL, 1, NULL, '2025-08-04', 1190000, 'Chèque', 'CHQ-778012', 0, 2);

INSERT INTO stock_movements (id, movement_type, material_id, quantity, unit_cost, total_cost, project_id, supplier_id, reference, movement_date, user_id) VALUES
  (1, 'entry', 1, 400, 780, 312000, 1, 1, 'BC-2025-0001', '2025-07-30', 1),
  (2, 'exit', 1, 280, 780, 218400, 1, NULL, 'Chantier villa', '2025-08-12', 1),
  (3, 'entry', 5, 1500, 55, 82500, 2, 2, 'BC-2025-0002', '2025-09-05', 1),
  (4, 'loss', 3, 1.5, 2400, 3600, 2, NULL, 'Casse au déchargement', '2025-09-19', 1);

INSERT INTO vehicles (id, asset_type, name, brand, registration, driver_worker_id, purchase_date, purchase_price, current_mileage, current_engine_hours, usage_rate_per_day, status, insurance_expiry, inspection_expiry) VALUES
  (1, 'truck', 'Camion benne 3,5 t', 'Iveco', '16-2345-118', 4, '2022-04-18', 3800000, 128400, 0, 4500, 'on_project', '2026-04-17', '2026-06-02');

INSERT INTO fuel_entries (id, date, vehicle_id, driver_worker_id, liters, price_per_liter, total_cost, odometer_before, odometer_after, project_id, trip_purpose, fuel_station, user_id) VALUES
  (1, '2025-08-14', 1, 4, 62, 29.4, 1822.8, 127900, 128050, 1, 'Livraison parpaings', 'Naftal Tichy', 1);

INSERT INTO repair_orders (id, order_number, vehicle_id, repair_date, problem_category, description, priority, workshop, parts_used, parts_cost, labor_cost, towing_cost, total_cost, downtime_days, status, project_id) VALUES
  (1, 'REP-2025-0001', 1, '2025-09-26', 'brakes', 'Remplacement des plaquettes avant', 'normal', 'Garage Amrouche', 'Plaquettes + disques', 42000, 8000, 0, 50000, 1, 'completed', 1);

INSERT INTO attendance (id, attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, late_minutes, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES
  (1, '2025-10-06', 1, 1, 'present', 1, 0, 0, 0, 'approved', 1, 1, '2025-10-31 18:00:00'),
  (2, '2025-10-06', 2, 1, 'present', 1, 2, 0, 0, 'approved', 1, 1, '2025-10-31 18:00:00'),
  (3, '2025-10-07', 2, 1, 'present', 1, 0, 15, 0, 'approved', 1, 1, '2025-10-31 18:00:00'),
  (4, '2025-10-07', 3, 2, 'present', 1, 0, 0, 5000, 'approved', 1, 1, '2025-10-31 18:00:00'),
  (5, '2025-10-08', 3, 2, 'half_day', 0.5, 0, 0, 0, 'approved', 1, 1, '2025-10-31 18:00:00'),
  (6, '2025-10-08', 4, 1, 'present', 1, 1, 0, 0, 'approved', 1, 1, '2025-10-31 18:00:00'),
  (7, '2025-10-09', 4, 1, 'absent', 0, 0, 0, 0, 'approved', 1, 1, '2025-10-31 18:00:00'),
  (8, '2025-10-09', 1, 1, 'present', 1, 0, 0, 0, 'approved', 1, 1, '2025-10-31 18:00:00');

INSERT INTO payroll_periods (id, month, year, status, approved_by, approved_at, payment_method) VALUES
  (1, 10, 2025, 'approved', 1, '2025-11-03 10:20:00', 'Espèces');

INSERT INTO payslips (id, payroll_period_id, worker_id, worked_days, overtime_hours, base_gross, overtime_pay, bonus_amount, piecework_amount, gross_salary, cnas_employee, cnas_employer, irg_amount, advances_deducted, penalties_deducted, other_deductions, net_pay, locked) VALUES
  (1, 1, 1, 26, 0, 65000, 0, 0, 0, 65000, 5850, 16250, 7800, 0, 0, 0, 51350, 1),
  (2, 1, 2, 24, 2, 76800, 2400, 2000, 0, 81200, 7308, 20300, 9744, 0, 0, 0, 64148, 1),
  (3, 1, 4, 25, 1, 70000, 1400, 0, 0, 71400, 6426, 17850, 8568, 0, 0, 0, 56406, 1);

INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, project_id, vehicle_id, supplier_id, is_overhead, user_id) VALUES
  (1, '2025-08-02', 'Carburant', 'Gasoil camion benne', 1822.8, 'Espèces', 1, 1, NULL, 0, 1),
  (2, '2025-08-18', 'Location', 'Location bétonnière 15 jours', 45000, 'Chèque', 1, NULL, NULL, 0, 1),
  (3, '2025-09-05', 'Loyer dépôt', 'Loyer dépôt principal', 120000, 'Virement', NULL, NULL, NULL, 1, 2),
  (4, '2025-09-26', 'Entretien véhicule', 'Réparation freins camion', 50000, 'Virement', 1, 1, NULL, 0, 1);

INSERT INTO treasury_transactions (id, tx_date, tx_type, account, category, amount, payment_method, project_id, worker_id, client_id, supplier_id, linked_payment_id, linked_expense_id, bank_reconciled, notes, user_id) VALUES
  (1, '2025-03-21', 'bank_inflow', 'Banque', 'Encaissement client', 2380000, 'Virement', 1, NULL, 1, NULL, 1, NULL, 1, 'Acompte villa', 1),
  (2, '2025-07-28', 'cash_inflow', 'Caisse', 'Encaissement client', 500000, 'Espèces', 2, NULL, 3, NULL, 2, NULL, 0, 'Acompte école', 1),
  (3, '2025-08-02', 'cash_outflow', 'Caisse', 'Carburant', 1822.8, 'Espèces', 1, NULL, NULL, NULL, NULL, 1, 0, '', 1),
  (4, '2025-08-04', 'bank_outflow', 'Banque', 'Paiement fournisseur', 1190000, 'Chèque', 1, NULL, NULL, 1, 3, NULL, 0, 'Cimenterie', 2),
  (5, '2025-08-18', 'bank_outflow', 'Banque', 'Location matériel', 45000, 'Chèque', 1, NULL, NULL, NULL, NULL, 2, 0, '', 1),
  (6, '2025-11-03', 'cash_outflow', 'Caisse', 'Salaires octobre', 171904, 'Espèces', NULL, NULL, NULL, NULL, NULL, NULL, 0, 'Paie 10/2025', 1);

INSERT INTO documents (id, title, category, file_name, stored_path, mime_type, file_size, doc_date, related_type, related_id, uploaded_by) VALUES
  (1, 'Contrat CT-2025-001 signé', 'Contrat', 'ct-2025-001.pdf', 'documents/2025/ct-2025-001.pdf', 'application/pdf', 284133, '2025-02-24', 'contract', 1, 1);

INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_id, old_value, new_value, created_at) VALUES
  (1, 1, 'Karim Benali', 'create', 'commercial_documents', '2', '', '{"doc_number":"FAC-2025-0001"}', '2025-03-21 09:02:11'),
  (2, 2, 'Nadia Saidi', 'approve', 'payroll_periods', '1', '{"status":"draft"}', '{"status":"approved"}', '2025-11-03 10:20:00'),
  (3, 1, 'Karim Benali', 'create', 'stock_movements', '4', '', '{"movement_type":"loss","quantity":1.5}', '2025-09-19 14:31:52');

INSERT INTO backup_history (id, file_name, file_path, backup_type, size_bytes, verified, created_by, created_at) VALUES
  (1, 'gestionpro-dz-20251101-190000-12001-auto_daily.zip', '/backups/gestionpro-dz-20251101-190000-12001-auto_daily.zip', 'auto_daily', 918342, 1, 'Sauvegarde automatique quotidienne', '2025-11-01 19:00:04'),
  (2, 'gestionpro-dz-20251102-091500-12002-manual_local.zip', '/backups/gestionpro-dz-20251102-091500-12002-manual_local.zip', 'manual_local', 921004, 1, 'Karim Benali', '2025-11-02 09:15:00');

INSERT INTO boq_versions (id, project_id, version_number, label, status, notes, created_by, approved_by, approved_at) VALUES
  (1, 1, 1, 'Estimation contractuelle', 'approved', 'Base du contrat CT-2025-001', 1, 1, '2025-02-20 11:40:00'),
  (2, 1, 2, 'Révision acier', 'draft', 'Hausse du prix de l''acier', 1, NULL, NULL);

INSERT INTO boq_sections (id, version_id, code, title, sort_order) VALUES
  (1, 1, 'A', 'Gros œuvre', 1),
  (2, 1, 'B', 'Second œuvre', 2),
  (3, 2, 'A', 'Gros œuvre', 1);

INSERT INTO boq_items (id, version_id, section_id, code, description, unit, quantity, unit_price, sort_order) VALUES
  (1, 1, 1, 'A.1', 'Terrassement', 'm3', 420, 1400, 1),
  (2, 1, 1, 'A.2', 'Béton armé fondations', 'm3', 180, 24000, 2),
  (3, 1, 2, 'B.1', 'Enduits intérieurs', 'm2', 950, 900, 1),
  (4, 2, 3, 'A.1', 'Terrassement', 'm3', 420, 1400, 1);

INSERT INTO boq_item_resources (id, item_id, resource_type, label, unit, quantity, unit_cost, sort_order) VALUES
  (1, 2, 'material', 'Ciment CPJ 42.5', 'sac', 780, 780, 1),
  (2, 2, 'material', 'Acier HA 12', 'tonne', 9.4, 118000, 2),
  (3, 2, 'labour', 'Maçon', 'jour', 120, 3200, 3),
  (4, 3, 'labour', 'Enduiseur', 'jour', 80, 3500, 1);
