import { getDb } from './db.ts';
import { hashPassword } from './auth.ts';
import { DEFAULT_TAX_CONFIG, calculateAlgerianIRG } from './calculations.ts';

export function seedIfEmpty() {
  const db = getDb();
  const userCount = (db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number }).cnt;
  if (userCount > 0) return;

  const insertAll = db.transaction(() => {
    const users = [
      { name: 'Karim Mansouri (Gérant)', username: 'admin', pass: 'admin123', role: 'admin' },
      { name: 'Samira Boudiaf (Comptable)', username: 'comptable', pass: 'compta123', role: 'accountant' },
      { name: 'Yacine Khelifi (Chef de chantier)', username: 'chef', pass: 'chef123', role: 'supervisor' },
      { name: 'Nabil Benali (Magasinier)', username: 'magasinier', pass: 'stock123', role: 'storekeeper' },
      { name: 'Rabah Touati (Chauffeur)', username: 'chauffeur', pass: 'driver123', role: 'driver' },
    ];
    for (const u of users) {
      db.prepare(
        `INSERT INTO users (name, username, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')`
      ).run(u.name, u.username, hashPassword(u.pass), u.role);
    }

    db.prepare(
      `INSERT INTO company_settings (
        id, name, legal_form, address, phone, email, nif, nis, rc, ai,
        currency, fiscal_year_start, language, header_note, footer_note,
        prefix_project, prefix_quote, prefix_proforma, prefix_invoice, prefix_credit,
        prefix_receipt, prefix_delivery, prefix_po, setup_completed, overhead_rate_percent
      ) VALUES (
        1, 'Bâti-Tichy & Services', 'SARL',
        'Cité Somacob, Lot N° 14, 06000 Béjaïa, Algérie',
        '+213 34 12 45 89', 'contact@bati-tichy-dz.com',
        '002106019482715', '099806010045218', '06/00-0842194B21', '06010284910',
        'DZD', '01-01', 'fr',
        'Travaux de Bâtiment, Plomberie, Carrelage, Peinture & Transport',
        'Arrêté la présente pièce conformément à la réglementation algérienne en vigueur.',
        'CH', 'DEV', 'PRO', 'FAC', 'AVO', 'REC', 'BL', 'BC', 1, 8.0
      )`
    ).run();

    db.prepare(
      `INSERT INTO tax_rules (code, name, rate, config_json, effective_date, status, notes, validated_by) VALUES
       ('TVA_NORMAL', 'TVA Taux Normal', 19, '{}', '2026-01-01', 'active', 'Taux normal applicable aux travaux et fournitures', 'Samira Boudiaf'),
       ('TVA_REDUIT', 'TVA Taux Réduit', 9, '{}', '2026-01-01', 'active', 'Taux réduit applicable selon législation', 'Samira Boudiaf'),
       ('TVA_EXONERE', 'Exonéré de TVA', 0, '{}', '2026-01-01', 'active', 'Opérations exonérées', 'Samira Boudiaf'),
       ('CNAS_EMP', 'CNAS Part Salarié', 9, '{}', '2026-01-01', 'active', 'Retenue sécurité sociale salarié 9%', 'Samira Boudiaf'),
       ('CNAS_PAT', 'CNAS Part Employeur', 26, '{}', '2026-01-01', 'active', 'Cotisation patronale sécurité sociale 26%', 'Samira Boudiaf'),
       ('IBS', 'Impôt sur les Bénéfices des Sociétés (IBS BTP)', 19, '{}', '2026-01-01', 'active', 'Taux IBS secteur BTP/Travaux', 'Samira Boudiaf'),
       ('TAP', 'Taxe sur l’Activité Professionnelle (TAP)', 0, '{}', '2026-01-01', 'active', 'Abrogée / configurable selon loi de finances', 'Samira Boudiaf'),
       ('IRG_BAREME', 'Barème Mensuel IRG Salaires (LF Algérie)', 0, ?, '2026-01-01', 'active', 'Exonération <= 30 000 DA, abattement 40% plafonné 1 000 - 1 500 DA', 'Samira Boudiaf')`
    ).run(JSON.stringify(DEFAULT_TAX_CONFIG));

    const lists: Array<[string, string]> = [
      ['expense_category', 'Achat matériaux direct'],
      ['expense_category', 'Sous-traitance'],
      ['expense_category', 'Transport & Livraison'],
      ['expense_category', 'Carburant'],
      ['expense_category', 'Réparation & Pièces'],
      ['expense_category', 'Loyer dépôt & bureau'],
      ['expense_category', 'Frais administratifs'],
      ['expense_category', 'Restauration chantier'],
      ['payment_method', 'Espèces'],
      ['payment_method', 'Virement'],
      ['payment_method', 'Chèque'],
      ['unit', 'U'],
      ['unit', 'm²'],
      ['unit', 'ml'],
      ['unit', 'm³'],
      ['unit', 'Sac'],
      ['unit', 'Litre'],
      ['unit', 'Tonne'],
      ['unit', 'Forfait'],
      ['unit', 'Jour'],
    ];
    for (const [t, l] of lists) {
      db.prepare('INSERT INTO reusable_lists (list_type, label) VALUES (?, ?)').run(t, l);
    }

    const clients = [
      ['company', 'Promoteur Immobilier Soummam SARL', '+213 34 21 88 10', 'direction@soummam-immo.dz', 'Boulevard Krim Belkacem, Béjaïa', '001806015423819', '099806010078941', '06/00-0512987B18', '06014521009', 'Virement', 3000000, 'Client grand compte — résidences'],
      ['individual', 'M. Mourad Bencherif', '+213 550 41 22 90', 'm.bencherif@gmail.com', 'Route du Cap Carbon, Tichy, Béjaïa', '', '', '', '', 'Espèces', 500000, 'Propriétaire Villa Tichy'],
      ['company', 'Hôtel Les Hammadites EURL', '+213 34 81 10 04', 'intendance@hammadites-dz.com', 'Zone Touristique Tichy, 06024 Béjaïa', '001506017782310', '099506010033412', '06/00-0291472B15', '06021104821', 'Chèque', 2000000, 'Rénovation ailes B et C'],
      ['company', 'Direction des Équipements Publics (DEP)', '+213 34 22 19 50', 'marches@dep-bejaia.dz', 'Cité Administrative, Béjaïa', '000006010001234', '099006010000112', '', '', 'Virement', 0, 'Marchés publics'],
      ['individual', 'Mme Nadia Ait-Ali', '+213 661 89 30 12', 'nadia.aitali@yahoo.fr', 'Centre-ville El-Kseur, Béjaïa', '', '', '', '', 'Espèces', 300000, 'Appartement F4 finition'],
    ];
    for (const c of clients) {
      db.prepare(
        `INSERT INTO clients (client_type, name, phone, email, address, nif, nis, rc, ai, payment_terms, credit_limit, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      ).run(...c);
    }

    const suppliers = [
      ['Cimenterie & Matériaux Akbou SARL', 'M. Sofiane Haddad', '+213 34 35 60 11', 'ventes@akbou-materiaux.dz', 'ZI Taharacht, Akbou', '001406019874512', '099406010084521', '06/00-0441239B14', '06051124578', '30 jours'],
      ['Quincaillerie Générale Tazmalt', 'M. Farid Bouzid', '+213 552 14 78 33', 'contact@quinc-tazmalt.dz', 'RN26, Tazmalt, Béjaïa', '001906012349876', '', '06/00-0912345A19', '', 'Comptant'],
      ['Hydraulique & Sanitaire DZ', 'Mme Lynda Kaci', '+213 34 18 90 22', 'commandes@hydrosan-dz.com', 'Ighil Ouazoug, Béjaïa', '002006014455667', '099906010011223', '06/00-0661289B20', '06017788990', 'Virement 15 jours'],
      ['Pièces Auto & Engins El-Kseur', 'M. Malik Rahmani', '+213 770 65 44 19', 'pieces.elkseur@gmail.com', 'Zone Industrielle El-Kseur', '001706018877112', '', '06/00-0338811A17', '', '30 jours'],
    ];
    for (const s of suppliers) {
      db.prepare(
        `INSERT INTO suppliers (name, contact_name, phone, email, address, nif, nis, rc, ai, payment_terms, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      ).run(...s);
    }

    const workers = [
      ['Yacine Khelifi', 'Chef de chantier', 'daily', 5000, 0, 0, '07:30 - 16:30', '2022-03-01', '90-0612-00451', '+213 550 11 22 33', 'Sidi Ali Lebhar, Béjaïa', 'active'],
      ['Sofiane Amrani', 'Plombier', 'daily', 4000, 0, 0, '08:00 - 16:30', '2023-05-15', '93-0612-01284', '+213 551 33 44 55', 'Ihaddaden, Béjaïa', 'active'],
      ['Kamel Brahimi', 'Carreleur', 'daily', 4200, 0, 0, '08:00 - 16:30', '2023-01-10', '91-0612-00891', '+213 662 44 55 66', 'Tichy, Béjaïa', 'active'],
      ['Adel Meziane', 'Peintre', 'daily', 3500, 0, 0, '08:00 - 16:30', '2024-02-01', '95-0612-02310', '+213 771 55 66 77', 'Aokas, Béjaïa', 'active'],
      ['Bilal Saidi', 'Maçon', 'daily', 3800, 0, 0, '08:00 - 16:30', '2022-11-12', '89-0612-00319', '+213 554 66 77 88', 'El-Kseur, Béjaïa', 'active'],
      ['Hakim Ziani', 'Manœuvre', 'daily', 2500, 0, 0, '08:00 - 16:30', '2025-04-01', '99-0612-04112', '+213 665 77 88 99', 'Oued Ghir, Béjaïa', 'active'],
      ['Rabah Touati', 'Chauffeur', 'daily', 3200, 0, 0, '07:00 - 16:30', '2021-09-01', '86-0612-00118', '+213 558 88 99 00', 'Béjaïa Centre', 'active'],
      ['Noureddine Hamdi', 'Électricien', 'daily', 4000, 0, 0, '08:00 - 16:30', '2024-06-15', '94-0612-01902', '+213 773 99 00 11', 'Boulimat, Béjaïa', 'on_leave'],
    ];
    for (const w of workers) {
      db.prepare(
        `INSERT INTO workers (full_name, job_title, wage_type, daily_wage, hourly_rate, monthly_salary, work_schedule, hire_date, cnas_number, phone, address, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(...w);
    }

    const projects = [
      ['CH-2026-001', 2, 'Villa Tichy — Plomberie & Carrelage', 'Route du Cap Carbon, Tichy', 'Plomberie & Sanitaire', '2026-10-05', '2026-12-15', null, 'in_progress', 3, 1450000, 2150000, 62, 0, 'Chantier prioritaire en bord de mer'],
      ['CH-2026-002', 1, 'Résidence Soummam Bloc B — Peinture & Finition', 'Cité Seghir, Béjaïa', 'Peinture & Décoration', '2026-09-20', '2026-11-12', null, 'in_progress', 3, 1900000, 2650000, 78, 1, 'Retard livraison peinture façade signalé'],
      ['CH-2026-003', 3, 'Hôtel Les Hammadites — Rénovation Sanitaires', 'Zone Touristique Tichy', 'Carrelage & Revêtement', '2026-08-10', '2026-10-30', '2026-10-28', 'completed', 3, 980000, 1480000, 100, 0, 'Réception provisoire signée'],
      ['CH-2026-004', 5, 'Appartement El-Kseur — Rénovation complète', 'Centre El-Kseur', 'Travaux généraux BTP', '2026-11-25', '2027-01-20', null, 'waiting_approval', 3, 620000, 890000, 0, 0, 'En attente de validation du devis final'],
    ];
    for (const p of projects) {
      db.prepare(
        `INSERT INTO projects (project_number, client_id, title, address, project_type, start_date, expected_end_date, actual_end_date, status, manager_user_id, expected_cost, expected_selling_price, progress_percent, include_overhead, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(...p);
    }

    db.prepare(
      `INSERT INTO project_phases (project_id, name, sort_order, status) VALUES
       (1, 'Phase 1 : Alimentation & Évacuation Plomberie', 1, 'completed'),
       (1, 'Phase 2 : Pose Carrelage & Faïence', 2, 'in_progress'),
       (1, 'Phase 3 : Pose Appareillage Sanitaire & Finitions', 3, 'planned'),
       (2, 'Phase 1 : Préparation & Enduit murs', 1, 'completed'),
       (2, 'Phase 2 : Peinture Satinée & Façade', 2, 'delayed')`
    ).run();

    db.prepare(
      `INSERT INTO project_tasks (project_id, phase_id, title, assigned_worker_id, planned_start, due_date, status, delay_reason, delay_reported_at, notes) VALUES
       (1, 1, 'Traçage et encastrement tubes multicouche RDC + R+1', 2, '2026-10-06', '2026-10-20', 'completed', '', null, 'Test pression 6 bars OK'),
       (1, 2, 'Chape et pose carrelage Grès Cérame salon & cuisine', 3, '2026-10-22', '2026-11-28', 'in_progress', '', null, 'Avancement 75%'),
       (1, 3, 'Installation mitigeurs, chauffe-eau et WC suspendus', 2, '2026-12-01', '2026-12-14', 'planned', '', null, ''),
       (2, 4, 'Ponçage et deux couches enduit général', 4, '2026-09-22', '2026-10-15', 'completed', '', null, ''),
       (2, 5, 'Application peinture extérieure anti-humidité', 4, '2026-10-18', '2026-11-10', 'delayed', 'Intempéries (pluies continues sur 5 jours) + attente échafaudage complémentaire', '2026-11-08', 'Reprise prévue dès assèchement façade')`
    ).run();

    db.prepare(
      `INSERT INTO change_orders (project_id, reference, title, description, additional_price, additional_cost, approval_status, approved_by, approved_at) VALUES
       (1, 'AVN-CH01-01', 'Extension réseau eau chaude terrasse + pergola', 'Ajout de 2 points d’eau terrasse supérieure et pose faïence murale extérieure 18 m²', 185000, 110000, 'approved', 1, '2026-11-03 10:15:00'),
       (2, 'AVN-CH02-01', 'Traitement hydrofuge pignon Nord', 'Application résine hydrofuge complémentaire sur 95 m²', 120000, 72000, 'pending', null, null)`
    ).run();

    db.prepare(
      `INSERT INTO contracts (reference, client_id, project_id, signing_date, start_date, planned_end_date, contract_amount, retention_rate, retention_amount, status, notes) VALUES
       ('CTR-2026-001', 2, 1, '2026-10-02', '2026-10-05', '2026-12-15', 2150000, 5, 107500, 'active', 'Marché forfaitaire Villa Tichy avec retenue de garantie 5%'),
       ('CTR-2026-002', 1, 2, '2026-09-18', '2026-09-20', '2026-11-12', 2650000, 5, 132500, 'active', 'Contrat sous-traitance peinture Résidence Soummam')`
    ).run();

    db.prepare(
      `INSERT INTO contract_milestones (contract_id, title, due_date, expected_amount, received_amount, status, notes) VALUES
       (1, 'Acompte démarrage travaux (30%)', '2026-10-05', 645000, 645000, 'paid', 'Encaissé par chèque'),
       (1, 'Situation N°1 — Plomberie brute & début carrelage (40%)', '2026-11-10', 860000, 500000, 'partial', 'Reste 360 000 DA à encaisser'),
       (1, 'Réception finale hors retenue de garantie (25%)', '2026-12-15', 537500, 0, 'pending', ''),
       (2, 'Avance forfaitaire (25%)', '2026-09-20', 662500, 662500, 'paid', ''),
       (2, 'Situation mensuelle Octobre (45%)', '2026-11-05', 1192500, 800000, 'partial', '')`
    ).run();

    db.prepare(
      `INSERT INTO services (code, name, unit, default_price, cost_rate, tva_rate) VALUES
       ('SRV-PLB-01', 'Installation réseau plomberie multicouche complet', 'Forfait', 450000, 260000, 19),
       ('SRV-CAR-01', 'Fourniture et pose carrelage Grès Cérame 60x60', 'm²', 3200, 1950, 19),
       ('SRV-PNT-01', 'Peinture satinée intérieure 2 couches + enduit', 'm²', 950, 520, 19),
       ('SRV-TRN-01', 'Transport matériel camion 19T', 'Voyage', 18000, 9500, 19)`
    ).run();

    const materials = [
      ['Ciment CPJ 42.5 (Sac 50kg)', 'MAT-CIM-01', 'Ciment & Liants', 'Sac', 185, 680, 780, 50, 1, 'Dépôt principal'],
      ['Sable lavé d’Oued', 'MAT-SAB-01', 'Agrégats & Sable', 'm³', 24, 3200, 4000, 10, 1, 'Dépôt principal'],
      ['Carrelage Grès Cérame 60x60 Beige', 'MAT-CAR-60', 'Carrelage & Faïence', 'm²', 140, 1850, 2400, 40, 2, 'Chantier CH-2026-001'],
      ['Tube Multicouche Ø20 Isolé (Rouleau 50m)', 'MAT-PLB-20', 'Plomberie & Tubes', 'Rouleau', 4, 14500, 18000, 6, 3, 'Dépôt principal'],
      ['Peinture Satinée Acrylique 15kg Blanc', 'MAT-PNT-15', 'Peinture & Enduits', 'Seau', 32, 6800, 8500, 15, 2, 'Chantier CH-2026-002'],
      ['Colle Carrelage C2S1 (Sac 25kg)', 'MAT-COL-25', 'Ciment & Liants', 'Sac', 65, 950, 1250, 25, 1, 'Dépôt principal'],
      ['Collecteur Laiton 4 Départs 1"', 'MAT-PLB-CL', 'Plomberie & Tubes', 'U', 12, 4200, 5500, 4, 3, 'Dépôt principal'],
    ];
    for (const m of materials) {
      db.prepare(
        `INSERT INTO materials (name, code, category, unit, current_quantity, purchase_price, selling_price, min_stock_level, preferred_supplier_id, storage_location, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      ).run(...m);
    }

    db.prepare(
      `INSERT INTO stock_movements (movement_type, material_id, quantity, unit_cost, total_cost, project_id, supplier_id, from_location, to_location, reference, notes, movement_date, user_id) VALUES
       ('entry', 1, 250, 680, 170000, null, 1, 'Fournisseur', 'Dépôt principal', 'BL-AKB-201', 'Approvisionnement mensuel ciment', '2026-10-04', 4),
       ('exit', 1, 65, 680, 44200, 1, null, 'Dépôt principal', 'Villa Tichy', 'BS-2026-011', 'Chape carrelage RDC', '2026-10-23', 4),
       ('exit', 3, 120, 1850, 222000, 1, null, 'Dépôt principal', 'Villa Tichy', 'BS-2026-014', 'Lot carrelage salon + chambres', '2026-10-25', 4),
       ('exit', 4, 6, 14500, 87000, 1, null, 'Dépôt principal', 'Villa Tichy', 'BS-2026-015', 'Colonnes alimentation SDB', '2026-10-12', 4),
       ('exit', 5, 28, 6800, 190400, 2, null, 'Dépôt principal', 'Résidence Soummam', 'BS-2026-019', 'Peinture intérieure couches 1 & 2', '2026-11-02', 4),
       ('exit', 6, 45, 950, 42750, 1, null, 'Dépôt principal', 'Villa Tichy', 'BS-2026-022', 'Colle C2S1 pose 60x60', '2026-11-06', 4)`
    ).run();

    const vehicles = [
      ['truck', 'Camion Benne Renault Kerax 19T', 'Renault Trucks', '04819-118-06', 7, '2021-06-15', 7800000, 148200, 0, 18000, 'on_project', 1, '2026-12-05', '2027-01-15', 'Assurance arrive à échéance le 05/12/2026'],
      ['excavator', 'Mini-Pelle CAT 305.5E', 'Caterpillar', 'ENG-CAT-305-02', 7, '2022-09-10', 9200000, 0, 1490, 22000, 'under_maintenance', null, '2027-04-20', '2027-03-10', 'Révision hydraulique en cours'],
      ['vehicle', 'Fourgon Utilitaire Peugeot Boxer', 'Peugeot', '09142-123-06', 1, '2023-03-20', 4100000, 64800, 0, 7500, 'on_project', 2, '2027-02-18', '2026-12-10', 'Contrôle technique proche'],
      ['mixer', 'Bétonnière Altrad 350L Diesel', 'Altrad', 'ENG-BET-350-04', null, '2024-01-10', 380000, 0, 410, 3500, 'available', null, null, null, 'Disponible au dépôt'],
    ];
    for (const v of vehicles) {
      db.prepare(
        `INSERT INTO vehicles (asset_type, name, brand, registration, driver_worker_id, purchase_date, purchase_price, current_mileage, current_engine_hours, usage_rate_per_day, status, current_project_id, insurance_expiry, inspection_expiry, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(...v);
    }

    db.prepare(
      `INSERT INTO project_assignments (project_id, worker_id, vehicle_id, usage_hours, role_note) VALUES
       (1, null, 1, 32, 'Approvisionnement matériaux & évacuation gravats'),
       (2, null, 3, 40, 'Transport échafaudage et seaux peinture')`
    ).run();

    db.prepare(
      `INSERT INTO fuel_entries (date, vehicle_id, driver_worker_id, liters, price_per_liter, total_cost, odometer_before, odometer_after, project_id, trip_purpose, fuel_station, notes, user_id) VALUES
       ('2026-11-04', 1, 7, 110, 29.01, 3191.1, 147650, 147940, 1, 'Livraison sable et ciment Villa Tichy', 'Naftal Tichy', 'Plein gasoil normal', 5),
       ('2026-11-11', 1, 7, 125, 29.01, 3626.25, 147940, 148200, 1, 'Rotations chantier Tichy / Akbou', 'Naftal Akbou', 'Consommation élevée en côte', 5),
       ('2026-11-14', 3, 1, 55, 29.01, 1595.55, 64320, 64800, 2, 'Déplacement équipe peinture Béjaïa', 'Naftal Sidi Ali Lebhar', '', 3)`
    ).run();

    db.prepare(
      `INSERT INTO repair_orders (order_number, vehicle_id, repair_date, problem_category, description, priority, workshop, parts_used, parts_cost, labor_cost, towing_cost, total_cost, downtime_days, status, project_id, notes) VALUES
       ('OR-2026-014', 2, '2026-11-15', 'hydraulic', 'Fuite vérin godet + remplacement flexibles HP', 'urgent', 'Atelier Hydraulique El-Kseur', '2 flexibles HP 3/4 + kit joints vérin', 48000, 22000, 12000, 82000, 3, 'in_progress', null, 'Pièces posées, purge circuit prévue demain'),
       ('OR-2026-011', 1, '2026-10-27', 'brakes', 'Remplacement plaquettes frein avant + réglage tambour', 'normal', 'Garage Mécanique Akbou', 'Jeu plaquettes Kerax + liquide DOT4', 34000, 12000, 0, 46000, 1, 'completed', 1, 'Facturé sur entretien flotte Tichy')`
    ).run();

    db.prepare(
      `INSERT INTO maintenance_rules (vehicle_id, rule_name, trigger_type, interval_value, last_done_value, last_done_date, next_due_value, next_due_date, active) VALUES
       (1, 'Vidange moteur + filtre à huile', 'km', 5000, 143500, '2026-09-12', 148500, '2026-11-25', 1),
       (2, 'Inspection circuit hydraulique 500h', 'hours', 500, 1000, '2026-08-01', 1500, '2026-11-22', 1),
       (3, 'Contrôle freinage & vidange 10 000 km', 'km', 10000, 56000, '2026-07-15', 66000, '2026-12-20', 1)`
    ).run();

    db.prepare(
      `INSERT INTO tools (name, code, category, purchase_date, condition, storage_location, status, assigned_worker_id, assigned_vehicle_id, assigned_project_id, notes) VALUES
       ('Perforateur Burineur Bosch GBH 2-26', 'OUT-PER-01', 'Électroportatif', '2024-03-12', 'good', 'Chantier CH-2026-001', 'assigned', 2, null, 1, 'Avec coffret forets SDS+'),
       ('Niveau Laser Rotatif DeWalt', 'OUT-LAS-02', 'Mesure & Traçage', '2025-01-18', 'new', 'Chantier CH-2026-001', 'assigned', 3, null, 1, 'Avec trépied aluminium'),
       ('Poste à souder PPR 1500W', 'OUT-PPR-03', 'Plomberie', '2024-06-05', 'good', 'Dépôt principal', 'available', null, null, null, 'Matrices 20/25/32/40 complètes'),
       ('Échafaudage roulant Alu 6m', 'OUT-ECH-04', 'Accès & Sécurité', '2023-09-20', 'fair', 'Chantier CH-2026-002', 'assigned', 4, null, 2, '4 roues avec freins OK')`
    ).run();

    db.prepare(
      `INSERT INTO tool_checkouts (tool_id, action_type, worker_id, vehicle_id, project_id, issued_date, expected_return_date, actual_return_date, condition_out, notes, user_id) VALUES
       (1, 'checkout', 2, null, 1, '2026-10-06', '2026-12-15', null, 'good', 'Remis à Sofiane Amrani pour Villa Tichy', 4),
       (2, 'checkout', 3, null, 1, '2026-10-22', '2026-12-01', null, 'new', 'Remis à Kamel Brahimi pour pose carrelage', 4),
       (4, 'checkout', 4, null, 2, '2026-09-22', '2026-11-25', null, 'fair', 'Affecté Résidence Soummam', 4)`
    ).run();

    db.prepare(
      `INSERT INTO commercial_documents (doc_type, doc_number, client_id, project_id, issue_date, due_date, status, discount_percent, total_ht, total_tva, total_ttc, amount_paid, notes, created_by, locked_at) VALUES
       ('devis', 'DEV-2026-001', 2, 1, '2026-09-28', '2026-10-28', 'accepted', 0, 1806722.69, 343277.31, 2150000, 0, 'Devis accepté Villa Tichy', 1, '2026-09-28 14:00:00'),
       ('facture', 'FAC-2026-001', 2, 1, '2026-10-10', '2026-11-10', 'partial', 0, 1264705.88, 240294.12, 1505000, 1145000, 'Acompte + Situation N°1 Villa Tichy', 2, '2026-10-10 09:30:00'),
       ('facture', 'FAC-2026-002', 1, 2, '2026-11-02', '2026-11-17', 'overdue', 0, 1558823.53, 296176.47, 1855000, 1462500, 'Situation Octobre Résidence Soummam — solde échu le 17/11', 2, '2026-11-02 11:00:00'),
       ('facture', 'FAC-2026-003', 3, 3, '2026-10-29', '2026-11-29', 'paid', 0, 1243697.48, 236302.52, 1480000, 1480000, 'Facture définitive Hôtel Les Hammadites', 2, '2026-10-29 16:00:00'),
       ('devis', 'DEV-2026-002', 5, 4, '2026-11-16', '2026-12-16', 'issued', 5, 747899.16, 142100.84, 890000, 0, 'Proposition rénovation appartement F4 El-Kseur', 1, '2026-11-16 10:00:00')`
    ).run();

    db.prepare(
      `INSERT INTO commercial_lines (document_id, description, unit, quantity, unit_price, tva_rate, line_ht, line_tva, line_ttc, sort_order) VALUES
       (2, 'Installation complète réseau plomberie multicouche RDC + R+1', 'Forfait', 1, 450000, 19, 450000, 85500, 535500, 1),
       (2, 'Fourniture et pose carrelage Grès Cérame 60x60', 'm²', 254.5956, 3200, 19, 814705.88, 154794.12, 969500, 2),
       (3, 'Préparation murs, enduit général et peinture satinée 2 couches', 'm²', 1640.8669, 950, 19, 1558823.53, 296176.47, 1855000, 1),
       (4, 'Rénovation complète 14 salles de bain (démolition, étanchéité, carrelage)', 'Forfait', 1, 1243697.48, 19, 1243697.48, 236302.52, 1480000, 1),
       (5, 'Travaux généraux rénovation F4 El-Kseur (plomberie, peinture, carrelage)', 'Forfait', 1, 787262.27, 19, 787262.27, 142100.84, 890000, 1)`
    ).run();

    db.prepare(
      `INSERT INTO purchases (po_number, supplier_invoice_no, supplier_id, project_id, order_date, status, total_ht, total_tva, total_ttc, amount_paid, notes, created_by) VALUES
       ('BC-2026-011', 'FA-AKB-884', 1, 1, '2026-10-04', 'paid', 170000, 32300, 202300, 202300, '250 sacs Ciment CPJ 42.5 livrés', 4),
       ('BC-2026-015', 'FA-HYD-312', 3, 1, '2026-11-05', 'partial_paid', 195000, 37050, 232050, 120000, 'Tubes multicouche + collecteurs laiton', 4)`
    ).run();

    db.prepare(
      `INSERT INTO purchase_lines (purchase_id, material_id, description, quantity, unit_price, tva_rate, line_total) VALUES
       (1, 1, 'Ciment CPJ 42.5 (Sac 50kg)', 250, 680, 19, 202300),
       (2, 4, 'Tube Multicouche Ø20 Isolé', 10, 14500, 19, 172550),
       (2, 7, 'Collecteur Laiton 4 Départs', 12, 4200, 19, 59500)`
    ).run();

    db.prepare(
      `INSERT INTO payments (receipt_number, direction, client_id, supplier_id, document_id, purchase_id, milestone_id, payment_date, amount, payment_method, reference, notes, user_id) VALUES
       ('REC-2026-001', 'inflow', 2, null, 2, null, 1, '2026-10-05', 645000, 'Chèque', 'CHQ-BNA-44120', 'Acompte démarrage Villa Tichy', 2),
       ('REC-2026-002', 'inflow', 2, null, 2, null, 2, '2026-11-10', 500000, 'Espèces', 'ESP-011', 'Versement partiel Situation N°1', 2),
       ('REC-2026-003', 'inflow', 1, null, 3, null, 4, '2026-11-03', 662500, 'Virement', 'VIR-CPA-9012', 'Avance Résidence Soummam', 2),
       ('REC-2026-004', 'inflow', 1, null, 3, null, 5, '2026-11-12', 800000, 'Virement', 'VIR-CPA-9341', 'Règlement partiel situation Octobre', 2),
       ('REC-2026-005', 'inflow', 3, null, 4, null, null, '2026-11-04', 1480000, 'Chèque', 'CHQ-BEA-7781', 'Solde Hôtel Les Hammadites', 2),
       ('PAY-FRN-001', 'outflow', null, 1, null, 1, null, '2026-10-08', 202300, 'Virement', 'VIR-FRN-104', 'Règlement Cimenterie Akbou', 2),
       ('PAY-FRN-002', 'outflow', null, 3, null, 2, null, '2026-11-08', 120000, 'Espèces', 'ESP-FRN-009', 'Acompte Hydraulique DZ', 2)`
    ).run();

    const octDays = [
      '2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08',
      '2026-10-11','2026-10-12','2026-10-13','2026-10-14','2026-10-15',
      '2026-10-18','2026-10-19','2026-10-20','2026-10-21','2026-10-22',
      '2026-10-25','2026-10-26','2026-10-27','2026-10-28','2026-10-29',
    ];
    for (const d of octDays) {
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 1, 1, 'present', 1, 0, 0, 'approved', 3, 1, '2026-10-31 18:00:00')`).run(d);
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 2, 1, 'present', 1, 0, ?, 'approved', 3, 1, '2026-10-31 18:00:00')`).run(d, d === '2026-10-15' ? 10000 : 0);
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 3, 1, 'present', 1, 0, 0, 'approved', 3, 1, '2026-10-31 18:00:00')`).run(d);
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 4, 2, 'present', 1, 0, ?, 'approved', 3, 1, '2026-10-31 18:00:00')`).run(d, d === '2026-10-18' ? 8000 : 0);
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 5, 2, 'present', 1, 0, 0, 'approved', 3, 1, '2026-10-31 18:00:00')`).run(d);
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 6, 1, 'present', 1, 0, 0, 'approved', 3, 1, '2026-10-31 18:00:00')`).run(d);
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 7, 1, 'present', 1, 0, 0, 'approved', 3, 1, '2026-10-31 18:00:00')`).run(d);
    }

    const novApprovedDays = [
      '2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05',
      '2026-11-08','2026-11-09','2026-11-10','2026-11-11','2026-11-12',
      '2026-11-15','2026-11-16',
    ];
    for (const d of novApprovedDays) {
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 1, 1, 'present', 1, 0, 0, 'approved', 3, 1, '2026-11-17 09:00:00')`).run(d);
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 2, 1, 'present', 1, 0, ?, 'approved', 3, 1, '2026-11-17 09:00:00')`).run(d, d === '2026-11-10' ? 5000 : 0);
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 3, 1, 'present', 1, 0, 0, 'approved', 3, 1, '2026-11-17 09:00:00')`).run(d);
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 4, 2, 'present', 1, 0, 0, 'approved', 3, 1, '2026-11-17 09:00:00')`).run(d);
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 5, 2, 'present', 1, 0, 0, 'approved', 3, 1, '2026-11-17 09:00:00')`).run(d);
      if (d === '2026-11-11') {
        db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, notes, approval_status, entered_by, approved_by, approved_at) VALUES (?, 6, 1, 'half_day', 0.5, 0, 0, 'Matinée déchargement carrelage Villa Tichy', 'approved', 3, 1, '2026-11-17 09:00:00')`).run(d);
        db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, notes, approval_status, entered_by, approved_by, approved_at) VALUES (?, 6, 2, 'half_day', 0.5, 0, 0, 'Après-midi nettoyage Résidence Soummam', 'approved', 3, 1, '2026-11-17 09:00:00')`).run(d);
      } else {
        db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 6, 1, 'present', 1, 0, 0, 'approved', 3, 1, '2026-11-17 09:00:00')`).run(d);
      }
      db.prepare(`INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, approval_status, entered_by, approved_by, approved_at) VALUES (?, 7, 1, 'present', 1, 0, 0, 'approved', 3, 1, '2026-11-17 09:00:00')`).run(d);
    }

    db.prepare(
      `INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, notes, approval_status, entered_by) VALUES
       ('2026-11-19', 1, 1, 'present', 1, 0, 0, 'Supervision chantier Tichy', 'pending', 3),
       ('2026-11-19', 2, 1, 'present', 1, 1, 0, 'Pose collecteurs SDB R+1', 'pending', 3),
       ('2026-11-19', 3, 1, 'present', 1, 0, 0, 'Pose faïence cuisine', 'pending', 3),
       ('2026-11-19', 4, 2, 'present', 1, 0, 0, 'Reprise pignon Soummam', 'pending', 3),
       ('2026-11-19', 5, 2, 'half_day', 0.5, 0, 0, 'Demi-journée rattrapage enduit', 'pending', 3),
       ('2026-11-19', 6, 1, 'present', 1, 0, 0, 'Aide carreleur', 'pending', 3),
       ('2026-11-19', 7, 1, 'present', 1, 0, 0, 'Transport sable', 'pending', 3),
       ('2026-11-19', 8, null, 'paid_leave', 1, 0, 0, 'Congé annuel validé', 'approved', 3)`
    ).run();

    const ppRes = db
      .prepare(
        `INSERT INTO payroll_periods (month, year, status, approved_by, approved_at, payment_method, notes)
         VALUES (10, 2026, 'approved', 1, '2026-11-01 10:00:00', 'Espèces', 'Paie Octobre 2026 validée et soldée')`
      )
      .run();
    const octPeriodId = ppRes.lastInsertRowid as number;

    const workerWages: Array<[number, number, number, number]> = [
      [1, 20, 5000, 0],
      [2, 20, 4000, 10000],
      [3, 20, 4200, 0],
      [4, 20, 3500, 8000],
      [5, 20, 3800, 0],
      [6, 20, 2500, 0],
      [7, 20, 3200, 0],
    ];
    for (const [wid, days, dw, adv] of workerWages) {
      const gross = days * dw;
      const cnasEmp = Math.round(gross * 0.09);
      const cnasPat = Math.round(gross * 0.26);
      const taxable = gross - cnasEmp;
      const irg = calculateAlgerianIRG(taxable, DEFAULT_TAX_CONFIG);
      const net = Math.max(0, gross - cnasEmp - irg - adv);
      db.prepare(
        `INSERT INTO payslips (payroll_period_id, worker_id, worked_days, overtime_hours, base_gross, overtime_pay, bonus_amount, piecework_amount, gross_salary, cnas_employee, cnas_employer, irg_amount, advances_deducted, penalties_deducted, other_deductions, net_pay, locked)
         VALUES (?, ?, ?, 0, ?, 0, 0, 0, ?, ?, ?, ?, ?, 0, 0, ?, 1)`
      ).run(octPeriodId, wid, days, gross, gross, cnasEmp, cnasPat, irg, adv, net);
    }

    db.prepare(
      `INSERT INTO expenses (expense_date, category, description, amount, payment_method, project_id, vehicle_id, is_overhead, notes, user_id) VALUES
       ('2026-11-03', 'Sous-traitance', 'Location nacelle élévatrice 2 jours Résidence Soummam', 45000, 'Espèces', 2, null, 0, 'Bon sous-traitant N°12', 2),
       ('2026-11-07', 'Restauration chantier', 'Repas équipe Villa Tichy semaine 1', 14500, 'Espèces', 1, null, 0, '', 3),
       ('2026-11-09', 'Loyer dépôt & bureau', 'Loyer mensuel dépôt matériel & bureau Béjaïa', 65000, 'Virement', null, null, 1, 'Novembre 2026', 2),
       ('2026-11-12', 'Frais administratifs', 'Fournitures bureau & timbres fiscaux', 6800, 'Espèces', null, null, 1, '', 2)`
    ).run();

    db.prepare(
      `INSERT INTO treasury_transactions (tx_date, tx_type, account, to_account, category, amount, payment_method, project_id, client_id, supplier_id, bank_reconciled, bank_statement_ref, notes, user_id) VALUES
       ('2026-10-01', 'bank_inflow', 'Banque', null, 'Apport initial / Solde ouverture', 2500000, 'Virement', null, null, null, 1, 'REL-CPA-001', 'Solde ouverture compte CPA Béjaïa', 1),
       ('2026-10-01', 'cash_inflow', 'Caisse', null, 'Fond de caisse ouverture', 450000, 'Espèces', null, null, null, 1, '', 'Solde initial caisse entreprise', 1),
       ('2026-10-05', 'bank_inflow', 'Banque', null, 'Règlement client', 645000, 'Chèque', 1, 2, null, 1, 'REL-CPA-014', 'Acompte Villa Tichy', 2),
       ('2026-11-03', 'bank_inflow', 'Banque', null, 'Règlement client', 662500, 'Virement', 2, 1, null, 1, 'REL-CPA-089', 'Avance Soummam', 2),
       ('2026-11-04', 'bank_inflow', 'Banque', null, 'Règlement client', 1480000, 'Chèque', 3, 3, null, 1, 'REL-CPA-095', 'Solde Hôtel Hammadites', 2),
       ('2026-11-05', 'internal_transfer', 'Banque', 'Caisse', 'Transfert interne Banque -> Caisse', 400000, 'Virement', null, null, null, 1, 'REL-CPA-099', 'Retrait espèces pour paie et dépenses chantier', 2),
       ('2026-11-08', 'cash_outflow', 'Caisse', null, 'Règlement fournisseur', 120000, 'Espèces', 1, null, 3, 0, '', 'Acompte Hydraulique DZ', 2),
       ('2026-11-09', 'bank_outflow', 'Banque', null, 'Loyer dépôt & bureau', 65000, 'Virement', null, null, null, 1, 'REL-CPA-104', 'Loyer Novembre', 2),
       ('2026-11-10', 'cash_inflow', 'Caisse', null, 'Règlement client', 500000, 'Espèces', 1, 2, null, 0, '', 'Versement Situation N°1 Villa Tichy', 2),
       ('2026-11-12', 'bank_inflow', 'Banque', null, 'Règlement client', 800000, 'Virement', 2, 1, null, 0, '', 'Règlement partiel Soummam (en attente pointage relevé)', 2),
       ('2026-11-14', 'cash_outflow', 'Caisse', null, 'Sous-traitance', 45000, 'Espèces', 2, null, null, 0, '', 'Location nacelle', 2),
       ('2026-11-15', 'cash_outflow', 'Caisse', null, 'Carburant & Entretien', 8412.9, 'Espèces', 1, null, null, 0, '', 'Bons gasoil Naftal', 2)`
    ).run();

    db.prepare(
      `INSERT INTO cash_closings (closing_date, opening_balance, cash_inflows, cash_outflows, expected_closing, counted_balance, difference, notes, closed_by) VALUES
       ('2026-11-18', 1176587.10, 0, 0, 1176587.10, 1176587.10, 0, 'Clôture caisse conforme — aucun écart', 2)`
    ).run();

    db.prepare(
      `INSERT INTO documents (title, category, file_name, stored_path, mime_type, file_size, doc_date, related_type, related_id, notes, uploaded_by) VALUES
       ('Plan plomberie Villa Tichy RDC+R1', 'projects', 'plan_plomberie_tichy.pdf', 'Projects/plan_plomberie_tichy.pdf', 'application/pdf', 425600, '2026-10-03', 'project', 1, 'Plan validé avec le propriétaire', 3),
       ('Contrat signé Villa Tichy CTR-2026-001', 'contracts', 'contrat_villa_tichy.pdf', 'Contracts/contrat_villa_tichy.pdf', 'application/pdf', 682100, '2026-10-02', 'project', 1, 'Original paraphé et cacheté', 1),
       ('Carte grise & Assurance Renault Kerax', 'vehicles', 'assurance_kerax_2026.pdf', 'Vehicles/assurance_kerax_2026.pdf', 'application/pdf', 214500, '2026-01-05', 'vehicle', 1, 'Échéance renouvellement 05/12/2026', 1)`
    ).run();

    db.prepare(
      `INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, old_value, new_value) VALUES
       (1, 'Karim Mansouri (Gérant)', 'APPROVE', 'payroll_period', '1', 'draft', 'approved'),
       (2, 'Samira Boudiaf (Comptable)', 'CREATE', 'facture', 'FAC-2026-001', '', 'Total TTC: 1 505 000 DA'),
       (1, 'Karim Mansouri (Gérant)', 'APPROVE', 'change_order', 'AVN-CH01-01', 'pending', 'approved')`
    ).run();
  });

  insertAll();
}
