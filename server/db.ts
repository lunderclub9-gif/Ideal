import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export const DATA_DIR = path.resolve(process.env.GESTIONPRO_DATA_DIR || path.resolve(process.cwd(), 'data'));
export const DB_PATH = path.join(DATA_DIR, 'gestionpro.db');
export const DOCS_DIR = path.join(DATA_DIR, 'Documents');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

const DOC_SUBDIRS = [
  'Invoices',
  'Projects',
  'Vehicles',
  'Payroll',
  'Suppliers',
  'Contracts',
  'Clients',
  'Equipment',
  'General',
];

export function ensureDirectories() {
  for (const dir of [DATA_DIR, DOCS_DIR, BACKUPS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  for (const sub of DOC_SUBDIRS) {
    const p = path.join(DOCS_DIR, sub);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  }
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    ensureDirectories();
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    runMigrations(dbInstance);
  }
  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function reopenDb(): Database.Database {
  closeDb();
  return getDb();
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = db
    .prepare('SELECT version FROM schema_migrations')
    .all()
    .map((r: any) => r.version as number);

  if (!applied.includes(1)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','accountant','supervisor','storekeeper','driver')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
        last_login TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS company_settings (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        name TEXT NOT NULL DEFAULT 'Mon entreprise',
        legal_form TEXT DEFAULT 'SARL',
        address TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        nif TEXT DEFAULT '',
        nis TEXT DEFAULT '',
        rc TEXT DEFAULT '',
        ai TEXT DEFAULT '',
        currency TEXT NOT NULL DEFAULT 'DZD',
        fiscal_year_start TEXT NOT NULL DEFAULT '01-01',
        language TEXT NOT NULL DEFAULT 'fr',
        logo_data TEXT DEFAULT '',
        stamp_data TEXT DEFAULT '',
        header_note TEXT DEFAULT '',
        footer_note TEXT DEFAULT 'Merci de votre confiance.',
        prefix_project TEXT NOT NULL DEFAULT 'CH',
        prefix_quote TEXT NOT NULL DEFAULT 'DEV',
        prefix_proforma TEXT NOT NULL DEFAULT 'PRO',
        prefix_invoice TEXT NOT NULL DEFAULT 'FAC',
        prefix_credit TEXT NOT NULL DEFAULT 'AVO',
        prefix_receipt TEXT NOT NULL DEFAULT 'REC',
        prefix_delivery TEXT NOT NULL DEFAULT 'BL',
        prefix_po TEXT NOT NULL DEFAULT 'BC',
        auto_backup_time TEXT NOT NULL DEFAULT '19:00',
        auto_backup_keep_daily INTEGER NOT NULL DEFAULT 30,
        auto_backup_keep_monthly INTEGER NOT NULL DEFAULT 12,
        setup_completed INTEGER NOT NULL DEFAULT 1,
        inactivity_minutes INTEGER NOT NULL DEFAULT 30,
        overhead_rate_percent REAL NOT NULL DEFAULT 8.0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tax_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        rate REAL NOT NULL DEFAULT 0,
        config_json TEXT DEFAULT '{}',
        effective_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
        notes TEXT DEFAULT '',
        validated_by TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS reusable_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_type TEXT NOT NULL,
        label TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_type TEXT NOT NULL DEFAULT 'company' CHECK(client_type IN ('individual','company')),
        name TEXT NOT NULL,
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        address TEXT DEFAULT '',
        nif TEXT DEFAULT '',
        nis TEXT DEFAULT '',
        rc TEXT DEFAULT '',
        ai TEXT DEFAULT '',
        payment_terms TEXT DEFAULT 'Virement',
        credit_limit REAL DEFAULT 0,
        notes TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','blocked')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_name TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        address TEXT DEFAULT '',
        nif TEXT DEFAULT '',
        nis TEXT DEFAULT '',
        rc TEXT DEFAULT '',
        ai TEXT DEFAULT '',
        payment_terms TEXT DEFAULT '30 jours',
        notes TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        job_title TEXT NOT NULL,
        wage_type TEXT NOT NULL DEFAULT 'daily' CHECK(wage_type IN ('daily','monthly','hourly','piecework')),
        daily_wage REAL NOT NULL DEFAULT 0,
        hourly_rate REAL NOT NULL DEFAULT 0,
        monthly_salary REAL NOT NULL DEFAULT 0,
        work_schedule TEXT DEFAULT '08:00 - 16:30',
        hire_date TEXT NOT NULL,
        cnas_number TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        address TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','on_leave','terminated')),
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_number TEXT NOT NULL UNIQUE,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        title TEXT NOT NULL,
        address TEXT DEFAULT '',
        project_type TEXT NOT NULL DEFAULT 'Travaux généraux',
        start_date TEXT NOT NULL,
        expected_end_date TEXT,
        actual_end_date TEXT,
        status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('draft','waiting_approval','in_progress','suspended','completed','cancelled')),
        manager_user_id INTEGER REFERENCES users(id),
        expected_cost REAL NOT NULL DEFAULT 0,
        expected_selling_price REAL NOT NULL DEFAULT 0,
        progress_percent REAL NOT NULL DEFAULT 0,
        include_overhead INTEGER NOT NULL DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS project_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        worker_id INTEGER REFERENCES workers(id),
        vehicle_id INTEGER,
        usage_hours REAL DEFAULT 0,
        role_note TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS project_phases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('planned','in_progress','completed','delayed'))
      );

      CREATE TABLE IF NOT EXISTS project_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        phase_id INTEGER REFERENCES project_phases(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        assigned_worker_id INTEGER REFERENCES workers(id),
        planned_start TEXT,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','delayed','completed')),
        delay_reason TEXT DEFAULT '',
        delay_reported_at TEXT,
        notes TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS change_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        reference TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        additional_price REAL NOT NULL DEFAULT 0,
        additional_cost REAL NOT NULL DEFAULT 0,
        approval_status TEXT NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected')),
        document_id INTEGER,
        approved_by INTEGER REFERENCES users(id),
        approved_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference TEXT NOT NULL UNIQUE,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        project_id INTEGER NOT NULL REFERENCES projects(id),
        signing_date TEXT NOT NULL,
        start_date TEXT NOT NULL,
        planned_end_date TEXT,
        contract_amount REAL NOT NULL DEFAULT 0,
        retention_rate REAL NOT NULL DEFAULT 5,
        retention_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','completed','cancelled')),
        notes TEXT DEFAULT '',
        document_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS contract_milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        due_date TEXT NOT NULL,
        expected_amount REAL NOT NULL DEFAULT 0,
        received_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','partial','paid','overdue')),
        notes TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT 'Forfait',
        default_price REAL NOT NULL DEFAULT 0,
        cost_rate REAL NOT NULL DEFAULT 0,
        tva_rate REAL NOT NULL DEFAULT 19,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        unit TEXT NOT NULL,
        current_quantity REAL NOT NULL DEFAULT 0,
        purchase_price REAL NOT NULL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        min_stock_level REAL NOT NULL DEFAULT 0,
        preferred_supplier_id INTEGER REFERENCES suppliers(id),
        storage_location TEXT NOT NULL DEFAULT 'Dépôt principal',
        barcode TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movement_type TEXT NOT NULL CHECK(movement_type IN ('entry','exit','return','loss','transfer','adjustment')),
        material_id INTEGER NOT NULL REFERENCES materials(id),
        quantity REAL NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0,
        total_cost REAL NOT NULL DEFAULT 0,
        project_id INTEGER REFERENCES projects(id),
        supplier_id INTEGER REFERENCES suppliers(id),
        from_location TEXT DEFAULT '',
        to_location TEXT DEFAULT '',
        reference TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        movement_date TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_type TEXT NOT NULL CHECK(asset_type IN ('vehicle','truck','excavator','mixer','compressor','pump','scaffolding')),
        name TEXT NOT NULL,
        brand TEXT DEFAULT '',
        registration TEXT NOT NULL UNIQUE,
        driver_worker_id INTEGER REFERENCES workers(id),
        purchase_date TEXT,
        purchase_price REAL DEFAULT 0,
        current_mileage REAL NOT NULL DEFAULT 0,
        current_engine_hours REAL NOT NULL DEFAULT 0,
        usage_rate_per_day REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','on_project','broken_down','under_maintenance')),
        current_project_id INTEGER REFERENCES projects(id),
        insurance_expiry TEXT,
        inspection_expiry TEXT,
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS fuel_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
        driver_worker_id INTEGER REFERENCES workers(id),
        liters REAL NOT NULL,
        price_per_liter REAL NOT NULL,
        total_cost REAL NOT NULL,
        odometer_before REAL DEFAULT 0,
        odometer_after REAL DEFAULT 0,
        project_id INTEGER REFERENCES projects(id),
        trip_purpose TEXT DEFAULT '',
        fuel_station TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        user_id INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS repair_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL UNIQUE,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
        repair_date TEXT NOT NULL,
        problem_category TEXT NOT NULL CHECK(problem_category IN ('engine','brakes','hydraulic','electrical','tires','gearbox','other')),
        description TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','urgent')),
        workshop TEXT DEFAULT '',
        parts_used TEXT DEFAULT '',
        parts_cost REAL NOT NULL DEFAULT 0,
        labor_cost REAL NOT NULL DEFAULT 0,
        towing_cost REAL NOT NULL DEFAULT 0,
        total_cost REAL NOT NULL DEFAULT 0,
        downtime_days REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','in_progress','completed')),
        project_id INTEGER REFERENCES projects(id),
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS maintenance_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        rule_name TEXT NOT NULL,
        trigger_type TEXT NOT NULL CHECK(trigger_type IN ('km','hours','days','date')),
        interval_value REAL NOT NULL DEFAULT 0,
        last_done_value REAL NOT NULL DEFAULT 0,
        last_done_date TEXT,
        next_due_value REAL NOT NULL DEFAULT 0,
        next_due_date TEXT,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        purchase_date TEXT,
        condition TEXT NOT NULL DEFAULT 'good' CHECK(condition IN ('new','good','fair','damaged','lost','retired')),
        storage_location TEXT NOT NULL DEFAULT 'Dépôt principal',
        status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','assigned','under_repair','lost','retired')),
        assigned_worker_id INTEGER REFERENCES workers(id),
        assigned_vehicle_id INTEGER REFERENCES vehicles(id),
        assigned_project_id INTEGER REFERENCES projects(id),
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tool_checkouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
        action_type TEXT NOT NULL CHECK(action_type IN ('checkout','return','transfer','loss','damage','repair')),
        worker_id INTEGER REFERENCES workers(id),
        vehicle_id INTEGER REFERENCES vehicles(id),
        project_id INTEGER REFERENCES projects(id),
        issued_date TEXT NOT NULL,
        expected_return_date TEXT,
        actual_return_date TEXT,
        condition_out TEXT DEFAULT '',
        condition_in TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        user_id INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS commercial_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_type TEXT NOT NULL CHECK(doc_type IN ('devis','proforma','bon_livraison','facture','avoir')),
        doc_number TEXT NOT NULL UNIQUE,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        project_id INTEGER REFERENCES projects(id),
        linked_doc_id INTEGER REFERENCES commercial_documents(id),
        issue_date TEXT NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','partial','paid','overdue','cancelled','accepted')),
        discount_percent REAL NOT NULL DEFAULT 0,
        total_ht REAL NOT NULL DEFAULT 0,
        total_tva REAL NOT NULL DEFAULT 0,
        total_ttc REAL NOT NULL DEFAULT 0,
        amount_paid REAL NOT NULL DEFAULT 0,
        notes TEXT DEFAULT '',
        created_by INTEGER REFERENCES users(id),
        locked_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS commercial_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL REFERENCES commercial_documents(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT 'U',
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        tva_rate REAL NOT NULL DEFAULT 19,
        line_ht REAL NOT NULL DEFAULT 0,
        line_tva REAL NOT NULL DEFAULT 0,
        line_ttc REAL NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT NOT NULL UNIQUE,
        supplier_invoice_no TEXT DEFAULT '',
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
        project_id INTEGER REFERENCES projects(id),
        order_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','ordered','received','partial_paid','paid','cancelled')),
        total_ht REAL NOT NULL DEFAULT 0,
        total_tva REAL NOT NULL DEFAULT 0,
        total_ttc REAL NOT NULL DEFAULT 0,
        amount_paid REAL NOT NULL DEFAULT 0,
        notes TEXT DEFAULT '',
        created_by INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS purchase_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
        material_id INTEGER REFERENCES materials(id),
        description TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        tva_rate REAL NOT NULL DEFAULT 19,
        line_total REAL NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT NOT NULL UNIQUE,
        direction TEXT NOT NULL CHECK(direction IN ('inflow','outflow')),
        client_id INTEGER REFERENCES clients(id),
        supplier_id INTEGER REFERENCES suppliers(id),
        document_id INTEGER REFERENCES commercial_documents(id),
        purchase_id INTEGER REFERENCES purchases(id),
        milestone_id INTEGER REFERENCES contract_milestones(id),
        payment_date TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('Espèces','Virement','Chèque')),
        reference TEXT DEFAULT '',
        is_reversal INTEGER NOT NULL DEFAULT 0,
        reversed_payment_id INTEGER REFERENCES payments(id),
        notes TEXT DEFAULT '',
        user_id INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attendance_date TEXT NOT NULL,
        worker_id INTEGER NOT NULL REFERENCES workers(id),
        project_id INTEGER REFERENCES projects(id),
        status TEXT NOT NULL CHECK(status IN ('present','absent','half_day','paid_leave','unpaid_leave','sick_leave','holiday')),
        day_fraction REAL NOT NULL DEFAULT 1,
        overtime_hours REAL NOT NULL DEFAULT 0,
        late_minutes INTEGER NOT NULL DEFAULT 0,
        advance_amount REAL NOT NULL DEFAULT 0,
        notes TEXT DEFAULT '',
        approval_status TEXT NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending','approved')),
        entered_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        approved_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS payroll_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved')),
        approved_by INTEGER REFERENCES users(id),
        approved_at TEXT,
        payment_method TEXT DEFAULT 'Espèces',
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(month, year)
      );

      CREATE TABLE IF NOT EXISTS payslips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payroll_period_id INTEGER NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
        worker_id INTEGER NOT NULL REFERENCES workers(id),
        worked_days REAL NOT NULL DEFAULT 0,
        overtime_hours REAL NOT NULL DEFAULT 0,
        base_gross REAL NOT NULL DEFAULT 0,
        overtime_pay REAL NOT NULL DEFAULT 0,
        bonus_amount REAL NOT NULL DEFAULT 0,
        piecework_amount REAL NOT NULL DEFAULT 0,
        gross_salary REAL NOT NULL DEFAULT 0,
        cnas_employee REAL NOT NULL DEFAULT 0,
        cnas_employer REAL NOT NULL DEFAULT 0,
        irg_amount REAL NOT NULL DEFAULT 0,
        advances_deducted REAL NOT NULL DEFAULT 0,
        penalties_deducted REAL NOT NULL DEFAULT 0,
        other_deductions REAL NOT NULL DEFAULT 0,
        net_pay REAL NOT NULL DEFAULT 0,
        locked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(payroll_period_id, worker_id)
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_date TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'Espèces',
        project_id INTEGER REFERENCES projects(id),
        vehicle_id INTEGER REFERENCES vehicles(id),
        supplier_id INTEGER REFERENCES suppliers(id),
        is_overhead INTEGER NOT NULL DEFAULT 0,
        notes TEXT DEFAULT '',
        user_id INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS treasury_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_date TEXT NOT NULL,
        tx_type TEXT NOT NULL CHECK(tx_type IN ('cash_inflow','cash_outflow','bank_inflow','bank_outflow','internal_transfer','advance')),
        account TEXT NOT NULL CHECK(account IN ('Caisse','Banque','Chèques')),
        to_account TEXT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        project_id INTEGER REFERENCES projects(id),
        worker_id INTEGER REFERENCES workers(id),
        client_id INTEGER REFERENCES clients(id),
        supplier_id INTEGER REFERENCES suppliers(id),
        linked_payment_id INTEGER REFERENCES payments(id),
        linked_expense_id INTEGER REFERENCES expenses(id),
        bank_reconciled INTEGER NOT NULL DEFAULT 0,
        bank_statement_ref TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        user_id INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cash_closings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        closing_date TEXT NOT NULL UNIQUE,
        opening_balance REAL NOT NULL DEFAULT 0,
        cash_inflows REAL NOT NULL DEFAULT 0,
        cash_outflows REAL NOT NULL DEFAULT 0,
        expected_closing REAL NOT NULL DEFAULT 0,
        counted_balance REAL NOT NULL DEFAULT 0,
        difference REAL NOT NULL DEFAULT 0,
        notes TEXT DEFAULT '',
        closed_by INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        file_name TEXT NOT NULL,
        stored_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        doc_date TEXT NOT NULL,
        related_type TEXT DEFAULT '',
        related_id INTEGER,
        notes TEXT DEFAULT '',
        archived INTEGER NOT NULL DEFAULT 0,
        uploaded_by INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT NOT NULL,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT DEFAULT '',
        old_value TEXT DEFAULT '',
        new_value TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS backup_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        backup_type TEXT NOT NULL CHECK(backup_type IN ('auto_daily','manual_local','usb_export','pre_restore_safety')),
        size_bytes INTEGER NOT NULL DEFAULT 0,
        verified INTEGER NOT NULL DEFAULT 1,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_date_worker ON attendance(attendance_date, worker_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_project ON stock_movements(project_id);
      CREATE INDEX IF NOT EXISTS idx_docs_client ON commercial_documents(client_id);
      CREATE INDEX IF NOT EXISTS idx_docs_project ON commercial_documents(project_id);
      CREATE INDEX IF NOT EXISTS idx_treasury_date ON treasury_transactions(tx_date);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    `);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (1)').run();
  }

  // Version 2: extend the existing service catalogue without replacing or rewriting
  // any service rows. This catalogue is the configurable "Types de travaux" source.
  const migration2 = db.prepare('SELECT version FROM schema_migrations WHERE version = 2').get();
  if (!migration2) {
    const serviceColumns = (db.pragma('table_info(services)') as Array<{ name: string }>).map((c) => c.name);
    if (!serviceColumns.includes('category')) {
      db.exec("ALTER TABLE services ADD COLUMN category TEXT NOT NULL DEFAULT 'Général'");
    }
    if (!serviceColumns.includes('description')) {
      db.exec("ALTER TABLE services ADD COLUMN description TEXT NOT NULL DEFAULT ''");
    }
    if (!serviceColumns.includes('created_at')) {
      db.exec("ALTER TABLE services ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))");
    }
    if (!serviceColumns.includes('updated_at')) {
      db.exec("ALTER TABLE services ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))");
    }
    // Starter catalogue only when the existing catalogue is genuinely empty.
    // Existing user-defined services are never overwritten or duplicated.
    const serviceCount = (db.prepare('SELECT COUNT(*) AS count FROM services').get() as { count: number }).count;
    if (serviceCount === 0) {
      const insertService = db.prepare(
        `INSERT INTO services (code, name, category, description, unit, default_price, cost_rate, tva_rate, active)
         VALUES (?, ?, ?, ?, ?, 0, 0, 0, 1)`
      );
      const seedStarterCatalogue = db.transaction(() => {
        const starterServices = [
          ['RESINE', 'Résine', 'Revêtement', 'Travaux de résine et revêtements décoratifs', 'm²'],
          ['EPOXY', 'Époxy', 'Revêtement', 'Revêtement et finition époxy', 'm²'],
          ['PLOMBERIE', 'Plomberie', 'Réseaux', 'Installation et réparation de plomberie', 'Forfait'],
          ['PEINTURE', 'Peinture', 'Finition', 'Travaux de peinture intérieure et extérieure', 'm²'],
          ['CARRELAGE', 'Carrelage', 'Finition', 'Pose et finition de carrelage', 'm²'],
          ['ELECTRICITE', 'Électricité', 'Réseaux', 'Installation et maintenance électrique', 'Point'],
        ] as const;
        starterServices.forEach((row) => insertService.run(...row));
      });
      seedStarterCatalogue();
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_services_active_name ON services(active, name)');
    db.prepare('INSERT INTO schema_migrations (version) VALUES (2)').run();
  }
}
