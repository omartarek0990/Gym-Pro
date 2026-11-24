use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

pub fn timing_log(msg: &str) {
    use std::io::Write;
    let path = r"D:\css\Database\startup_timing.txt";
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let _ = writeln!(f, "[{}] {}", ms, msg);
    }
}

#[derive(Clone)]
pub struct Database {
    pub conn: Arc<Mutex<Connection>>,
}

pub struct DbState(pub Arc<Mutex<Option<Database>>>);

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
    pub gender: String,
    pub plan_name: String,
    pub plan_price: f64,
    pub plan_duration_months: i32,
    pub plan_inbody_count: i32,
    pub plan_invitation_count: i32,
    pub plan_freeze_days: i32,
    pub plan_private_sessions: i32,
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
    pub rtype: String,
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

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    pub username: String,
    #[serde(skip)]
    pub password: String,
    pub role: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserResponse {
    pub id: String,
    pub username: String,
    pub role: String,
}

impl Database {
    pub fn new(path: String) -> Result<Self> {
        let t0 = std::time::Instant::now();
        timing_log("Database::new() START");

        let conn = Connection::open(&path)?;
        timing_log(&format!("Connection::open: {}ms", t0.elapsed().as_millis()));

        let t1 = std::time::Instant::now();
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-16000; PRAGMA temp_store=MEMORY; PRAGMA mmap_size=268435456;")?;
        timing_log(&format!("All PRAGMAs: {}ms", t1.elapsed().as_millis()));

        let t1 = std::time::Instant::now();
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
        timing_log(&format!("PRAGMA wal_checkpoint(TRUNCATE): {}ms", t1.elapsed().as_millis()));

        timing_log(&format!("Database::new TOTAL: {}ms", t0.elapsed().as_millis()));
        Ok(Database { conn: Arc::new(Mutex::new(conn)) })
    }

