mod database;

use database::{Database, DbState, Member, Plan, Attendance, Renewal, Supplement, SupplementOrder, AuditLog, AppSetting, Card, CardStats, GenerateResult, UserResponse};
use database::setup::timing_log;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use rusqlite::{params, OptionalExtension};
use std::io::Write;
use serde::{Serialize, Deserialize};
use sha2::{Sha256, Digest};

fn get_db(app: &tauri::AppHandle) -> Result<std::sync::Arc<std::sync::Mutex<rusqlite::Connection>>, String> {
    let state = app.state::<DbState>();
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    guard.as_ref()
        .map(|db| db.conn.clone())
        .ok_or_else(|| "Database not initialized".to_string())
}

fn open_attendance_window(app: &tauri::AppHandle) -> Result<(), String> {
    if app.get_webview_window("attendance").is_some() {
        return Ok(());
    }
    WebviewWindowBuilder::new(
        app,
        "attendance",
        WebviewUrl::App("/attendance-standalone".into()),
    )
    .title("Gym Attendance")
    .inner_size(1280.0, 800.0)
    .min_inner_size(900.0, 600.0)
    .build()
    .map(|_| ())
    .map_err(|e| e.to_string())
}

fn get_db_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let config_file = config_dir.join("db_path.txt");
    if config_file.exists() {
        let path_str = std::fs::read_to_string(&config_file).map_err(|e| e.to_string())?;
        let path_str = path_str.trim().to_string();
        if !path_str.is_empty() {
            return Ok(std::path::PathBuf::from(path_str));
        }
    }
    Err("db_path_not_set".to_string())
}

fn save_db_path(app: &tauri::AppHandle, path: &std::path::Path) -> Result<(), String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let config_file = config_dir.join("db_path.txt");
    std::fs::write(&config_file, path.to_string_lossy().as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn get_migration_progress() -> Result<String, String> {
    std::fs::read_to_string(r"D:\css\Database\migration_progress.txt")
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
fn get_db_path_status(app: tauri::AppHandle) -> Result<String, String> {
    match get_db_path(&app) {
        Ok(path) => {
            if path.exists() {
                Ok(path.to_string_lossy().to_string())
            } else {
                Ok("not_set".to_string())
            }
        }
        Err(_) => Ok("not_set".to_string()),
    }
}

#[tauri::command(rename_all = "snake_case")]
async fn setup_db_folder(app: tauri::AppHandle, backup_folder: Option<String>) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();
    match folder {
        Some(folder_path) => {
            let path_str = folder_path.to_string();
            let db_path = std::path::PathBuf::from(&path_str).join("gym_system.db");
            // If old db exists at hardcoded path, copy it to new location
            let old_path = std::path::PathBuf::from("D:\\css\\gym-management\\gym_system.db");
            if old_path.exists() && !db_path.exists() {
                std::fs::copy(&old_path, &db_path).map_err(|e| e.to_string())?;
            }
            save_db_path(&app, &db_path)?;
            // Initialize database at new location and store in managed state
            let db = Database::new(db_path.to_string_lossy().to_string()).map_err(|e| e.to_string())?;
            db.initialize().map_err(|e| e.to_string())?;
            // Save backup folder setting if provided
            if let Some(ref bf) = backup_folder {
                if !bf.is_empty() {
                    let conn = db.conn.lock().map_err(|e| e.to_string())?;
                    let _ = conn.execute(
                        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('backup_folder', ?1)",
                        params![bf],
                    );
                }
            }
            let state = app.state::<DbState>();
            let mut guard = state.0.lock().map_err(|e| e.to_string())?;
            *guard = Some(db);
            Ok(db_path.to_string_lossy().to_string())
        }
        None => Err("cancelled".to_string()),
    }
}

#[tauri::command(rename_all = "snake_case")]
fn run_backup(app: tauri::AppHandle) -> Result<String, String> {
    match do_run_backup(&app) {
        Ok(v) => Ok(v),
        Err(e) => {
            Err(e)
        }
    }
}

fn remove_wal_files(path: &std::path::Path) {
    let s = path.to_string_lossy().to_string();
    for suffix in &["-wal", "-shm"] {
        let _ = std::fs::remove_file(format!("{s}{suffix}"));
    }
}

fn do_run_backup(app: &tauri::AppHandle) -> Result<String, String> {
    let now = chrono::Local::now();
    let timestamp = now.format("%Y-%m-%d %H:%M:%S").to_string();
    let today = now.format("%Y-%m-%d").to_string();
    let backup_filename = format!("gym_backup_{}.db", today);
    let db_path = get_db_path(&app).unwrap_or_else(|_| std::path::PathBuf::from("D:\\css\\gym-management\\gym_system.db"));
    let backup_dir = (|| -> Option<std::path::PathBuf> {
        let state = app.try_state::<DbState>()?;
        let guard = state.0.lock().ok()?;
        let db = guard.as_ref()?;
        let conn = db.conn.lock().ok()?;
        let val: String = conn.query_row("SELECT value FROM app_settings WHERE key='backup_folder'", [], |row| row.get(0)).ok()?;
        if val.is_empty() { None } else { Some(std::path::PathBuf::from(val)) }
    })().unwrap_or_else(|| db_path.parent().unwrap_or(std::path::Path::new("D:\\")).to_path_buf());

    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    // WAL checkpoint: flush all WAL data into the main .db file before copying
    if let Some(state) = app.try_state::<DbState>() {
        if let Ok(guard) = state.0.lock() {
            if let Some(db) = guard.as_ref() {
                if let Ok(conn) = db.conn.lock() {
                    let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
                }
            }
        }
    }

    let local_backup_path = backup_dir.join(&backup_filename);

    // Copy to local backup folder with date filename
    std::fs::copy(&db_path, &local_backup_path).map_err(|e| e.to_string())?;

    // Close connection to checkpoint WAL (prevents -wal/-shm from lingering)
    {
        let _ = rusqlite::Connection::open(&local_backup_path);
    }
    remove_wal_files(&local_backup_path);

    // Keep only the 2 most recent backup files
    let mut backups: Vec<(chrono::NaiveDate, std::path::PathBuf)> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&backup_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("gym_backup_") && name.ends_with(".db") {
                let date_str = name.trim_start_matches("gym_backup_").trim_end_matches(".db");
                if let Ok(file_date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                    backups.push((file_date, entry.path()));
                }
            }
        }
    }
    backups.sort_by(|a, b| b.0.cmp(&a.0));
    for (_, path) in backups.into_iter().skip(2) {
        let _ = std::fs::remove_file(path);
    }

    // Save timestamp
    if let Some(state) = app.try_state::<DbState>() {
        if let Ok(guard) = state.0.lock() {
            if let Some(db) = guard.as_ref() {
                let _ = db.conn.lock().map(|conn| {
                    let _ = conn.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('last_backup_time', ?1)", params![timestamp]);
                });
            }
        }
    }
    let _backup_path = backup_dir.join(&backup_filename).to_string_lossy().to_string();
    Ok(timestamp)
}

/// Once per calendar day, create a recoverable backup first, then compact the
/// live SQLite file. The maintenance routine never opens or edits backup files.
fn run_daily_database_maintenance(app: &tauri::AppHandle) -> Result<bool, String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let already_done = (|| -> Option<bool> {
        let state = app.try_state::<DbState>()?;
        let guard = state.0.lock().ok()?;
        let db = guard.as_ref()?;
        let conn = db.conn.lock().ok()?;
        let last: String = conn.query_row(
            "SELECT value FROM app_settings WHERE key='last_db_maintenance_date'",
            [],
            |row| row.get(0),
        ).unwrap_or_default();
        Some(last == today)
    })().unwrap_or(true);

    if already_done {
        return Ok(false);
    }

    // Keep a known-good copy before touching the live database. If this fails,
    // leave the live file untouched and try again later.
    do_run_backup(app)?;

    let db_path = get_db_path(app)?;
    Database::compact_live_database(&db_path.to_string_lossy())?;

    let state = app.try_state::<DbState>().ok_or_else(|| "Database not initialized".to_string())?;
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or_else(|| "Database not initialized".to_string())?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('last_db_maintenance_date', ?1)",
        params![today],
    ).map_err(|e| e.to_string())?;

    Ok(true)
}

