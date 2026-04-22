const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'payroll.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initializeDatabase = () => {
  db.exec(`
    -- Employees table
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_number TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      position TEXT NOT NULL,
      department TEXT NOT NULL,
      hire_date TEXT NOT NULL,
      salary_type TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' or 'hourly'
      base_salary REAL NOT NULL DEFAULT 0,
      housing_allowance REAL NOT NULL DEFAULT 0,
      transport_allowance REAL NOT NULL DEFAULT 0,
      other_allowance REAL NOT NULL DEFAULT 0,
      annual_incentive_multiplier REAL NOT NULL DEFAULT 0,
      grade TEXT DEFAULT NULL, -- e.g. 'Grade 1', 'Grade 2', etc.
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'terminated', 'suspended'
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Attendance table
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      break_start TEXT,
      break_end TEXT,
      total_break_minutes INTEGER DEFAULT 0,
      overtime_minutes INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'absent',
      -- Status options: present, absent, annual_leave, sick_leave, emergency_leave, excused
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(employee_id, date)
    );

    -- Warning letters table
    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      warning_number INTEGER NOT NULL, -- 1, 2, 3, 4 (final)
      warning_type TEXT NOT NULL, -- 'first', 'second', 'third', 'final', 'recognition'
      reason TEXT NOT NULL,
      details TEXT,
      issued_by TEXT NOT NULL,
      issued_date TEXT NOT NULL,
      acknowledged INTEGER DEFAULT 0,
      pdf_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- Performance metrics table
    CREATE TABLE IF NOT EXISTS performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      attendance_score REAL DEFAULT 0, -- /40
      punctuality_score REAL DEFAULT 0, -- /25
      leave_score REAL DEFAULT 0, -- /20
      discipline_score REAL DEFAULT 0, -- /15
      total_score REAL DEFAULT 0, -- /100
      rating TEXT DEFAULT 'Poor', -- Excellent, Good, Average, Needs Improvement, Poor
      rank_position INTEGER DEFAULT 0,
      total_days INTEGER DEFAULT 0,
      present_days INTEGER DEFAULT 0,
      absent_days INTEGER DEFAULT 0,
      late_arrivals INTEGER DEFAULT 0,
      warning_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- Payroll table
    CREATE TABLE IF NOT EXISTS payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      period_month INTEGER NOT NULL,
      period_year INTEGER NOT NULL,
      base_salary REAL NOT NULL DEFAULT 0,
      housing_allowance REAL NOT NULL DEFAULT 0,
      transport_allowance REAL NOT NULL DEFAULT 0,
      other_allowance REAL NOT NULL DEFAULT 0,
      gross_pay REAL NOT NULL DEFAULT 0,
      deductions REAL NOT NULL DEFAULT 0,
      absence_deduction REAL NOT NULL DEFAULT 0,
      net_pay REAL NOT NULL DEFAULT 0,
      working_days INTEGER DEFAULT 22,
      days_worked INTEGER DEFAULT 0,
      days_absent INTEGER DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      overtime_pay REAL DEFAULT 0,
      annual_incentive REAL DEFAULT 0,
      status TEXT DEFAULT 'draft', -- 'draft', 'processed', 'paid'
      processed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(employee_id, period_month, period_year)
    );

    -- Leaves balance table (Saudi Labor Law compliant)
    CREATE TABLE IF NOT EXISTS leave_balance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      annual_leave_total INTEGER DEFAULT 21,
      annual_leave_used INTEGER DEFAULT 0,
      sick_leave_total INTEGER DEFAULT 120,
      sick_leave_used INTEGER DEFAULT 0,
      emergency_leave_total INTEGER DEFAULT 10,
      emergency_leave_used INTEGER DEFAULT 0,
      -- Sick leave tier tracking (Saudi Labor Law Art. 117)
      sick_leave_full_pay_days INTEGER DEFAULT 30,   -- first 30 days at 100%
      sick_leave_75_pay_days INTEGER DEFAULT 60,     -- next 60 days at 75%
      sick_leave_50_pay_days INTEGER DEFAULT 30,     -- next 30 days at 50%
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(employee_id, year)
    );

    -- Salary ladder table (10-year grade schedule)
    CREATE TABLE IF NOT EXISTS salary_ladder (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grade TEXT NOT NULL,
      year_number INTEGER NOT NULL,
      min_salary REAL NOT NULL DEFAULT 0,
      max_salary REAL NOT NULL DEFAULT 0,
      annual_increment REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(grade, year_number)
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Insert default settings
    INSERT OR IGNORE INTO settings (key, value) VALUES 
      ('company_name', 'My Company'),
      ('work_start_time', '08:00'),
      ('work_end_time', '16:00'),
      ('break_duration_minutes', '40'),
      ('late_threshold_minutes', '15'),
      ('recognition_threshold', '85'),
      ('working_days_per_month', '22');
  `);

  // Migrations for existing databases
  const runMigrations = () => {
    const cols = db.prepare("PRAGMA table_info(employees)").all().map(c => c.name);
    if (!cols.includes('grade')) {
      db.exec("ALTER TABLE employees ADD COLUMN grade TEXT DEFAULT NULL");
    }

    const leaveCols = db.prepare("PRAGMA table_info(leave_balance)").all().map(c => c.name);
    if (!leaveCols.includes('sick_leave_full_pay_days')) {
      db.exec("ALTER TABLE leave_balance ADD COLUMN sick_leave_full_pay_days INTEGER DEFAULT 30");
      db.exec("ALTER TABLE leave_balance ADD COLUMN sick_leave_75_pay_days INTEGER DEFAULT 60");
      db.exec("ALTER TABLE leave_balance ADD COLUMN sick_leave_50_pay_days INTEGER DEFAULT 30");
    }
    // Update old records to Saudi Labor Law defaults
    db.exec("UPDATE leave_balance SET sick_leave_total = 120 WHERE sick_leave_total = 14");
    db.exec("UPDATE leave_balance SET emergency_leave_total = 10 WHERE emergency_leave_total = 5");
  };
  runMigrations();
};

initializeDatabase();

module.exports = db;