    /// Fast init: tables, indexes, ALTER TABLE, auto-unfreeze. Returns quickly.
    pub fn initialize(&self) -> Result<()> {
        let t_init = std::time::Instant::now();
        let conn = self.conn.lock().unwrap();
        timing_log(&format!("initialize() lock acquired: {}ms", t_init.elapsed().as_millis()));

        let t1 = std::time::Instant::now();
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
                freeze_days_entered INTEGER NOT NULL DEFAULT 0,
                gender TEXT NOT NULL DEFAULT ''
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
                rtype TEXT NOT NULL DEFAULT 'renewal',
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

            CREATE TABLE IF NOT EXISTS invitations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id TEXT NOT NULL,
                member_name TEXT NOT NULL,
                guest_name TEXT NOT NULL,
                guest_phone TEXT NOT NULL,
                visits_used INTEGER DEFAULT 0,
                max_visits INTEGER DEFAULT 3,
                created_at TEXT NOT NULL,
                FOREIGN KEY (member_id) REFERENCES members(id)
            );

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('owner', 'admin')),
                created_at TEXT NOT NULL
            );

            INSERT OR IGNORE INTO app_settings (key, value) VALUES
                ('gym_name', 'My Gym'),
                ('theme', 'dark'),
                ('language', 'ar'),
                ('auto_backup', 'false'),
                ('backup_folder', ''),
                ('setup_complete', 'false'),
                ('card_save_folder', ''),
                ('daily_revenue_notified', '');

            CREATE INDEX IF NOT EXISTS idx_attendance_member_id ON attendance(member_id);
            CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
            CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
            CREATE INDEX IF NOT EXISTS idx_members_end_date ON members(end_date);
            CREATE INDEX IF NOT EXISTS idx_renewals_member_id ON renewals(member_id);
            CREATE INDEX IF NOT EXISTS idx_renewals_date ON renewals(date);
            CREATE INDEX IF NOT EXISTS idx_supplement_orders_date ON supplement_orders(date);
            CREATE INDEX IF NOT EXISTS idx_invitations_member_id ON invitations(member_id);
            CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
            CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
            CREATE INDEX IF NOT EXISTS idx_cards_member_id ON cards(member_id);
            CREATE INDEX IF NOT EXISTS idx_members_card_code ON members(card_code);
            CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
            CREATE INDEX IF NOT EXISTS idx_members_plan_id ON members(plan_id);
            CREATE INDEX IF NOT EXISTS idx_members_frozen_until ON members(frozen_until);
            CREATE INDEX IF NOT EXISTS idx_invitations_guest_phone ON invitations(guest_phone);
            CREATE INDEX IF NOT EXISTS idx_invitations_member_guest ON invitations(member_id, guest_phone);
            CREATE INDEX IF NOT EXISTS idx_supplement_orders_supplement_id ON supplement_orders(supplement_id);
            CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON attendance(member_id, date);
        ")?;
        timing_log(&format!("initialize() CREATE TABLEs + INDEXes + defaults: {}ms", t1.elapsed().as_millis()));
        // Migrations for existing databases — add all columns that may be missing
        let t2 = std::time::Instant::now();
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN photo TEXT NOT NULL DEFAULT '';");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN inbody_used INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN invitation_used INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN freeze_used INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN private_used INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN frozen_until TEXT NOT NULL DEFAULT '';");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN freeze_start_date TEXT NOT NULL DEFAULT '';");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN freeze_days_entered INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN gender TEXT NOT NULL DEFAULT '';");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN card_code TEXT NOT NULL DEFAULT '';");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN card_image TEXT NOT NULL DEFAULT '';");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN plan_name TEXT NOT NULL DEFAULT '';");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN plan_price REAL NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN plan_duration_months INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN plan_inbody_count INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN plan_invitation_count INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN plan_freeze_days INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE members ADD COLUMN plan_private_sessions INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE renewals ADD COLUMN rtype TEXT NOT NULL DEFAULT 'renewal';");
        let _ = conn.execute_batch("ALTER TABLE plans ADD COLUMN duration_months INTEGER NOT NULL DEFAULT 1;");
        let _ = conn.execute_batch("ALTER TABLE plans ADD COLUMN inbody_count INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE plans ADD COLUMN invitation_count INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE plans ADD COLUMN freeze_days INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute_batch("ALTER TABLE plans ADD COLUMN private_sessions INTEGER NOT NULL DEFAULT 0;");
        let _ = conn.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('setup_complete', 'false')", []);
        let _ = conn.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('gym_card_save_folder', '')", []);
        timing_log(&format!("initialize() ALTER TABLEs + settings: {}ms", t2.elapsed().as_millis()));
        // Auto-unfreeze members whose freeze has expired
        let t3 = std::time::Instant::now();
        let _ = conn.execute("UPDATE members SET status='active', frozen_until='', freeze_start_date='', freeze_days_entered=0 WHERE status='frozen' AND frozen_until != '' AND frozen_until < date('now')", []);
        timing_log(&format!("initialize() auto-unfreeze UPDATE: {}ms", t3.elapsed().as_millis()));

        timing_log(&format!("initialize() TOTAL: {}ms", t_init.elapsed().as_millis()));
        Ok(())
    }

    /// Heavy photo recompression migration. Opens its OWN connection so it never
    /// blocks the app's main DB connection. Writes progress to a file the frontend
    /// can poll. Adds VACUUM at end to reclaim freelist space.
    pub fn run_photo_migration(db_path: &str) {
        let t0 = std::time::Instant::now();

        fn write_progress(msg: &str) {
            let _ = std::fs::write(r"D:\css\Database\migration_progress.txt", msg);
        }

        write_progress("opening_connection");
        timing_log(&format!("photo_migration: opening own connection to {}", db_path));

        let conn = match Connection::open(db_path) {
            Ok(c) => c,
            Err(e) => {
                timing_log(&format!("photo_migration: FAILED to open connection: {}", e));
                write_progress(&format!("error:{}", e));
                return;
            }
        };

        // Set WAL mode on our own connection
        let _ = conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-16000;");

        let migration_done: String = conn.query_row(
            "SELECT value FROM app_settings WHERE key='photo_recompress_v2'", [], |r| r.get(0)
        ).unwrap_or_default();
        timing_log(&format!("photo_migration flag check: {}ms (flag={})", t0.elapsed().as_millis(), migration_done));
        if migration_done == "true" {
            timing_log(&format!("photo_migration: ALREADY DONE, skipping (total {}ms)", t0.elapsed().as_millis()));
            write_progress("done");
            return;
        }

        timing_log("photo_migration: flag not set, starting recompression...");
        write_progress("counting");

        use base64::Engine;
        let rows: Vec<(String, String, String)> = conn
            .prepare("SELECT id, photo, card_image FROM members WHERE photo != '' OR card_image != ''")
            .and_then(|mut stmt| {
                stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
                    .map(|iter| iter.filter_map(|r| r.ok()).collect())
            })
            .unwrap_or_default();
        let total = rows.len();
        timing_log(&format!("photo_migration: {} members to process", total));

        let mut recompressed = 0u32;
        let mut skipped = 0u32;
        let batch_start = std::time::Instant::now();

        for (i, (id, photo, card_image)) in rows.iter().enumerate() {
            let mut changed = false;

            // Extract base64 from card_image — handles both "data:image/...;base64,XXXX" and raw base64
            let card_b64 = if card_image.starts_with("data:image") {
                card_image.split(',').nth(1).unwrap_or("")
            } else if !card_image.is_empty() {
                card_image.as_str()
            } else {
                ""
            };

            // Recompress card_image: resize to max 800px + JPEG quality 70
            if !card_b64.is_empty() && card_b64.len() > 10_000 {
                if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(card_b64) {
                    if let Ok(img) = image::load_from_memory(&bytes) {
                        let resized = img.resize(800, 800, image::imageops::FilterType::Triangle);
                        let mut buf = std::io::Cursor::new(Vec::new());
                        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 70);
                        if resized.write_with_encoder(encoder).is_ok() {
                            let jpeg_bytes = buf.into_inner();
                            let new_b64 = base64::engine::general_purpose::STANDARD.encode(&jpeg_bytes);
                            let new_url = format!("data:image/jpeg;base64,{}", new_b64);
                            if new_url.len() < card_image.len() {
                                let _ = conn.execute("UPDATE members SET card_image=?1 WHERE id=?2", rusqlite::params![new_url, id]);
                                changed = true;
                                recompressed += 1;
                            }
                        }
                    }
                }
            }

            // Extract base64 from photo — same dual handling
            let photo_b64 = if photo.starts_with("data:image") {
                photo.split(',').nth(1).unwrap_or("")
            } else if !photo.is_empty() {
                photo.as_str()
            } else {
                ""
            };

            // Recompress photo: resize to max 800px + JPEG quality 60
            if !photo_b64.is_empty() && photo_b64.len() > 10_000 {
                if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(photo_b64) {
                    if let Ok(img) = image::load_from_memory(&bytes) {
                        let resized = img.resize(800, 800, image::imageops::FilterType::Triangle);
                        let mut buf = std::io::Cursor::new(Vec::new());
                        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 60);
                        if resized.write_with_encoder(encoder).is_ok() {
                            let jpeg_bytes = buf.into_inner();
                            let new_b64 = base64::engine::general_purpose::STANDARD.encode(&jpeg_bytes);
                            let new_url = format!("data:image/jpeg;base64,{}", new_b64);
                            if new_url.len() < photo.len() {
                                let _ = conn.execute("UPDATE members SET photo=?1 WHERE id=?2", rusqlite::params![new_url, id]);
                                changed = true;
                                recompressed += 1;
                            }
                        }
                    }
                }
            }

            if !changed { skipped += 1; }

            // Log progress every 25 members + update progress file
            if (i + 1) % 25 == 0 || i + 1 == total {
                let elapsed = batch_start.elapsed().as_millis();
                let rate = if elapsed > 0 { (i as f64 + 1.0) / elapsed as f64 * 1000.0 } else { 0.0 };
                let eta_secs = if rate > 0.0 { ((total - i - 1) as f64 / rate) as u64 } else { 0 };
                timing_log(&format!("photo_migration progress: {}/{} ({}ms elapsed, {:.1}/s, ~{}s remaining)", i + 1, total, elapsed, rate, eta_secs));
                write_progress(&format!("processing|{}|{}|{}", i + 1, total, recompressed));
            }
        }

        let loop_ms = batch_start.elapsed().as_millis();
        timing_log(&format!("photo_migration: loop done in {}ms — {}/{} recompressed, {} skipped", loop_ms, recompressed, total, skipped));

        // Set flag BEFORE VACUUM so if VACUUM fails, we don't re-process images
        let _ = conn.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('photo_recompress_v2', 'true')", []);
        timing_log("photo_migration: flag set to true");

        // Clean up notifications_log if it exists
        write_progress("vacuum");
        timing_log("photo_migration: starting VACUUM (this reclaims freelist space)...");
        let t_vac = std::time::Instant::now();
        match conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);") {
            Ok(_) => timing_log(&format!("photo_migration: WAL checkpoint done in {}ms", t_vac.elapsed().as_millis())),
            Err(e) => timing_log(&format!("photo_migration: WAL checkpoint failed: {}", e)),
        }
        let t_vac = std::time::Instant::now();
        match conn.execute_batch("VACUUM;") {
            Ok(_) => timing_log(&format!("photo_migration: VACUUM done in {}ms", t_vac.elapsed().as_millis())),
            Err(e) => timing_log(&format!("photo_migration: VACUUM failed: {}", e)),
        }

        // Drop notifications_log if it exists
        let _ = conn.execute_batch("DROP TABLE IF EXISTS notifications_log;");
        timing_log("photo_migration: dropped notifications_log");

        let total_ms = t0.elapsed().as_millis();
        timing_log(&format!("photo_migration: COMPLETE TOTAL {}ms", total_ms));
        write_progress(&format!("done|{}|{}|{}", recompressed, total, total_ms));
    }

    /// Reclaims unused SQLite pages from the live database only. Backups are
    /// ordinary copies and are never opened or modified by this operation.
    pub fn compact_live_database(db_path: &str) -> Result<(), String> {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=30000; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA optimize; VACUUM;"
        ).map_err(|e| e.to_string())?;
        Ok(())
    }
}