#[tauri::command(rename_all = "snake_case")]
async fn restore_backup(app: tauri::AppHandle, _which: String) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;

    let picked = app.dialog()
        .file()
        .add_filter("Database", &["db"])
        .blocking_pick_file();

    let src = match picked {
        Some(p) => std::path::PathBuf::from(p.to_string()),
        None => return Err("cancelled".to_string()),
    };

    if !src.exists() {
        return Err("Selected file not found".into());
    }

    let db_path = get_db_path(&app)
        .unwrap_or_else(|_| std::path::PathBuf::from("D:\\css\\gym-management\\gym_system.db"));

    // Read backup folder settings before closing the connection
    let backup_dirs = {
        let state = app.state::<DbState>();
        let guard = state.0.lock().map_err(|e| e.to_string())?;
        let default = db_path.parent().unwrap_or(std::path::Path::new("D:\\")).to_path_buf();
        let mut dirs: Vec<std::path::PathBuf> = Vec::new();
        if let Some(database) = guard.as_ref() {
            if let Ok(conn) = database.conn.lock() {
                if let Ok(val) = conn.query_row::<String, _, _>("SELECT value FROM app_settings WHERE key='backup_folder'", [], |row| row.get(0)) {
                    if !val.is_empty() { dirs.push(std::path::PathBuf::from(val)); }
                }
            }
        }
        if dirs.is_empty() { dirs.push(default); }
        dirs
    };

    // Close existing connection before copying
    {
        let state = app.state::<DbState>();
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }

    // Copy selected file over the current database
    std::fs::copy(&src, &db_path).map_err(|e| e.to_string())?;

    // Clean up stale backup files (they reference old data timeline)
    for folder in &backup_dirs {
        if let Ok(entries) = std::fs::read_dir(folder) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("gym_backup_") && name.ends_with(".db") {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    }

    // Re-open fresh connection from the restored file
    let db = Database::new(db_path.to_string_lossy().to_string()).map_err(|e| e.to_string())?;
    db.initialize().map_err(|e| e.to_string())?;

    // Reset migration flag so it runs on the restored data
    {
        if let Ok(conn) = db.conn.lock() {
            let _ = conn.execute("DELETE FROM app_settings WHERE key='photo_recompress_v2'", []);
        }
    }

    // Run pending migrations (photo recompression, etc.) in background with own connection
    let mig_path = db_path.to_string_lossy().to_string();
    std::thread::spawn(move || {
        Database::run_photo_migration(&mig_path);
    });

    let state = app.state::<DbState>();
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = Some(db);

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn get_backup_info(app: tauri::AppHandle) -> Result<String, String> {
    let db_path = get_db_path(&app).unwrap_or_else(|_| std::path::PathBuf::from("D:\\css\\gym-management\\gym_system.db"));
    let backup_dir = (|| -> Option<std::path::PathBuf> {
        let state = app.try_state::<DbState>()?;
        let guard = state.0.lock().ok()?;
        let db = guard.as_ref()?;
        let conn = db.conn.lock().ok()?;
        let val: String = conn.query_row("SELECT value FROM app_settings WHERE key='backup_folder'", [], |row| row.get(0)).ok()?;
        if val.is_empty() { None } else { Some(std::path::PathBuf::from(val)) }
    })().unwrap_or_else(|| db_path.parent().unwrap_or(std::path::Path::new("D:\\")).to_path_buf());
    let backup_path = std::fs::read_dir(&backup_dir).ok()
        .and_then(|entries| {
            entries.flatten()
                .filter(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    name.starts_with("gym_backup_") && name.ends_with(".db")
                })
                .max_by_key(|e| e.file_name())
                .map(|e| e.path())
        })
        .unwrap_or_else(|| backup_dir.join("gym_backup.db"));
    let current_time = std::fs::metadata(&backup_path).ok().and_then(|m| m.modified().ok()).map(|t| {
        let dt: chrono::DateTime<chrono::Local> = t.into();
        dt.format("%Y-%m-%d %H:%M:%S").to_string()
    }).unwrap_or_default();
    let last_backup = (|| -> Option<String> {
        let state = app.try_state::<DbState>()?;
        let guard = state.0.lock().ok()?;
        let db = guard.as_ref()?;
        let conn = db.conn.lock().ok()?;
        conn.query_row("SELECT value FROM app_settings WHERE key='last_backup_time'", [], |row| row.get(0)).ok()
    })().unwrap_or_default();
    let json = serde_json::json!({
        "current_file": backup_path.to_string_lossy().to_string(),
        "previous_file": "",
        "current_time": current_time,
        "previous_time": "",
        "last_backup": last_backup,
        "backup_folder": backup_dir.to_string_lossy().to_string(),
    });
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
async fn pick_backup_folder(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();
    match folder {
        Some(path) => Ok(path.to_string()),
        None => Err("cancelled".to_string()),
    }
}

#[tauri::command(rename_all = "snake_case")]
async fn pick_card_save_folder(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();
    match folder {
        Some(path) => Ok(path.to_string()),
        None => Err("cancelled".to_string()),
    }
}

fn generate_unique_member_card_code(conn: &rusqlite::Connection) -> Result<String, String> {
    for _ in 0..100 {
        let digits = (uuid::Uuid::new_v4().as_u128() % 1_000_000) as u32;
        let code = format!("MRX-{:06}", digits);
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM cards WHERE card_code=?1",
            params![code],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        if !exists {
            return Ok(code);
        }
    }
    Err("Could not generate a unique card code".into())
}

#[tauri::command(rename_all = "snake_case")]
fn save_member_card_png(app: tauri::AppHandle, file_name: String, png_bytes: Vec<u8>) -> Result<String, String> {
    let db = get_db(&app)?;
    let folder = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT COALESCE(NULLIF((SELECT value FROM app_settings WHERE key='gym_card_save_folder'), ''), (SELECT value FROM app_settings WHERE key='card_save_folder'))",
            [],
            |row| row.get::<_, String>(0),
        ).unwrap_or_default()
    };

    let folder_path: std::path::PathBuf = if folder.is_empty() {
        use tauri_plugin_dialog::DialogExt;
        let picked = app.dialog().file().blocking_pick_folder().ok_or_else(|| "cancelled".to_string())?;
        let picked_path: std::path::PathBuf = picked.to_string().into();
        let picked_string = picked_path.to_string_lossy().to_string();
        let conn = db.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('gym_card_save_folder', ?1)",
            params![picked_string],
        ).map_err(|e| e.to_string())?;
        picked_path
    } else {
        std::path::PathBuf::from(folder)
    };

    std::fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;
    let clean_name = file_name
        .replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_")
        .replace(' ', "_");
    let path = folder_path.join(clean_name);
    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(&png_bytes).map_err(|e| e.to_string())?;
    Ok(folder_path.to_string_lossy().to_string())
}

