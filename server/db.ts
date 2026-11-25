import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export const DATA_DIR = path.resolve(process.env.IDEAL_DATA_DIR || process.env.GESTIONPRO_DATA_DIR || path.resolve(process.cwd(), 'data'));
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
    const opened = new Database(DB_PATH);
    try {
      opened.pragma('journal_mode = WAL');
      // A shared office install writes from several browsers at once: wait for the
      // write lock instead of surfacing SQLITE_BUSY in the middle of a save.
      opened.pragma('busy_timeout = 5000');
      opened.pragma('foreign_keys = ON');
      runMigrations(opened);
    } catch (error) {
      // Never leave a half-open handle behind when the migrations refuse the file.
      try { opened.close(); } catch {}
      throw error;
    }
    dbInstance = opened;
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

/** Highest schema version this build understands. The migration test keeps it honest. */
export const LATEST_SCHEMA_VERSION = 11;

export function runMigrations(db: Database.Database, upTo: number = LATEST_SCHEMA_VERSION) {
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

  // Opening a database written by a newer build would let this build write data the
  // newer one cannot read back. Refuse, and say why instead of corrupting silently.
  const highestApplied = applied.length ? Math.max(...applied) : 0;
  if (highestApplied > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Cette base de données a été ouverte par une version plus récente de IDEAL (schéma ${highestApplied}, cette version prend en charge jusqu’au schéma ${LATEST_SCHEMA_VERSION}). Installez la dernière version du logiciel avant d’ouvrir ce dossier de données ; aucune modification n’a été apportée.`
    );
  }

  if (upTo >= 1 && !applied.includes(1)) {
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
  if (upTo >= 2 && !migration2) {
    const serviceColumns = (db.pragma('table_info(services)') as Array<{ name: string }>).map((c) => c.name);
    if (!serviceColumns.includes('category')) {
      db.exec("ALTER TABLE services ADD COLUMN category TEXT NOT NULL DEFAULT 'Général'");
    }
    if (!serviceColumns.includes('description')) {
      db.exec("ALTER TABLE services ADD COLUMN description TEXT NOT NULL DEFAULT ''");
    }
    if (!serviceColumns.includes('created_at')) {
      db.exec("ALTER TABLE services ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
      db.exec("UPDATE services SET created_at = datetime('now') WHERE created_at = ''");
    }
    if (!serviceColumns.includes('updated_at')) {
      db.exec("ALTER TABLE services ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
      db.exec("UPDATE services SET updated_at = datetime('now') WHERE updated_at = ''");
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

  // Version 3: Smart Lifecycle Management columns (additive, idempotent).
  const migration3 = db.prepare('SELECT version FROM schema_migrations WHERE version = 3').get();
  if (upTo >= 3 && !migration3) {
    const lifecycleTables = ['clients', 'suppliers', 'workers', 'projects', 'vehicles', 'materials', 'services', 'commercial_documents'];
    for (const t of lifecycleTables) {
      const cols = (db.pragma(`table_info(${t})`) as Array<{ name: string }>).map((c) => c.name);
      if (!cols.includes('lifecycle_status')) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active'`);
      }
      if (!cols.includes('archived_at')) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN archived_at TEXT`);
      }
      if (!cols.includes('archived_by')) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN archived_by INTEGER`);
      }
      if (!cols.includes('archive_reason')) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN archive_reason TEXT DEFAULT ''`);
      }
      if (!cols.includes('deletion_eligible_until')) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN deletion_eligible_until TEXT`);
      }
      if (!cols.includes('updated_at')) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
        db.exec(`UPDATE ${t} SET updated_at = created_at WHERE updated_at = ''`);
      }
      // Backfill: existing records are already established => protected.
      db.exec(`UPDATE ${t} SET lifecycle_status = COALESCE(NULLIF(lifecycle_status,''),'active') WHERE lifecycle_status IS NULL OR lifecycle_status = ''`);
      db.exec(`UPDATE ${t} SET deletion_eligible_until = created_at WHERE deletion_eligible_until IS NULL`);
    }
    db.prepare('INSERT INTO schema_migrations (version) VALUES (3)').run();
  }

  // Version 4: one-year retention review for archived records (additive, idempotent).
  const migration4 = db.prepare('SELECT version FROM schema_migrations WHERE version = 4').get();
  if (upTo >= 4 && !migration4) {
    const retentionTables = ['clients', 'suppliers', 'workers', 'projects', 'vehicles', 'materials', 'services', 'commercial_documents'];
    for (const t of retentionTables) {
      const cols = (db.pragma(`table_info(${t})`) as Array<{ name: string }>).map((c) => c.name);
      if (!cols.includes('retention_review_due_at')) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN retention_review_due_at TEXT`);
      }
      if (!cols.includes('retention_reviewed_at')) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN retention_reviewed_at TEXT`);
      }
      if (!cols.includes('retention_reviewed_by')) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN retention_reviewed_by INTEGER`);
      }
      if (!cols.includes('retention_status')) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN retention_status TEXT NOT NULL DEFAULT 'none'`);
      }
      // Backfill: archived records get a 1-year review deadline.
      db.exec(`UPDATE ${t} SET retention_review_due_at = datetime(archived_at, '+365 days') WHERE archived_at IS NOT NULL AND retention_review_due_at IS NULL`);
      db.exec(`UPDATE ${t} SET retention_status = CASE WHEN archived_at IS NOT NULL THEN 'scheduled' ELSE 'none' END WHERE retention_status IS NULL OR retention_status = ''`);
    }
    db.prepare('INSERT INTO schema_migrations (version) VALUES (4)').run();
  }

  // Version 5: extend lifecycle metadata to every business table + notifications.
  const migration5 = db.prepare('SELECT version FROM schema_migrations WHERE version = 5').get();
  if (upTo >= 5 && !migration5) {
    const allTables = [
      'users','company_settings','tax_rules','reusable_lists','clients','suppliers','workers','projects',
      'project_assignments','project_phases','project_tasks','change_orders','contracts','contract_milestones',
      'services','materials','stock_movements','vehicles','fuel_entries','repair_orders','maintenance_rules',
      'tools','tool_checkouts','commercial_documents','commercial_lines','purchases','purchase_lines',
      'payments','attendance','payroll_periods','payslips','expenses','treasury_transactions','cash_closings','documents'
    ];
    for (const t of allTables) {
      let cols: string[] = [];
      try { cols = (db.pragma(`table_info(${t})`) as Array<{ name: string }>).map((c) => c.name); } catch { continue; }
      if (cols.length === 0) continue;
      const add = (name: string, sql: string) => { if (!cols.includes(name)) { db.exec(`ALTER TABLE ${t} ADD COLUMN ${name} ${sql}`); cols.push(name); } };
      add('lifecycle_status', "TEXT NOT NULL DEFAULT 'active'");
      add('archived_at', 'TEXT');
      add('archived_by', 'INTEGER');
      add('archive_reason', "TEXT DEFAULT ''");
      add('deletion_eligible_until', 'TEXT');
      add('updated_at', "TEXT NOT NULL DEFAULT ''");
      add('retention_review_due_at', 'TEXT');
      add('retention_reviewed_at', 'TEXT');
      add('retention_reviewed_by', 'INTEGER');
      add('retention_status', "TEXT NOT NULL DEFAULT 'none'");
      if (cols.includes('created_at') && cols.includes('updated_at')) {
        db.exec(`UPDATE ${t} SET updated_at = created_at WHERE updated_at = '' OR updated_at IS NULL`);
      }
      if (cols.includes('created_at')) {
        db.exec(`UPDATE ${t} SET deletion_eligible_until = created_at WHERE deletion_eligible_until IS NULL`);
      }
      db.exec(`UPDATE ${t} SET lifecycle_status = 'active' WHERE lifecycle_status IS NULL OR lifecycle_status = ''`);
      db.exec(`UPDATE ${t} SET retention_status = 'none' WHERE retention_status IS NULL OR retention_status = ''`);
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dedupe_key TEXT UNIQUE,
        user_id INTEGER,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (5)').run();
  }

  // Version 6: cancellation/reversal status for expenses and treasury.
  const migration6 = db.prepare('SELECT version FROM schema_migrations WHERE version = 6').get();
  if (upTo >= 6 && !migration6) {
    const addCol = (t: string, name: string, sql: string) => {
      const cols = (db.pragma(`table_info(${t})`) as Array<{ name: string }>).map((c) => c.name);
      if (!cols.includes(name)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${name} ${sql}`);
    };
    addCol('expenses', 'status', "TEXT NOT NULL DEFAULT 'active'");
    addCol('treasury_transactions', 'status', "TEXT NOT NULL DEFAULT 'active'");
    addCol('treasury_transactions', 'reversed_transaction_id', 'INTEGER');
    db.exec("UPDATE expenses SET status='active' WHERE status IS NULL OR status=''");
    db.exec("UPDATE treasury_transactions SET status='active' WHERE status IS NULL OR status=''");
    db.prepare('INSERT INTO schema_migrations (version) VALUES (6)').run();
  }

  // Version 7: Bill of Quantities (BOQ) — versioned estimates with sections, items
  // and editable rate analysis (resource breakdown). Additive only; no existing table is modified.
  const migration7 = db.prepare('SELECT version FROM schema_migrations WHERE version = 7').get();
  if (upTo >= 7 && !migration7) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS boq_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','superseded')),
        notes TEXT DEFAULT '',
        created_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        approved_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(project_id, version_number)
      );

      CREATE TABLE IF NOT EXISTS boq_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_id INTEGER NOT NULL REFERENCES boq_versions(id) ON DELETE CASCADE,
        code TEXT DEFAULT '',
        title TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS boq_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_id INTEGER NOT NULL REFERENCES boq_versions(id) ON DELETE CASCADE,
        section_id INTEGER REFERENCES boq_sections(id) ON DELETE SET NULL,
        code TEXT DEFAULT '',
        description TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT 'U',
        quantity REAL NOT NULL DEFAULT 0,
        unit_price REAL NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS boq_item_resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES boq_items(id) ON DELETE CASCADE,
        resource_type TEXT NOT NULL CHECK(resource_type IN ('material','labour','equipment','subcontract','transport')),
        label TEXT NOT NULL,
        unit TEXT DEFAULT '',
        quantity REAL NOT NULL DEFAULT 0,
        unit_cost REAL NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_boq_versions_project ON boq_versions(project_id);
      CREATE INDEX IF NOT EXISTS idx_boq_sections_version ON boq_sections(version_id);
      CREATE INDEX IF NOT EXISTS idx_boq_items_version ON boq_items(version_id);
      CREATE INDEX IF NOT EXISTS idx_boq_items_section ON boq_items(section_id);
      CREATE INDEX IF NOT EXISTS idx_boq_resources_item ON boq_item_resources(item_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (7)').run();
  }

  // Version 8: atomic document numbering. A sequence per prefix and fiscal exercise
  // replaces the read-then-insert race that let two users obtain the same invoice number.
  // Additive only; existing numbers are seeded from the documents on first use.
  const migration8 = db.prepare('SELECT version FROM schema_migrations WHERE version = 8').get();
  if (upTo >= 8 && !migration8) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS document_sequences (
        prefix TEXT NOT NULL,
        exercise INTEGER NOT NULL,
        last_value INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (prefix, exercise)
      );
    `);

    // A duplicated document number is a legal defect, so let the database refuse one.
    // Installs that already contain duplicates keep working (the upgrade must not block
    // on legacy data) and the conflict is reported instead of silently ignored.
    const duplicate = db
      .prepare(
        `SELECT doc_type, doc_number, COUNT(*) AS occurrences
         FROM commercial_documents
         GROUP BY doc_type, doc_number
         HAVING COUNT(*) > 1
         LIMIT 1`
      )
      .get() as { doc_type: string; doc_number: string; occurrences: number } | undefined;
    if (duplicate) {
      console.warn(
        `[migrations] duplicate document number left unchanged: ${duplicate.doc_type} ${duplicate.doc_number} (${duplicate.occurrences} occurrences)`
      );
    } else {
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_documents_number ON commercial_documents(doc_type, doc_number)');
    }

    db.prepare('INSERT INTO schema_migrations (version) VALUES (8)').run();
  }

  // Version 9: traceability from a quotation back to the approved BOQ version it came
  // from. Additive column on an existing table; documents created before it stay NULL.
  const migration9 = db.prepare('SELECT version FROM schema_migrations WHERE version = 9').get();
  if (upTo >= 9 && !migration9) {
    const columns = db.prepare('PRAGMA table_info(commercial_documents)').all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === 'boq_version_id')) {
      db.exec('ALTER TABLE commercial_documents ADD COLUMN boq_version_id INTEGER REFERENCES boq_versions(id) ON DELETE SET NULL');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_commercial_documents_boq ON commercial_documents(boq_version_id)');
    db.prepare('INSERT INTO schema_migrations (version) VALUES (9)').run();
  }

  // Version 10: optimistic concurrency for financial records. Every row carries a
  // revision that the client sends back when saving; a stale revision is refused
  // instead of silently overwriting what another user saved in the meantime.
  const migration10 = db.prepare('SELECT version FROM schema_migrations WHERE version = 10').get();
  if (upTo >= 10 && !migration10) {
    for (const table of ['commercial_documents', 'payments', 'payslips', 'payroll_periods']) {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      if (!columns.some((column) => column.name === 'revision')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN revision INTEGER NOT NULL DEFAULT 1`);
      }
    }
    db.prepare('INSERT INTO schema_migrations (version) VALUES (10)').run();
  }

  // Version 11: backups that survive the machine. Settings for an external copy folder
  // (synced OneDrive folder or network share), retention counts and the staleness
  // warning, plus where each archive was copied. Additive only.
  const migration11 = db.prepare('SELECT version FROM schema_migrations WHERE version = 11').get();
  if (upTo >= 11 && !migration11) {
    const settingsColumns = db.prepare('PRAGMA table_info(company_settings)').all() as Array<{ name: string }>;
    const addSetting = (name: string, definition: string) => {
      if (!settingsColumns.some((column) => column.name === name)) {
        db.exec(`ALTER TABLE company_settings ADD COLUMN ${name} ${definition}`);
      }
    };
    addSetting('backup_external_dir', "TEXT NOT NULL DEFAULT ''");
    addSetting('backup_keep_manual', 'INTEGER NOT NULL DEFAULT 10');
    addSetting('backup_warn_after_days', 'INTEGER NOT NULL DEFAULT 2');

    const historyColumns = db.prepare('PRAGMA table_info(backup_history)').all() as Array<{ name: string }>;
    if (!historyColumns.some((column) => column.name === 'external_path')) {
      db.exec('ALTER TABLE backup_history ADD COLUMN external_path TEXT');
    }
    if (!historyColumns.some((column) => column.name === 'external_copied_at')) {
      db.exec('ALTER TABLE backup_history ADD COLUMN external_copied_at TEXT');
    }

    db.prepare('INSERT INTO schema_migrations (version) VALUES (11)').run();
  }
}
