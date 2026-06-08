use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

pub struct Database {
    pub conn: Arc<Mutex<Connection>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Member {
    pub id: String,
    pub name: String,
    pub phone: String,
    pub card_code: String,
    pub photo: String,
    pub plan_id: String,
    pub start_date: String,
    pub end_date: String,
    pub status: String,
    pub inbody_used: i32,
    pub invitation_used: i32,
    pub freeze_used: i32,
    pub private_used: i32,
    pub frozen_until: String,
    pub freeze_start_date: String,
    pub freeze_days_entered: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Plan {
    pub id: String,
    pub name: String,
    pub duration_months: i32,
    pub price: f64,
    pub inbody_count: i32,
    pub invitation_count: i32,
    pub freeze_days: i32,
    pub private_sessions: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Attendance {
    pub id: String,
    pub member_id: String,
    pub date: String,
    pub time: String,
    pub method: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Renewal {
    pub id: String,
    pub member_id: String,
    pub date: String,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Supplement {
    pub id: String,
    pub name: String,
    pub cost: f64,
    pub price: f64,
    pub stock: i32,
    pub added_date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SupplementOrder {
    pub id: String,
    pub supplement_id: String,
    pub qty: i32,
    pub total_cost: f64,
    pub total_price: f64,
    pub profit: f64,
    pub date: String,
    pub time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotificationLog {
    pub id: String,
    pub title: String,
    pub message: String,
    pub priority: String,
    pub date: String,
    pub time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditLog {
    pub id: String,
    pub action: String,
    pub details: String,
    pub date: String,
    pub time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSetting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Card {
    pub id: i64,
    pub card_code: String,
    pub member_id: Option<String>,
    pub created_at: String,
    pub assigned_at: Option<String>,
    pub status: String,
    pub member_name: Option<String>,
    pub member_phone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CardStats {
    pub total: i64,
    pub available: i64,
    pub used: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateResult {
    pub generated: i32,
    pub skipped: i32,
}

impl Database {
    pub fn new(path: String) -> Result<Self> {
        let conn = Connection::open(&path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        Ok(Database { conn: Arc::new(Mutex::new(conn)) })
    }

    pub fn initialize(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS plans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                duration_months INTEGER NOT NULL DEFAULT 1,
                price REAL NOT NULL DEFAULT 0,
                inbody_count INTEGER NOT NULL DEFAULT 0,
                invitation_count INTEGER NOT NULL DEFAULT 0,
                freeze_days INTEGER NOT NULL DEFAULT 0,
                private_sessions INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS members (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT NOT NULL DEFAULT '',
                card_code TEXT NOT NULL DEFAULT '',
                photo TEXT NOT NULL DEFAULT '',
                plan_id TEXT NOT NULL DEFAULT '',
                start_date TEXT NOT NULL DEFAULT '',
                end_date TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active',
                inbody_used INTEGER NOT NULL DEFAULT 0,
                invitation_used INTEGER NOT NULL DEFAULT 0,
                freeze_used INTEGER NOT NULL DEFAULT 0,
                private_used INTEGER NOT NULL DEFAULT 0,
                frozen_until TEXT NOT NULL DEFAULT '',
                freeze_start_date TEXT NOT NULL DEFAULT '',
                freeze_days_entered INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS attendance (
                id TEXT PRIMARY KEY,
                member_id TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                method TEXT NOT NULL DEFAULT 'Manual',
                FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS renewals (
                id TEXT PRIMARY KEY,
                member_id TEXT NOT NULL,
                date TEXT NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS supplements (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                cost REAL NOT NULL DEFAULT 0,
                price REAL NOT NULL DEFAULT 0,
                stock INTEGER NOT NULL DEFAULT 0,
                added_date TEXT NOT NULL DEFAULT (date('now'))
            );

            CREATE TABLE IF NOT EXISTS supplement_orders (
                id TEXT PRIMARY KEY,
                supplement_id TEXT NOT NULL,
                qty INTEGER NOT NULL DEFAULT 0,
                total_cost REAL NOT NULL DEFAULT 0,
                total_price REAL NOT NULL DEFAULT 0,
                profit REAL NOT NULL DEFAULT 0,
                date TEXT NOT NULL DEFAULT (date('now')),
                time TEXT NOT NULL DEFAULT (time('now')),
                FOREIGN KEY (supplement_id) REFERENCES supplements(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notifications_log (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                message TEXT NOT NULL DEFAULT '',
                priority TEXT NOT NULL DEFAULT 'Medium',
                date TEXT NOT NULL DEFAULT (date('now')),
                time TEXT NOT NULL DEFAULT (time('now'))
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                action TEXT NOT NULL DEFAULT '',
                details TEXT NOT NULL DEFAULT '',
                date TEXT NOT NULL DEFAULT (date('now')),
                time TEXT NOT NULL DEFAULT (time('now'))
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_code TEXT UNIQUE NOT NULL,
                member_id TEXT DEFAULT NULL,
                created_at TEXT NOT NULL,
                assigned_at TEXT DEFAULT NULL,
                status TEXT DEFAULT 'available'
            );

            INSERT OR IGNORE INTO app_settings (key, value) VALUES
                ('gym_name', 'My Gym'),
                ('theme', 'dark'),
                ('language', 'en'),
                ('auto_backup', 'false'),
                ('backup_folder', ''),
                ('card_save_folder', ''),
                ('delete_password', 'admin123'),
                ('daily_revenue_notified', '');
        ")?;
        // Migrations for existing databases
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN frozen_until TEXT NOT NULL DEFAULT '';");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN freeze_start_date TEXT NOT NULL DEFAULT '';");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN freeze_days_entered INTEGER NOT NULL DEFAULT 0;");
        // Auto-unfreeze members whose freeze has expired
        let _ = conn.execute("UPDATE members SET status='active', frozen_until='', freeze_start_date='', freeze_days_entered=0 WHERE status='frozen' AND frozen_until != '' AND frozen_until < date('now')", []);
        Ok(())
    }
}