// ─── MEMBERS ────────────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn get_members(app: tauri::AppHandle) -> Result<Vec<Member>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, phone, card_code, '', plan_id, start_date, end_date, status, inbody_used, invitation_used, freeze_used, private_used, frozen_until, freeze_start_date, freeze_days_entered, gender, plan_name, plan_price, plan_duration_months, plan_inbody_count, plan_invitation_count, plan_freeze_days, plan_private_sessions FROM members ORDER BY name").map_err(|e| e.to_string())?;
    let members = stmt.query_map([], |row| {
        Ok(Member {
            id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?, card_code: row.get(3)?,
            photo: String::new(), plan_id: row.get(5)?, start_date: row.get(6)?, end_date: row.get(7)?,
            status: row.get(8)?, inbody_used: row.get(9)?, invitation_used: row.get(10)?,
            freeze_used: row.get(11)?, private_used: row.get(12)?, frozen_until: row.get(13)?, freeze_start_date: row.get(14)?, freeze_days_entered: row.get(15)?, gender: row.get(16)?,
            plan_name: row.get(17)?, plan_price: row.get(18)?, plan_duration_months: row.get(19)?,
            plan_inbody_count: row.get(20)?, plan_invitation_count: row.get(21)?,
            plan_freeze_days: row.get(22)?, plan_private_sessions: row.get(23)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(members)
}

// Lists are intentionally photo-free. Full member photos are fetched only when
// a profile is opened through get_member_by_id.
#[tauri::command(rename_all = "snake_case")]
fn get_members_light(app: tauri::AppHandle) -> Result<Vec<Member>, String> {
    get_members(app)
}

#[tauri::command(rename_all = "snake_case")]
fn get_member_by_id(app: tauri::AppHandle, member_id: String) -> Result<Option<Member>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let member = conn.query_row(
        "SELECT id, name, phone, card_code, photo, plan_id, start_date, end_date, status, inbody_used, invitation_used, freeze_used, private_used, frozen_until, freeze_start_date, freeze_days_entered, gender, plan_name, plan_price, plan_duration_months, plan_inbody_count, plan_invitation_count, plan_freeze_days, plan_private_sessions FROM members WHERE id=?1",
        params![member_id],
        |row| Ok(Member {
            id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?, card_code: row.get(3)?,
            photo: row.get(4)?, plan_id: row.get(5)?, start_date: row.get(6)?, end_date: row.get(7)?,
            status: row.get(8)?, inbody_used: row.get(9)?, invitation_used: row.get(10)?,
            freeze_used: row.get(11)?, private_used: row.get(12)?, frozen_until: row.get(13)?, freeze_start_date: row.get(14)?, freeze_days_entered: row.get(15)?, gender: row.get(16)?,
            plan_name: row.get(17)?, plan_price: row.get(18)?, plan_duration_months: row.get(19)?,
            plan_inbody_count: row.get(20)?, plan_invitation_count: row.get(21)?,
            plan_freeze_days: row.get(22)?, plan_private_sessions: row.get(23)?,
        }),
    ).optional().map_err(|e| e.to_string())?;
    Ok(member)
}

#[tauri::command(rename_all = "snake_case")]
fn add_member(app: tauri::AppHandle, id: String, name: String, phone: String, card_code: String, photo: String, plan_id: String, start_date: String, end_date: String, status: String, plan_name: String, gender: String) -> Result<String, String> {
    let db = get_db(&app)?;
    let assigned_card_code: String;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let (pn, pp, pd, pi, piv, pf, pps): (String, f64, i32, i32, i32, i32, i32) = conn.query_row(
            "SELECT name, price, duration_months, inbody_count, invitation_count, freeze_days, private_sessions FROM plans WHERE id=?1",
            params![plan_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?)),
        ).map_err(|e| format!("Plan not found: {e}"))?;
        assigned_card_code = if card_code.is_empty() {
            generate_unique_member_card_code(&conn)?
        } else {
            card_code
        };
        conn.execute(
            "INSERT INTO cards (card_code, created_at, status) VALUES (?1, ?2, 'available') ON CONFLICT(card_code) DO NOTHING",
            params![assigned_card_code, chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()],
        ).map_err(|e| e.to_string())?;
        let is_used: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM cards WHERE card_code=?1 AND status='used' AND member_id IS NOT NULL",
            params![assigned_card_code],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        if is_used {
            return Err("This card code is already used by another member.".into());
        }
        conn.execute(
            "INSERT INTO members (id, name, phone, card_code, photo, plan_id, start_date, end_date, status, inbody_used, invitation_used, freeze_used, private_used, gender, plan_name, plan_price, plan_duration_months, plan_inbody_count, plan_invitation_count, plan_freeze_days, plan_private_sessions) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,0,0,0,0,?10,?11,?12,?13,?14,?15,?16,?17)",
            params![id, name, phone, assigned_card_code, photo, plan_id, start_date, end_date, status, gender, pn, pp, pd, pi, piv, pf, pps],
        ).map_err(|e| e.to_string())?;
        conn.execute("UPDATE cards SET status='used', member_id=?1, assigned_at=?2 WHERE card_code=?3",
            params![id, chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(), assigned_card_code]).map_err(|e| e.to_string())?;
    }
    audit_log_raw(&app, &format!("New member: {} ({})", name, plan_name));
    Ok(assigned_card_code)
}

#[tauri::command(rename_all = "snake_case")]
fn update_member(app: tauri::AppHandle, id: String, name: String, phone: String, card_code: String, photo: String, plan_id: String, start_date: String, end_date: String) -> Result<(), String> {
    let db = get_db(&app)?;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        // Get old card_code
        let old_card: String = conn.query_row(
            "SELECT card_code FROM members WHERE id=?1", params![id], |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        // If card_code changed
        if old_card != card_code {
            // Release old card
            if !old_card.is_empty() {
                conn.execute("UPDATE cards SET status='available', member_id=NULL, assigned_at=NULL WHERE card_code=?1",
                    params![old_card]).map_err(|e| e.to_string())?;
            }
            // Validate and assign new card
            if !card_code.is_empty() {
                let exists: bool = conn.query_row(
                    "SELECT COUNT(*) > 0 FROM cards WHERE card_code=?1",
                    params![card_code], |row| row.get(0)
                ).map_err(|e| e.to_string())?;
                if !exists {
                    return Err("Card code not found. Create it from Card Manager first.".into());
                }
                let is_used: bool = conn.query_row(
                    "SELECT COUNT(*) > 0 FROM cards WHERE card_code=?1 AND status='used' AND member_id IS NOT NULL AND member_id!=?2",
                    params![card_code, id], |row| row.get(0)
                ).map_err(|e| e.to_string())?;
                if is_used {
                    return Err("This card code is already used by another member.".into());
                }
                conn.execute("UPDATE cards SET status='used', member_id=?1, assigned_at=datetime('now') WHERE card_code=?2",
                    params![id, card_code]).map_err(|e| e.to_string())?;
            }
        }
        // Update plan snapshot if plan_id changed
        let old_plan_id: String = conn.query_row(
            "SELECT plan_id FROM members WHERE id=?1", params![id], |row| row.get(0)
        ).unwrap_or_default();
        if old_plan_id != plan_id && !plan_id.is_empty() {
            let (pn, pp, pd, pi, piv, pf, pps): (String, f64, i32, i32, i32, i32, i32) = conn.query_row(
                "SELECT name, price, duration_months, inbody_count, invitation_count, freeze_days, private_sessions FROM plans WHERE id=?1",
                params![plan_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?)),
            ).map_err(|e| format!("Plan not found: {e}"))?;
            conn.execute(
                "UPDATE members SET name=?1, phone=?2, card_code=?3, photo=?4, plan_id=?5, start_date=?6, end_date=?7, plan_name=?8, plan_price=?9, plan_duration_months=?10, plan_inbody_count=?11, plan_invitation_count=?12, plan_freeze_days=?13, plan_private_sessions=?14 WHERE id=?15",
                params![name, phone, card_code, photo, plan_id, start_date, end_date, pn, pp, pd, pi, piv, pf, pps, id],
            ).map_err(|e| e.to_string())?;
        } else {
            conn.execute("UPDATE members SET name=?1, phone=?2, card_code=?3, photo=?4, plan_id=?5, start_date=?6, end_date=?7 WHERE id=?8",
                params![name, phone, card_code, photo, plan_id, start_date, end_date, id]).map_err(|e| e.to_string())?;
        }
    }
    audit_log_raw(&app, &format!("Edit member: {}", name));
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn delete_member(app: tauri::AppHandle, id: String, name: String) -> Result<(), String> {
    let db = get_db(&app)?;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        // Release card if assigned
        let card_code: String = conn.query_row(
            "SELECT card_code FROM members WHERE id=?1", params![id], |row| row.get(0)
        ).unwrap_or_default();
        if !card_code.is_empty() {
            conn.execute("UPDATE cards SET status='available', member_id=NULL, assigned_at=NULL WHERE card_code=?1",
                params![card_code]).map_err(|e| e.to_string())?;
        }
        conn.execute("DELETE FROM attendance WHERE member_id=?1", params![id]).map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM renewals WHERE member_id=?1", params![id]).map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM members WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    }
    audit_log_raw(&app, &format!("Delete member: {}", name));
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn renew_member(app: tauri::AppHandle, id: String, member_id: String, date: String, amount: f64, new_start: String, new_end: String, plan_id: String, plan_name: String, member_name: String) -> Result<(), String> {
    let db = get_db(&app)?;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        // Snapshot plan details at renewal time
        let (pn, pp, pd, pi, piv, pf, pps): (String, f64, i32, i32, i32, i32, i32) = conn.query_row(
            "SELECT name, price, duration_months, inbody_count, invitation_count, freeze_days, private_sessions FROM plans WHERE id=?1",
            params![plan_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?)),
        ).map_err(|e| format!("Plan not found: {e}"))?;
        conn.execute(
            "UPDATE members SET plan_id=?1, start_date=?2, end_date=?3, status='active', plan_name=?4, plan_price=?5, plan_duration_months=?6, plan_inbody_count=?7, plan_invitation_count=?8, plan_freeze_days=?9, plan_private_sessions=?10, inbody_used=0, invitation_used=0, freeze_used=0, private_used=0 WHERE id=?11",
            params![plan_id, new_start, new_end, pn, pp, pd, pi, piv, pf, pps, member_id],
        ).map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO renewals (id, member_id, date, amount, rtype) VALUES (?1,?2,?3,?4,'renewal')", params![id, member_id, date, amount]).map_err(|e| e.to_string())?;
    }
    audit_log_raw(&app, &format!("Renewal: {} ({})", member_name, plan_name));
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn record_payment(app: tauri::AppHandle, id: String, member_id: String, amount: f64, date: String, member_name: String) -> Result<(), String> {
    let db = get_db(&app)?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO renewals (id, member_id, date, amount, rtype) VALUES (?1,?2,?3,?4,'payment')", params![id, member_id, date, amount])
        .map_err(|e| e.to_string())?;
    audit_log_raw(&app, &format!("Payment: {} ({})", member_name, amount));
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn upgrade_member_plan(
    app: tauri::AppHandle,
    id: String,
    member_id: String,
    new_plan_id: String,
    new_end: String,
    amount_paid: f64,
    date: String,
    member_name: String,
    old_plan_name: String,
) -> Result<(), String> {
    let db = get_db(&app)?;
    let new_plan_name: String;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let (start_date, old_plan_id): (String, String) = conn.query_row(
            "SELECT start_date, plan_id FROM members WHERE id=?1",
            params![member_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|e| e.to_string())?;

        if old_plan_id == new_plan_id {
            return Err("Member is already on this plan".into());
        }
        if start_date.is_empty() {
            return Err("Member has no start date".into());
        }
        if new_end.is_empty() {
            return Err("Member has no end date".into());
        }

        let (pn, pp, pd, pi, piv, pf, pps): (String, f64, i32, i32, i32, i32, i32) = conn.query_row(
            "SELECT name, price, duration_months, inbody_count, invitation_count, freeze_days, private_sessions FROM plans WHERE id=?1",
            params![new_plan_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?)),
        ).map_err(|e| format!("Plan not found: {e}"))?;

        new_plan_name = pn.clone();

        let today = chrono::Local::now().date_naive();
        let status = if chrono::NaiveDate::parse_from_str(&new_end, "%Y-%m-%d")
            .map(|d| d >= today).unwrap_or(false) { "active" } else { "expired" };

        conn.execute(
            "UPDATE members SET plan_id=?1, end_date=?2, status=?3, plan_name=?4, plan_price=?5, plan_duration_months=?6, plan_inbody_count=?7, plan_invitation_count=?8, plan_freeze_days=?9, plan_private_sessions=?10, inbody_used=0, invitation_used=0, freeze_used=0, private_used=0 WHERE id=?11",
            params![new_plan_id, new_end, status, pn, pp, pd, pi, piv, pf, pps, member_id],
        ).map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO renewals (id, member_id, date, amount, rtype) VALUES (?1,?2,?3,?4,'upgrade')",
            params![id, member_id, date, amount_paid],
        ).map_err(|e| e.to_string())?;
    }
    audit_log_raw(&app, &format!("Upgrade: {} ({} → {})", member_name, old_plan_name, new_plan_name));
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn use_member_feature(app: tauri::AppHandle, member_id: String, feature: String) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let col = match feature.as_str() {
        "inbody" => "inbody_used",
        "invitation" => "invitation_used",
        "freeze" => "freeze_used",
        "private" => "private_used",
        _ => return Err("Invalid feature".into()),
    };
    let sql = format!("UPDATE members SET {} = {} + 1 WHERE id=?1", col, col);
    conn.execute(&sql, params![member_id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn freeze_member(app: tauri::AppHandle, member_id: String, days: i32) -> Result<(), String> {
    let db = get_db(&app)?;
    let member_name: String;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let (freeze_used, name, _end_date, status, current_frozen_until, current_freeze_start_date, current_freeze_days_entered, plan_freeze_days): (i32, String, String, String, String, String, i32, i32) = conn.query_row(
            "SELECT freeze_used, name, end_date, status, frozen_until, freeze_start_date, freeze_days_entered, plan_freeze_days FROM members WHERE id=?1",
            params![member_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?))
        ).map_err(|e| e.to_string())?;
        let available = plan_freeze_days - freeze_used;
        if days > available {
            return Err(format!("Max freeze days available: {}", available));
        }
        let now = chrono::Local::now().naive_local();
        let current_until = chrono::NaiveDateTime::parse_from_str(&current_frozen_until, "%Y-%m-%d %H:%M:%S").ok();
        let extend_existing_freeze = status == "frozen" && current_until.map(|until| until > now).unwrap_or(false);
        let base_time = if extend_existing_freeze { current_until.unwrap() } else { now };
        let frozen_until = (base_time + chrono::Duration::days(days as i64))
            .format("%Y-%m-%d %H:%M:%S")
            .to_string();
        let freeze_start_date = if extend_existing_freeze && !current_freeze_start_date.is_empty() {
            current_freeze_start_date
        } else {
            chrono::Local::now().format("%Y-%m-%d").to_string()
        };
        let freeze_days_entered = if extend_existing_freeze {
            current_freeze_days_entered + days
        } else {
            days
        };
        conn.execute(
            "UPDATE members SET freeze_used = freeze_used + ?1, status='frozen', frozen_until = ?2, freeze_start_date = ?3, freeze_days_entered = ?4, end_date = date(end_date, '+' || ?1 || ' days') WHERE id=?5",
            params![days, frozen_until, freeze_start_date, freeze_days_entered, member_id]
        ).map_err(|e| e.to_string())?;
        member_name = name;
    }
    audit_log_raw(&app, &format!("Freeze member: {} ({} days)", member_name, days));
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn unfreeze_member(app: tauri::AppHandle, member_id: String) -> Result<(), String> {
    let db = get_db(&app)?;
    let member_name: String;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        member_name = conn.query_row(
            "SELECT name FROM members WHERE id=?1",
            params![member_id],
            |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        conn.execute("UPDATE members SET status='active', frozen_until='', freeze_start_date='', freeze_days_entered=0 WHERE id=?1 AND status='frozen'",
            params![member_id]
        ).map_err(|e| e.to_string())?;
    }
    audit_log_raw(&app, &format!("Unfreeze member: {}", member_name));
    Ok(())
}

// ─── INACTIVE MEMBERS ───────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn check_inactive_members(app: tauri::AppHandle) -> Result<i32, String> {
    let db = get_db(&app)?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let updated = conn.execute(
        "UPDATE members SET status='noactive' WHERE status='active' AND end_date < date('now')",
        [],
    ).map_err(|e| e.to_string())?;
    Ok(updated as i32)
}

#[tauri::command(rename_all = "snake_case")]
fn update_member_dates(app: tauri::AppHandle, member_id: String, new_start: String, new_end: String) -> Result<(), String> {
    let db = get_db(&app)?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE members SET start_date=?1, end_date=?2 WHERE id=?3",
        params![new_start, new_end, member_id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn update_member_card_image(app: tauri::AppHandle, member_id: String, card_image: String) -> Result<(), String> {
    let db = get_db(&app)?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE members SET card_image=?1 WHERE id=?2",
        params![card_image, member_id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn get_member_card_image(app: tauri::AppHandle, member_id: String) -> Result<String, String> {
    let db = get_db(&app)?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let card_image: String = conn.query_row(
        "SELECT card_image FROM members WHERE id=?1",
        params![member_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    Ok(card_image)
}

// ─── PLANS ──────────────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn get_plans(app: tauri::AppHandle) -> Result<Vec<Plan>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let sql = "SELECT id, name, duration_months, price, inbody_count, invitation_count, freeze_days, private_sessions FROM plans ORDER BY name";
    let mut stmt = conn.prepare(sql).map_err(|e| format!("get_plans prepare: {e} (sql={sql})"))?;
    let plans = stmt.query_map([], |row| {
        Ok(Plan {
            id: row.get(0)?, name: row.get(1)?, duration_months: row.get(2)?, price: row.get(3)?,
            inbody_count: row.get(4)?, invitation_count: row.get(5)?, freeze_days: row.get(6)?, private_sessions: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(plans)
}

#[tauri::command(rename_all = "snake_case")]
fn add_plan(app: tauri::AppHandle, id: String, name: String, duration_months: i32, price: f64, inbody_count: i32, invitation_count: i32, freeze_days: i32, private_sessions: i32) -> Result<(), String> {
    let db = get_db(&app)?;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let sql = "INSERT INTO plans (id, name, duration_months, price, inbody_count, invitation_count, freeze_days, private_sessions) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)";
        conn.execute(sql, params![id, name, duration_months, price, inbody_count, invitation_count, freeze_days, private_sessions])
            .map_err(|e| format!("add_plan: {e} (sql={sql})"))?;
    }
    audit_log_raw(&app, &format!("Add plan: {}", name));
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn update_plan(app: tauri::AppHandle, id: String, name: String, duration_months: i32, price: f64, inbody_count: i32, invitation_count: i32, freeze_days: i32, private_sessions: i32) -> Result<(), String> {
    let db = get_db(&app)?;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        conn.execute("UPDATE plans SET name=?1, duration_months=?2, price=?3, inbody_count=?4, invitation_count=?5, freeze_days=?6, private_sessions=?7 WHERE id=?8",
            params![name, duration_months, price, inbody_count, invitation_count, freeze_days, private_sessions, id]).map_err(|e| e.to_string())?;
    }
    audit_log_raw(&app, &format!("Edit plan: {}", name));
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn delete_plan(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM plans WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── ATTENDANCE ─────────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn get_attendance(app: tauri::AppHandle, member_id: String) -> Result<Vec<Attendance>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, member_id, date, time, method FROM attendance WHERE member_id=?1 ORDER BY date DESC, time DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![member_id], |row| {
        Ok(Attendance { id: row.get(0)?, member_id: row.get(1)?, date: row.get(2)?, time: row.get(3)?, method: row.get(4)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

#[tauri::command(rename_all = "snake_case")]
fn get_attendance_by_date(app: tauri::AppHandle, date: String) -> Result<Vec<Attendance>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, member_id, date, time, method FROM attendance WHERE date=?1 ORDER BY time DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![date], |row| {
        Ok(Attendance { id: row.get(0)?, member_id: row.get(1)?, date: row.get(2)?, time: row.get(3)?, method: row.get(4)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

#[tauri::command(rename_all = "snake_case")]
fn check_attendance_today(app: tauri::AppHandle, member_id: String, date: String) -> Result<bool, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let count: i32 = conn.query_row("SELECT COUNT(*) FROM attendance WHERE member_id=?1 AND date=?2", params![member_id, date], |row| row.get(0)).map_err(|e| e.to_string())?;
    Ok(count > 0)
}

#[tauri::command(rename_all = "snake_case")]
fn add_attendance(app: tauri::AppHandle, id: String, member_id: String, date: String, time: String, method: String, _was_frozen: Option<bool>) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let (status, end_date): (String, String) = conn.query_row(
        "SELECT status, end_date FROM members WHERE id=?1",
        params![member_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;
    // The end date is inclusive: attendance is denied only after it has passed.
    // This backend check protects every caller, including manual attendance.
    if status == "expired" || (!end_date.is_empty() && end_date < date) {
        return Err("membership_expired".to_string());
    }
    conn.execute("INSERT INTO attendance (id, member_id, date, time, method) VALUES (?1,?2,?3,?4,?5)",
        params![id, member_id, date, time, method]).map_err(|e| e.to_string())?;
    conn.execute("UPDATE members SET status='active' WHERE id=?1 AND status='noactive'",
        params![member_id]).map_err(|e| e.to_string())?;
    drop(conn);
    app.emit("attendance-updated", serde_json::json!({ "member_id": member_id }))
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── RENEWALS ───────────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn get_renewals(app: tauri::AppHandle, member_id: String) -> Result<Vec<Renewal>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, member_id, date, amount, rtype FROM renewals WHERE member_id=?1 ORDER BY date DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![member_id], |row| {
        Ok(Renewal { id: row.get(0)?, member_id: row.get(1)?, date: row.get(2)?, amount: row.get(3)?, rtype: row.get(4)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

#[tauri::command(rename_all = "snake_case")]
fn get_all_renewals(app: tauri::AppHandle) -> Result<Vec<Renewal>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, member_id, date, amount, rtype FROM renewals ORDER BY date DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(Renewal { id: row.get(0)?, member_id: row.get(1)?, date: row.get(2)?, amount: row.get(3)?, rtype: row.get(4)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

// ─── SUPPLEMENTS ────────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn get_supplements(app: tauri::AppHandle) -> Result<Vec<Supplement>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, cost, price, stock, added_date FROM supplements ORDER BY name").map_err(|e| e.to_string())?;
    let items = stmt.query_map([], |row| {
        Ok(Supplement { id: row.get(0)?, name: row.get(1)?, cost: row.get(2)?, price: row.get(3)?, stock: row.get(4)?, added_date: row.get(5)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(items)
}

#[tauri::command(rename_all = "snake_case")]
fn add_supplement(app: tauri::AppHandle, id: String, name: String, cost: f64, price: f64, stock: i32) -> Result<(), String> {
    let db = get_db(&app)?;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO supplements (id, name, cost, price, stock, added_date) VALUES (?1,?2,?3,?4,?5, date('now'))",
            params![id, name, cost, price, stock]).map_err(|e| e.to_string())?;
    }
    audit_log_raw(&app, &format!("Add supplement: {}", name));
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn update_supplement(app: tauri::AppHandle, id: String, name: String, cost: f64, price: f64, stock: i32) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE supplements SET name=?1, cost=?2, price=?3, stock=?4 WHERE id=?5",
        params![name, cost, price, stock, id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn delete_supplement(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM supplements WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn get_supplement_orders(app: tauri::AppHandle) -> Result<Vec<SupplementOrder>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, supplement_id, qty, total_cost, total_price, profit, date, time FROM supplement_orders ORDER BY date DESC, time DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(SupplementOrder { id: row.get(0)?, supplement_id: row.get(1)?, qty: row.get(2)?, total_cost: row.get(3)?, total_price: row.get(4)?, profit: row.get(5)?, date: row.get(6)?, time: row.get(7)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

#[tauri::command(rename_all = "snake_case")]
fn add_supplement_order(app: tauri::AppHandle, id: String, supplement_id: String, qty: i32, total_cost: f64, total_price: f64, profit: f64) -> Result<(), String> {
    let db = get_db(&app)?;
    let sup_name: String;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO supplement_orders (id, supplement_id, qty, total_cost, total_price, profit, date, time) VALUES (?1,?2,?3,?4,?5,?6, date('now'), time('now'))",
            params![id, supplement_id, qty, total_cost, total_price, profit]).map_err(|e| e.to_string())?;
        conn.execute("UPDATE supplements SET stock = stock - ?1 WHERE id=?2", params![qty, supplement_id]).map_err(|e| e.to_string())?;
        sup_name = conn.query_row("SELECT name FROM supplements WHERE id=?1", params![supplement_id], |row| row.get(0)).map_err(|e| e.to_string())?;
    }
    audit_log_raw(&app, &format!("Supplement sale: {} x {}", qty, sup_name));
    Ok(())
}

// ─── AUDIT LOGS ─────────────────────────────────────────────────────────

fn audit_log_raw(app: &tauri::AppHandle, details: &str) {
    if let Some(state) = app.try_state::<DbState>() {
        if let Ok(guard) = state.0.lock() {
            if let Some(db) = guard.as_ref() {
                if let Ok(conn) = db.conn.lock() {
                    let id = uuid::Uuid::new_v4().to_string();
                    let _ = conn.execute(
                        "INSERT INTO audit_logs (id, action, details, date, time) VALUES (?1, ?2, ?3, date('now'), time('now'))",
                        params![id, details, details],
                    );
                }
            }
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
fn get_audit_logs(app: tauri::AppHandle) -> Result<Vec<AuditLog>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, action, details, date, time FROM audit_logs ORDER BY date DESC, time DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(AuditLog { id: row.get(0)?, action: row.get(1)?, details: row.get(2)?, date: row.get(3)?, time: row.get(4)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

#[tauri::command(rename_all = "snake_case")]
fn clear_audit_logs(app: tauri::AppHandle) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM audit_logs", []).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── SETTINGS ───────────────────────────────────────────────────────────

fn get_setting_value(app: &tauri::AppHandle, key: &str) -> Option<String> {
    let db = get_db(app).ok()?;
    let conn = db.lock().ok()?;
    conn.query_row(
        "SELECT value FROM app_settings WHERE key=?1",
        params![key],
        |row| row.get(0),
    ).ok()
}

#[tauri::command(rename_all = "snake_case")]
fn get_settings(app: tauri::AppHandle) -> Result<Vec<AppSetting>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT key, value FROM app_settings").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(AppSetting { key: row.get(0)?, value: row.get(1)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

#[tauri::command(rename_all = "snake_case")]
fn update_setting(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?1, ?2)", params![key, value]).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── PLAN STATS ─────────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn get_plan_stats(app: tauri::AppHandle) -> Result<String, String> {
    let db = get_db(&app)?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT plan_id, COUNT(*) as member_count FROM members WHERE plan_id IS NOT NULL AND plan_id != '' GROUP BY plan_id ORDER BY member_count DESC"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<(String, i32)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    serde_json::to_string(&rows).map_err(|e| e.to_string())
}

// ─── DASHBOARD STATS ────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn get_dashboard_stats(app: tauri::AppHandle) -> Result<String, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let total_members: i32 = conn.query_row("SELECT COUNT(*) FROM members", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let active_members: i32 = conn.query_row("SELECT COUNT(*) FROM members WHERE status='active'", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let expired_members: i32 = conn.query_row("SELECT COUNT(*) FROM members WHERE status='expired'", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let today_attendance: i32 = conn.query_row("SELECT COUNT(*) FROM attendance WHERE date=date('now')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let month_revenue: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM renewals WHERE date >= date('now','start of month') AND date < date('now','start of month','+1 month')", [], |r| r.get(0)
    ).map_err(|e| e.to_string())?;
    let supplement_profit: f64 = conn.query_row(
        "SELECT COALESCE(SUM(profit),0) FROM supplement_orders WHERE date >= date('now','start of month') AND date < date('now','start of month','+1 month')", [], |r| r.get(0)
    ).map_err(|e| e.to_string())?;

    let expiring_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM members WHERE status='active' AND end_date BETWEEN date('now') AND date('now','+7 days')", [], |r| r.get(0)
    ).map_err(|e| e.to_string())?;

    // Monthly chart data — use date ranges instead of strftime for index usage
    let chart_data: Vec<String> = (0..6).rev().map(|i| {
        let row: Result<(String, f64), _> = conn.query_row(
            "SELECT date,'YYYY-MM' as fmt, COALESCE(SUM(amount),0) FROM renewals
             WHERE date >= date('now','start of month',?1) AND date < date('now','start of month',?1,'+1 month')
             GROUP BY 1",
            params![format!("-{} months", i)],
            |r| {
                let raw_date: String = r.get(0)?;
                let month_part = raw_date.chars().take(7).collect::<String>();
                let amt: f64 = r.get(2)?;
                Ok((month_part, amt))
            },
        );
        match row {
            Ok((m, amt)) => format!("{{\"month\":\"{}\",\"revenue\":{},\"supplement_profit\":{}}}", m, amt, 0.0),
            Err(_) => format!("{{\"month\":\"M{}\",\"revenue\":0,\"supplement_profit\":0}}", i),
        }
    }).collect();

    let json = serde_json::json!({
        "total_members": total_members,
        "active_members": active_members,
        "expired_members": expired_members,
        "today_attendance": today_attendance,
        "month_revenue": month_revenue,
        "supplement_profit": supplement_profit,
        "total_revenue": month_revenue + supplement_profit,
        "expiring_count": expiring_count,
        "chart_data": chart_data,
    });
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
fn get_profits(app: tauri::AppHandle) -> Result<String, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let total_plan: f64 = conn.query_row("SELECT COALESCE(SUM(amount),0) FROM renewals", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let total_supplement_profit: f64 = conn.query_row("SELECT COALESCE(SUM(profit),0) FROM supplement_orders", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let today_plan: f64 = conn.query_row("SELECT COALESCE(SUM(amount),0) FROM renewals WHERE date=date('now')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let today_supplement: f64 = conn.query_row("SELECT COALESCE(SUM(profit),0) FROM supplement_orders WHERE date=date('now')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let month_plan: f64 = conn.query_row("SELECT COALESCE(SUM(amount),0) FROM renewals WHERE date >= date('now','start of month') AND date < date('now','start of month','+1 month')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let month_supplement: f64 = conn.query_row("SELECT COALESCE(SUM(profit),0) FROM supplement_orders WHERE date >= date('now','start of month') AND date < date('now','start of month','+1 month')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let year_plan: f64 = conn.query_row("SELECT COALESCE(SUM(amount),0) FROM renewals WHERE date >= date('now','start of year') AND date < date('now','start of year','+1 year')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let year_supplement: f64 = conn.query_row("SELECT COALESCE(SUM(profit),0) FROM supplement_orders WHERE date >= date('now','start of year') AND date < date('now','start of year','+1 year')", [], |r| r.get(0)).map_err(|e| e.to_string())?;

    let json = serde_json::json!({
        "total_plan": total_plan, "total_supplement_profit": total_supplement_profit,
        "total": total_plan + total_supplement_profit,
        "today_plan": today_plan, "today_supplement": today_supplement, "today": today_plan + today_supplement,
        "month_plan": month_plan, "month_supplement": month_supplement, "month": month_plan + month_supplement,
        "year_plan": year_plan, "year_supplement": year_supplement, "year": year_plan + year_supplement,
    });
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

// ─── FIND MEMBER BY CARD ────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn find_member_by_card(app: tauri::AppHandle, card_code: String) -> Result<Option<Member>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let raw = card_code.trim().to_uppercase();
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    let stripped_all: String = raw.chars().filter(|c| c.is_alphanumeric()).collect();

    let sql = "SELECT id, name, phone, card_code, photo, plan_id, start_date, end_date, status, inbody_used, invitation_used, freeze_used, private_used, frozen_until, freeze_start_date, freeze_days_entered, gender, plan_name, plan_price, plan_duration_months, plan_inbody_count, plan_invitation_count, plan_freeze_days, plan_private_sessions FROM members WHERE
        UPPER(TRIM(card_code)) = UPPER(TRIM(?1))
        OR REPLACE(UPPER(TRIM(card_code)), ' ', '') = REPLACE(UPPER(TRIM(?1)), ' ', '')
        OR REPLACE(UPPER(TRIM(card_code)), '-', '') = REPLACE(UPPER(TRIM(?1)), '-', '')
        OR UPPER(REPLACE(REPLACE(TRIM(card_code), ' ', ''), '-', '')) = UPPER(?2)
        OR (LENGTH(?3)>=3 AND (card_code LIKE '%' || ?3 OR phone LIKE '%' || ?3))
        OR UPPER(TRIM(phone)) = UPPER(TRIM(?1))
        OR id=?1
        LIMIT 1";
    let result = conn.query_row(sql, params![raw, stripped_all, digits], |row| {
        Ok(Member {
            id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?, card_code: row.get(3)?, photo: row.get(4)?, plan_id: row.get(5)?, start_date: row.get(6)?, end_date: row.get(7)?, status: row.get(8)?,
            inbody_used: row.get(9)?, invitation_used: row.get(10)?, freeze_used: row.get(11)?, private_used: row.get(12)?, frozen_until: row.get(13)?, freeze_start_date: row.get(14)?, freeze_days_entered: row.get(15)?, gender: row.get(16)?,
            plan_name: row.get(17)?, plan_price: row.get(18)?, plan_duration_months: row.get(19)?, plan_inbody_count: row.get(20)?, plan_invitation_count: row.get(21)?, plan_freeze_days: row.get(22)?, plan_private_sessions: row.get(23)?,
        })
    });
    match result {
        Ok(m) => Ok(Some(m)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

// ─── CARD MANAGER ───────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn get_all_cards(app: tauri::AppHandle, filter: String) -> Result<Vec<Card>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let sql = match filter.as_str() {
        "available" => "SELECT c.id, c.card_code, c.member_id, c.created_at, c.assigned_at, c.status, m.name as member_name, m.phone as member_phone FROM cards c LEFT JOIN members m ON c.member_id = m.id WHERE c.status='available' ORDER BY c.created_at DESC".to_string(),
        "used" => "SELECT c.id, c.card_code, c.member_id, c.created_at, c.assigned_at, c.status, m.name as member_name, m.phone as member_phone FROM cards c LEFT JOIN members m ON c.member_id = m.id WHERE c.status='used' ORDER BY c.created_at DESC".to_string(),
        _ => "SELECT c.id, c.card_code, c.member_id, c.created_at, c.assigned_at, c.status, m.name as member_name, m.phone as member_phone FROM cards c LEFT JOIN members m ON c.member_id = m.id ORDER BY c.created_at DESC".to_string(),
    };
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let cards = stmt.query_map([], |row| {
        Ok(Card {
            id: row.get(0)?, card_code: row.get(1)?, member_id: row.get(2)?,
            created_at: row.get(3)?, assigned_at: row.get(4)?, status: row.get(5)?,
            member_name: row.get(6)?, member_phone: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(cards)
}

#[tauri::command(rename_all = "snake_case")]
fn generate_cards(app: tauri::AppHandle, prefix: String, start: i32, count: i32) -> Result<GenerateResult, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let mut generated = 0;
    let mut skipped = 0;
    for i in 0..count {
        let code = format!("{}{:06}", prefix, start + i);
        match conn.execute("INSERT OR IGNORE INTO cards (card_code, created_at, status) VALUES (?1, ?2, 'available')", params![code, now]) {
            Ok(rows) => if rows > 0 { generated += 1 } else { skipped += 1 },
            Err(_) => { skipped += 1; }
        }
    }
    Ok(GenerateResult { generated, skipped })
}

#[tauri::command(rename_all = "snake_case")]
fn delete_available_cards(app: tauri::AppHandle) -> Result<i32, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let deleted = conn.execute("DELETE FROM cards WHERE status='available'", []).map_err(|e| e.to_string())?;
    Ok(deleted as i32)
}

#[tauri::command(rename_all = "snake_case")]
fn get_card_stats(app: tauri::AppHandle) -> Result<CardStats, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM cards", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let available: i64 = conn.query_row("SELECT COUNT(*) FROM cards WHERE status='available'", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let used: i64 = conn.query_row("SELECT COUNT(*) FROM cards WHERE status='used'", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    Ok(CardStats { total, available, used })
}

#[tauri::command(rename_all = "snake_case")]
fn validate_card_code(app: tauri::AppHandle, card_code: String) -> Result<String, String> {
    if card_code.is_empty() { return Ok("valid".into()); }
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM cards WHERE card_code=?1", params![card_code], |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    if !exists { return Ok("not_found".into()); }
    let is_used: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM cards WHERE card_code=?1 AND status='used'", params![card_code], |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    if is_used { return Ok("already_used".into()); }
    Ok("valid".into())
}

#[tauri::command(rename_all = "snake_case")]
fn assign_card(app: tauri::AppHandle, card_code: String, member_id: String) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE cards SET status='used', member_id=?1, assigned_at=datetime('now') WHERE card_code=?2",
        params![member_id, card_code]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn release_card(app: tauri::AppHandle, card_code: String) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE cards SET status='available', member_id=NULL, assigned_at=NULL WHERE card_code=?1",
        params![card_code]).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── INVITATIONS ────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
struct InvitationWithId {
    id: i64,
    member_id: String,
    member_name: String,
    guest_name: String,
    guest_phone: String,
    visits_used: i32,
    max_visits: i32,
    created_at: String,
}

#[tauri::command(rename_all = "snake_case")]
fn add_invitation(app: tauri::AppHandle, member_id: String, member_name: String, guest_name: String, guest_phone: String) -> Result<String, String> {
    let db = get_db(&app)?;
    let new_total: i32;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let plan_limits: (i32, i32) = conn.query_row(
            "SELECT invitation_used, plan_invitation_count
             FROM members
             WHERE id=?1",
            params![member_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|_| "Member not found.".to_string())?;
        let (member_invites_used, member_invites_total) = plan_limits;
        if member_invites_used >= member_invites_total {
            return Err("This member has no invitations left.".into());
        }

        let total_visits: i32 = conn.query_row(
            "SELECT COALESCE(SUM(CASE WHEN visits_used <= 0 THEN 1 ELSE visits_used END), 0) FROM invitations WHERE guest_phone=?1",
            params![guest_phone],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        if total_visits >= 3 {
            return Err("Guest phone has reached max 3 visits across all invitations.".into());
        }
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let existing_id: Option<i64> = conn.query_row(
            "SELECT id FROM invitations WHERE member_id=?1 AND guest_phone=?2 ORDER BY id DESC LIMIT 1",
            params![member_id, guest_phone],
            |row| row.get(0),
        ).ok();
        if let Some(inv_id) = existing_id {
            conn.execute(
                "UPDATE invitations
                 SET visits_used = CASE WHEN visits_used <= 0 THEN 2 ELSE visits_used + 1 END,
                     guest_name=?1, created_at=?2
                 WHERE id=?3",
                params![guest_name, now, inv_id],
            ).map_err(|e| e.to_string())?;
        } else {
            conn.execute(
                "INSERT INTO invitations (member_id, member_name, guest_name, guest_phone, visits_used, max_visits, created_at) VALUES (?1,?2,?3,?4,1,3,?5)",
                params![member_id, member_name, guest_name, guest_phone, now],
            ).map_err(|e| e.to_string())?;
        }
        conn.execute(
            "UPDATE members SET invitation_used = invitation_used + 1 WHERE id=?1",
            params![member_id],
        ).map_err(|e| e.to_string())?;
        new_total = total_visits + 1;
    }
    audit_log_raw(&app, &format!("Add invitation: {} invited by {}", guest_name, member_name));
    if new_total >= 3 {
        Ok("last_visit".into())
    } else {
        Ok("ok".into())
    }
}

#[tauri::command(rename_all = "snake_case")]
fn get_invitations(app: tauri::AppHandle) -> Result<Vec<InvitationWithId>, String> {
    let db = get_db(&app)?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "WITH latest AS (
            SELECT guest_phone, member_id, member_name, guest_name,
                   ROW_NUMBER() OVER (PARTITION BY guest_phone ORDER BY created_at DESC, id DESC) AS rn
            FROM invitations
        )
        SELECT
            MAX(i.id) AS id,
            l.member_id, l.member_name, l.guest_name,
            i.guest_phone,
            CASE
              WHEN SUM(CASE WHEN i.visits_used <= 0 THEN 1 ELSE i.visits_used END) > MAX(i.max_visits) THEN MAX(i.max_visits)
              ELSE SUM(CASE WHEN i.visits_used <= 0 THEN 1 ELSE i.visits_used END)
            END AS visits_used,
            MAX(i.max_visits) AS max_visits,
            MAX(i.created_at) AS created_at
         FROM invitations i
         LEFT JOIN latest l ON l.guest_phone = i.guest_phone AND l.rn = 1
         GROUP BY i.guest_phone
         ORDER BY MAX(i.created_at) DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(InvitationWithId {
            id: row.get(0)?, member_id: row.get(1)?, member_name: row.get(2)?,
            guest_name: row.get(3)?, guest_phone: row.get(4)?, visits_used: row.get(5)?,
            max_visits: row.get(6)?, created_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

#[tauri::command(rename_all = "snake_case")]
fn get_member_invitations(app: tauri::AppHandle, member_id: String) -> Result<Vec<InvitationWithId>, String> {
    let db = get_db(&app)?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "WITH latest AS (
            SELECT guest_phone, member_id, member_name, guest_name,
                   ROW_NUMBER() OVER (PARTITION BY guest_phone ORDER BY created_at DESC, id DESC) AS rn
            FROM invitations
            WHERE member_id=?1
        )
        SELECT
            MAX(i.id) AS id,
            i.member_id,
            l.member_name, l.guest_name,
            i.guest_phone,
            CASE
              WHEN SUM(CASE WHEN i.visits_used <= 0 THEN 1 ELSE i.visits_used END) > MAX(i.max_visits) THEN MAX(i.max_visits)
              ELSE SUM(CASE WHEN i.visits_used <= 0 THEN 1 ELSE i.visits_used END)
            END AS visits_used,
            MAX(i.max_visits) AS max_visits,
            MAX(i.created_at) AS created_at
         FROM invitations i
         LEFT JOIN latest l ON l.guest_phone = i.guest_phone AND l.rn = 1
         WHERE i.member_id=?1
         GROUP BY i.member_id, i.guest_phone
         ORDER BY MAX(i.created_at) DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![member_id], |row| {
        Ok(InvitationWithId {
            id: row.get(0)?, member_id: row.get(1)?, member_name: row.get(2)?,
            guest_name: row.get(3)?, guest_phone: row.get(4)?, visits_used: row.get(5)?,
            max_visits: row.get(6)?, created_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

#[tauri::command(rename_all = "snake_case")]
fn record_guest_visit(app: tauri::AppHandle, guest_phone: String) -> Result<String, String> {
    let db = get_db(&app)?;
    let guest_name: String;
    let member_name: String;
    let max_visits: i32;
    let next_visits: i32;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let total_visits: i32 = conn.query_row(
            "SELECT COALESCE(SUM(CASE WHEN visits_used <= 0 THEN 1 ELSE visits_used END), 0) FROM invitations WHERE guest_phone=?1",
            params![guest_phone],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        let invitation: (i64, String, String, String, i32, i32) = conn.query_row(
            "SELECT id, member_id, guest_name, member_name, visits_used, max_visits FROM invitations WHERE guest_phone=?1 ORDER BY id DESC LIMIT 1",
            params![guest_phone],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
        ).map_err(|_| "Guest phone not found in invitations.".to_string())?;
        let (inv_id, member_id, found_guest_name, found_member_name, _visits_used, found_max_visits) = invitation;
        if total_visits >= found_max_visits {
            return Err("Guest has already reached max visits.".into());
        }
        conn.execute("UPDATE invitations SET visits_used = CASE WHEN visits_used <= 0 THEN 2 ELSE visits_used + 1 END WHERE id=?1", params![inv_id]).map_err(|e| e.to_string())?;
        let att_id = uuid::Uuid::new_v4().to_string();
        let now_date = chrono::Local::now().format("%Y-%m-%d").to_string();
        let now_time = chrono::Local::now().format("%H:%M:%S").to_string();
        guest_name = found_guest_name;
        member_name = found_member_name;
        let method_str = format!("Invite|{}|{}", guest_name, member_name);
        conn.execute("INSERT INTO attendance (id, member_id, date, time, method) VALUES (?1,?2,?3,?4,?5)",
            params![att_id, member_id, now_date, now_time, method_str]).map_err(|e| e.to_string())?;
        max_visits = found_max_visits;
        next_visits = total_visits + 1;
    }
    audit_log_raw(&app, &format!("Guest visit: {} (invited by {})", guest_name, member_name));
    Ok(format!("Welcome, {}! Visits: {}/{}", guest_name, next_visits, max_visits))
}

// ─── EXPORT EXCEL ──────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn export_excel(app: tauri::AppHandle, filename_base: String, data: Vec<u8>) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;
    use std::io::Write;
    let file = app.dialog().file()
        .add_filter("Excel Files", &["xlsx"])
        .set_file_name(format!("{}.xlsx", filename_base))
        .blocking_save_file();
    match file {
        Some(path) => {
            let mut f = std::fs::File::create(path.as_path().ok_or("invalid path")?).map_err(|e| e.to_string())?;
            f.write_all(&data).map_err(|e| e.to_string())?;
            Ok(())
        }
        None => Err("cancelled".to_string()),
    }
}

// ─── AUTH ──────────────────────────────────────────────────────────────────

fn hash_password(password: &str) -> String {
    format!("{:x}", Sha256::digest(password.as_bytes()))
}

#[tauri::command(rename_all = "snake_case")]
fn create_user(app: tauri::AppHandle, username: String, password: String, role: String) -> Result<UserResponse, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let hashed = hash_password(&password);
    conn.execute("INSERT INTO users (id, username, password, role, created_at) VALUES (?1,?2,?3,?4,?5)",
        params![id, username, hashed, role, created_at]).map_err(|e| e.to_string())?;
    Ok(UserResponse { id, username, role })
}

#[tauri::command(rename_all = "snake_case")]
fn login_user(app: tauri::AppHandle, username: String, password: String) -> Result<UserResponse, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let hashed = hash_password(&password);
    let result = conn.query_row(
        "SELECT id, username, role FROM users WHERE username=?1 AND password=?2",
        params![username, hashed],
        |row| Ok(UserResponse { id: row.get(0)?, username: row.get(1)?, role: row.get(2)? })
    ).map_err(|_| "Invalid username or password".to_string())?;
    Ok(result)
}

fn username_taken(conn: &rusqlite::Connection, username: &str, exclude_role: &str) -> Result<bool, String> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE username=?1 AND role!=?2",
        params![username, exclude_role],
        |r| r.get(0)
    ).map_err(|e| e.to_string())?;
    Ok(count > 0)
}

#[tauri::command(rename_all = "snake_case")]
fn update_owner_credentials(app: tauri::AppHandle, username: String, password: String) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    if username_taken(&conn, &username, "owner")? {
        return Err("Username already taken by another account".into());
    }
    let hashed = hash_password(&password);
    conn.execute("UPDATE users SET username=?1, password=?2 WHERE role='owner'", params![username, hashed])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn reset_owner_password(app: tauri::AppHandle, new_password: String) -> Result<(), String> {
    if new_password.len() < 4 {
        return Err("Password too short".into());
    }
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let hashed = hash_password(&new_password);
    conn.execute("UPDATE users SET password=?1 WHERE role='owner'", params![hashed])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn update_admin_credentials(app: tauri::AppHandle, username: String, password: String) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    if username_taken(&conn, &username, "admin")? {
        return Err("Username already taken by another account".into());
    }
    let hashed = hash_password(&password);
    let exists: bool = conn.query_row("SELECT COUNT(*) > 0 FROM users WHERE role='admin'", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if exists {
        conn.execute("UPDATE users SET username=?1, password=?2 WHERE role='admin'", params![username, hashed])
            .map_err(|e| e.to_string())?;
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        let created_at = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute("INSERT INTO users (id, username, password, role, created_at) VALUES (?1,?2,?3,?4,?5)",
            params![id, username, hashed, "admin", created_at]).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn get_users(app: tauri::AppHandle) -> Result<Vec<UserResponse>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, username, role FROM users").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(UserResponse { id: row.get(0)?, username: row.get(1)?, role: row.get(2)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

// ─── RUN ────────────────────────────────────────────────────────────────

pub fn run() {
    let t_start = std::time::Instant::now();
    timing_log("run() START");
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![

            get_db_path_status, setup_db_folder, run_backup, restore_backup, get_backup_info, pick_backup_folder, pick_card_save_folder, save_member_card_png,
            get_members, get_members_light, get_member_by_id, add_member, update_member, delete_member, renew_member, upgrade_member_plan, record_payment, use_member_feature,
            get_plans, add_plan, update_plan, delete_plan, get_plan_stats,
            get_attendance, get_attendance_by_date, check_attendance_today, add_attendance,
            get_renewals, get_all_renewals,
            get_supplements, add_supplement, update_supplement, delete_supplement,
            get_supplement_orders, add_supplement_order,
            get_audit_logs, clear_audit_logs,
            get_settings, update_setting,
            get_dashboard_stats, get_profits,
            find_member_by_card,
            freeze_member, unfreeze_member,
            check_inactive_members, update_member_dates, update_member_card_image, get_member_card_image,
            get_all_cards, generate_cards, delete_available_cards, get_card_stats,
            validate_card_code, assign_card, release_card,
            add_invitation, get_invitations, get_member_invitations, record_guest_visit,
            export_excel,
            reset_owner_password,
            create_user, login_user, update_owner_credentials, update_admin_credentials,
            get_users, get_migration_progress,
        ])
        .setup(|app| {
            let t_setup = std::time::Instant::now();
            timing_log(".setup() START");
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.maximize();
                timing_log(&format!("Window maximize: {}ms", t_setup.elapsed().as_millis()));
            }
            let handle = app.handle().clone();
            let db_state = DbState(std::sync::Arc::new(std::sync::Mutex::new(None)));
            // If path is already saved, init DB right away
            if let Ok(db_path) = get_db_path(&handle) {
                timing_log(&format!("get_db_path: {}ms", t_setup.elapsed().as_millis()));
                if let Ok(db) = Database::new(db_path.to_string_lossy().to_string()) {
                    timing_log(&format!("Database::new done: {}ms", t_setup.elapsed().as_millis()));
                    let t_init = std::time::Instant::now();
                    let _ = db.initialize();
                    timing_log(&format!("db.initialize() done: {}ms (was {}ms)", t_setup.elapsed().as_millis(), t_init.elapsed().as_millis()));
                    *db_state.0.lock().map_err(|e| e.to_string())? = Some(db.clone());
                    timing_log(&format!("db_state set: {}ms", t_setup.elapsed().as_millis()));
                    // Run photo migration in background with its OWN connection (non-blocking)
                    let mig_path = db_path.to_string_lossy().to_string();
                    std::thread::spawn(move || {
                        let t_mig = std::time::Instant::now();
                        timing_log("photo_migration START (background, own connection)");
                        Database::run_photo_migration(&mig_path);
                        timing_log(&format!("photo_migration DONE: {}ms", t_mig.elapsed().as_millis()));
                    });
                    // Run backup after 3 seconds
                    let backup_handle = handle.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(3));
                        let _ = run_backup(backup_handle);
                    });
                    // Hourly backup — respects auto_backup setting
                    let hourly_handle = handle.clone();
                    std::thread::spawn(move || {
                        loop {
                            std::thread::sleep(std::time::Duration::from_secs(3600));
                            let auto = get_setting_value(&hourly_handle, "auto_backup")
                                .unwrap_or_else(|| "true".to_string());
                            if auto != "true" { continue; }
                            let _ = run_backup(hourly_handle.clone());
                        }
                    });
                    // Daily live-database maintenance. It first makes a normal
                    // backup, then compacts only the active DB file. Retrying
                    // hourly means a temporary busy/space error is harmless.
                    let maintenance_handle = handle.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(60));
                        loop {
                            match run_daily_database_maintenance(&maintenance_handle) {
                                Ok(true) => timing_log("daily DB maintenance completed"),
                                Ok(false) => {}
                                Err(e) => timing_log(&format!("daily DB maintenance skipped: {}", e)),
                            }
                            std::thread::sleep(std::time::Duration::from_secs(3600));
                        }
                    });
                    // WAL checkpoint every 30 min to prevent WAL file growth
                    let ckpt_handle = handle.clone();
                    std::thread::spawn(move || {
                        loop {
                            std::thread::sleep(std::time::Duration::from_secs(1800));
                            if let Some(state) = ckpt_handle.try_state::<DbState>() {
                                if let Ok(guard) = state.0.lock() {
                                    if let Some(db) = guard.as_ref() {
                                        if let Ok(conn) = db.conn.lock() {
                                            let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }
            handle.manage(db_state);
            open_attendance_window(&handle)?;
            timing_log(&format!("handle.manage(db_state): {}ms", t_setup.elapsed().as_millis()));
            timing_log(&format!(".setup() END TOTAL: {}ms", t_setup.elapsed().as_millis()));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    timing_log(&format!(".run() returned after {}ms", t_start.elapsed().as_millis()));
}




