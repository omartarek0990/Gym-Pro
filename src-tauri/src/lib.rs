mod database;

use database::{Database, Member, Plan, Attendance, Renewal, Supplement, SupplementOrder, NotificationLog, AuditLog, AppSetting, Card, CardStats, GenerateResult};
use tauri::Manager;
use rusqlite::params;
use std::io::Write;

fn get_db(app: &tauri::AppHandle) -> Result<std::sync::Arc<std::sync::Mutex<rusqlite::Connection>>, String> {
    Ok(app.state::<Database>().conn.clone())
}

// ─── INIT ───────────────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn init_database(app: tauri::AppHandle) -> Result<(), String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    let db_path = path.join("gympro.db");
    let db = Database::new(db_path.to_string_lossy().to_string()).map_err(|e| e.to_string())?;
    db.initialize().map_err(|e| e.to_string())?;
    app.manage(db);
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn run_backup(app: tauri::AppHandle) -> Result<String, String> {
    let now = chrono::Local::now();
    let timestamp = now.format("%Y-%m-%d %H:%M:%S").to_string();
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = path.join("gympro.db");
    let backup_dir = (|| -> Option<std::path::PathBuf> {
        let db = app.try_state::<Database>()?;
        let conn = db.conn.lock().ok()?;
        let val: String = conn.query_row("SELECT value FROM app_settings WHERE key='backup_folder'", [], |row| row.get(0)).ok()?;
        if val.is_empty() { None } else { Some(std::path::PathBuf::from(val)) }
    })().unwrap_or_else(|| path.clone());
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    let current = backup_dir.join("gym_backup_current.db");
    let previous = backup_dir.join("gym_backup_previous.db");
    // Step 1: copy current → previous
    if current.exists() {
        std::fs::copy(&current, &previous).map_err(|e| e.to_string())?;
    }
    // Step 2: copy gympro.db → current
    std::fs::copy(&db_path, &current).map_err(|e| e.to_string())?;
    // Save timestamp
    if let Some(db) = app.try_state::<Database>() {
        let _ = db.conn.lock().map(|conn| {
            let _ = conn.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('last_backup_time', ?1)", params![timestamp]);
        });
    }
    Ok(timestamp)
}

#[tauri::command(rename_all = "snake_case")]
fn restore_backup(app: tauri::AppHandle, which: String) -> Result<(), String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = path.join("gympro.db");
    let backup_dir = (|| -> Option<std::path::PathBuf> {
        let db = app.try_state::<Database>()?;
        let conn = db.conn.lock().ok()?;
        let val: String = conn.query_row("SELECT value FROM app_settings WHERE key='backup_folder'", [], |row| row.get(0)).ok()?;
        if val.is_empty() { None } else { Some(std::path::PathBuf::from(val)) }
    })().unwrap_or_else(|| path.clone());
    let src = match which.as_str() {
        "current" => backup_dir.join("gym_backup_current.db"),
        "previous" => backup_dir.join("gym_backup_previous.db"),
        _ => return Err("Invalid backup type".into()),
    };
    if !src.exists() { return Err("Backup file not found".into()); }
    std::fs::copy(&src, &db_path).map_err(|e| e.to_string())?;
    // Reload database
    let db = Database::new(db_path.to_string_lossy().to_string()).map_err(|e| e.to_string())?;
    db.initialize().map_err(|e| e.to_string())?;
    app.manage(db);
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn get_backup_info(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup_dir = (|| -> Option<std::path::PathBuf> {
        let db = app.try_state::<Database>()?;
        let conn = db.conn.lock().ok()?;
        let val: String = conn.query_row("SELECT value FROM app_settings WHERE key='backup_folder'", [], |row| row.get(0)).ok()?;
        if val.is_empty() { None } else { Some(std::path::PathBuf::from(val)) }
    })().unwrap_or_else(|| path.clone());
    let current_path = backup_dir.join("gym_backup_current.db");
    let previous_path = backup_dir.join("gym_backup_previous.db");
    let current_time = std::fs::metadata(&current_path).ok().and_then(|m| m.modified().ok()).map(|t| {
        let dt: chrono::DateTime<chrono::Local> = t.into();
        dt.format("%Y-%m-%d %H:%M:%S").to_string()
    }).unwrap_or_default();
    let previous_time = std::fs::metadata(&previous_path).ok().and_then(|m| m.modified().ok()).map(|t| {
        let dt: chrono::DateTime<chrono::Local> = t.into();
        dt.format("%Y-%m-%d %H:%M:%S").to_string()
    }).unwrap_or_default();
    let last_backup = (|| -> Option<String> {
        let db = app.try_state::<Database>()?;
        let conn = db.conn.lock().ok()?;
        conn.query_row("SELECT value FROM app_settings WHERE key='last_backup_time'", [], |row| row.get(0)).ok()
    })().unwrap_or_default();
    let json = serde_json::json!({
        "current_file": current_path.to_string_lossy().to_string(),
        "previous_file": previous_path.to_string_lossy().to_string(),
        "current_time": current_time,
        "previous_time": previous_time,
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
            "SELECT value FROM app_settings WHERE key='card_save_folder'",
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
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('card_save_folder', ?1)",
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
    let mut stmt = conn.prepare("SELECT id, name, phone, card_code, photo, plan_id, start_date, end_date, status, inbody_used, invitation_used, freeze_used, private_used, frozen_until, freeze_start_date, freeze_days_entered FROM members ORDER BY name").map_err(|e| e.to_string())?;
    let members = stmt.query_map([], |row| {
        Ok(Member {
            id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?, card_code: row.get(3)?,
            photo: row.get(4)?, plan_id: row.get(5)?, start_date: row.get(6)?, end_date: row.get(7)?,
            status: row.get(8)?, inbody_used: row.get(9)?, invitation_used: row.get(10)?,
            freeze_used: row.get(11)?, private_used: row.get(12)?, frozen_until: row.get(13)?, freeze_start_date: row.get(14)?, freeze_days_entered: row.get(15)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(members)
}

#[tauri::command(rename_all = "snake_case")]
fn add_member(app: tauri::AppHandle, id: String, name: String, phone: String, card_code: String, photo: String, plan_id: String, start_date: String, end_date: String, status: String, plan_name: String) -> Result<String, String> {
    let db = get_db(&app)?;
    let assigned_card_code: String;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
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
        conn.execute("INSERT INTO members (id, name, phone, card_code, photo, plan_id, start_date, end_date, status, inbody_used, invitation_used, freeze_used, private_used) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,0,0,0,0)",
            params![id, name, phone, assigned_card_code, photo, plan_id, start_date, end_date, status]).map_err(|e| e.to_string())?;
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
        conn.execute("UPDATE members SET name=?1, phone=?2, card_code=?3, photo=?4, plan_id=?5, start_date=?6, end_date=?7 WHERE id=?8",
            params![name, phone, card_code, photo, plan_id, start_date, end_date, id]).map_err(|e| e.to_string())?;
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
fn renew_member(app: tauri::AppHandle, id: String, member_id: String, date: String, amount: f64, new_start: String, new_end: String, plan_name: String, member_name: String) -> Result<(), String> {
    let db = get_db(&app)?;
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        conn.execute("UPDATE members SET start_date=?1, end_date=?2, status='active' WHERE id=?3", params![new_start, new_end, member_id]).map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO renewals (id, member_id, date, amount) VALUES (?1,?2,?3,?4)", params![id, member_id, date, amount]).map_err(|e| e.to_string())?;
    }
    audit_log_raw(&app, &format!("Renewal: {} ({})", member_name, plan_name));
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn use_member_feature(app: tauri::AppHandle, member_id: String, feature: String) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let col = match feature.as_str() {
        "inbody" => "inbody_used",
        "invitation" => "invitation_used",
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
        let (plan_id, freeze_used, name, _end_date, status, current_frozen_until, current_freeze_start_date, current_freeze_days_entered): (String, i32, String, String, String, String, String, i32) = conn.query_row(
            "SELECT plan_id, freeze_used, name, end_date, status, frozen_until, freeze_start_date, freeze_days_entered FROM members WHERE id=?1",
            params![member_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?))
        ).map_err(|e| e.to_string())?;
        let freeze_days: i32 = conn.query_row(
            "SELECT freeze_days FROM plans WHERE id=?1",
            params![plan_id],
            |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        let available = freeze_days - freeze_used;
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

// ─── PLANS ──────────────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn get_plans(app: tauri::AppHandle) -> Result<Vec<Plan>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, duration_months, price, inbody_count, invitation_count, freeze_days, private_sessions FROM plans ORDER BY name").map_err(|e| e.to_string())?;
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
        conn.execute("INSERT INTO plans (id, name, duration_months, price, inbody_count, invitation_count, freeze_days, private_sessions) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![id, name, duration_months, price, inbody_count, invitation_count, freeze_days, private_sessions]).map_err(|e| e.to_string())?;
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
fn get_all_attendance(app: tauri::AppHandle) -> Result<Vec<Attendance>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, member_id, date, time, method FROM attendance ORDER BY date DESC, time DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
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
fn add_attendance(app: tauri::AppHandle, id: String, member_id: String, date: String, time: String, method: String) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO attendance (id, member_id, date, time, method) VALUES (?1,?2,?3,?4,?5)",
        params![id, member_id, date, time, method]).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── RENEWALS ───────────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn get_renewals(app: tauri::AppHandle, member_id: String) -> Result<Vec<Renewal>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, member_id, date, amount FROM renewals WHERE member_id=?1 ORDER BY date DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![member_id], |row| {
        Ok(Renewal { id: row.get(0)?, member_id: row.get(1)?, date: row.get(2)?, amount: row.get(3)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

#[tauri::command(rename_all = "snake_case")]
fn get_all_renewals(app: tauri::AppHandle) -> Result<Vec<Renewal>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, member_id, date, amount FROM renewals ORDER BY date DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(Renewal { id: row.get(0)?, member_id: row.get(1)?, date: row.get(2)?, amount: row.get(3)? })
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

// ─── NOTIFICATIONS ──────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn get_notifications(app: tauri::AppHandle) -> Result<Vec<NotificationLog>, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, title, message, priority, date, time FROM notifications_log ORDER BY date DESC, time DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(NotificationLog { id: row.get(0)?, title: row.get(1)?, message: row.get(2)?, priority: row.get(3)?, date: row.get(4)?, time: row.get(5)? })
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    Ok(rows)
}

#[tauri::command(rename_all = "snake_case")]
fn add_notification(app: tauri::AppHandle, id: String, title: String, message: String, priority: String) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO notifications_log (id, title, message, priority, date, time) VALUES (?1,?2,?3,?4, date('now'), time('now'))",
        params![id, title, message, priority]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn clear_notifications(app: tauri::AppHandle) -> Result<(), String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notifications_log", []).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── AUDIT LOGS ─────────────────────────────────────────────────────────

fn audit_log_raw(app: &tauri::AppHandle, details: &str) {
    if let Some(state) = app.try_state::<Database>() {
        let id = uuid::Uuid::new_v4().to_string();
        let _ = state.conn.lock().unwrap().execute(
            "INSERT INTO audit_logs (id, action, details, date, time) VALUES (?1, ?2, ?3, date('now'), time('now'))",
            params![id, details, details],
        );
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

// ─── DASHBOARD STATS ────────────────────────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
fn get_dashboard_stats(app: tauri::AppHandle) -> Result<String, String> {
    let db = get_db(&app)?; let conn = db.lock().map_err(|e| e.to_string())?;
    let total_members: i32 = conn.query_row("SELECT COUNT(*) FROM members", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let active_members: i32 = conn.query_row("SELECT COUNT(*) FROM members WHERE status='active'", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let expired_members: i32 = conn.query_row("SELECT COUNT(*) FROM members WHERE status='expired'", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let today_attendance: i32 = conn.query_row("SELECT COUNT(*) FROM attendance WHERE date=date('now')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let month_revenue: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM renewals WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')", [], |r| r.get(0)
    ).map_err(|e| e.to_string())?;
    let supplement_profit: f64 = conn.query_row(
        "SELECT COALESCE(SUM(profit),0) FROM supplement_orders WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')", [], |r| r.get(0)
    ).map_err(|e| e.to_string())?;

    let expiring_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM members WHERE status='active' AND end_date BETWEEN date('now') AND date('now','+7 days')", [], |r| r.get(0)
    ).map_err(|e| e.to_string())?;

    // Monthly chart data
    let chart_data: Vec<String> = (0..6).rev().map(|i| {
        let row: Result<(String, f64), _> = conn.query_row(
            "SELECT strftime('%Y-%m', date), COALESCE(SUM(amount),0) FROM renewals WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now', ?1) COLLATE NOCASE",
            params![format!("-{} months", i)],
            |r| Ok((r.get(0)?, r.get(1)?)),
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
    let month_plan: f64 = conn.query_row("SELECT COALESCE(SUM(amount),0) FROM renewals WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let month_supplement: f64 = conn.query_row("SELECT COALESCE(SUM(profit),0) FROM supplement_orders WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let year_plan: f64 = conn.query_row("SELECT COALESCE(SUM(amount),0) FROM renewals WHERE strftime('%Y', date) = strftime('%Y', 'now')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let year_supplement: f64 = conn.query_row("SELECT COALESCE(SUM(profit),0) FROM supplement_orders WHERE strftime('%Y', date) = strftime('%Y', 'now')", [], |r| r.get(0)).map_err(|e| e.to_string())?;

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
    let result = conn.query_row(
        "SELECT id, name, phone, card_code, photo, plan_id, start_date, end_date, status, inbody_used, invitation_used, freeze_used, private_used, frozen_until, freeze_start_date, freeze_days_entered FROM members WHERE card_code=?1",
        params![card_code],
        |row| Ok(Member { id: row.get(0)?, name: row.get(1)?, phone: row.get(2)?, card_code: row.get(3)?, photo: row.get(4)?, plan_id: row.get(5)?, start_date: row.get(6)?, end_date: row.get(7)?, status: row.get(8)?, inbody_used: row.get(9)?, invitation_used: row.get(10)?, freeze_used: row.get(11)?, private_used: row.get(12)?, frozen_until: row.get(13)?, freeze_start_date: row.get(14)?, freeze_days_entered: row.get(15)? })
    );
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

// ─── RUN ────────────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            init_database, run_backup, restore_backup, get_backup_info, pick_backup_folder, pick_card_save_folder, save_member_card_png,
            get_members, add_member, update_member, delete_member, renew_member, use_member_feature,
            get_plans, add_plan, update_plan, delete_plan,
            get_attendance, get_all_attendance, check_attendance_today, add_attendance,
            get_renewals, get_all_renewals,
            get_supplements, add_supplement, update_supplement, delete_supplement,
            get_supplement_orders, add_supplement_order,
            get_notifications, add_notification, clear_notifications,
            get_audit_logs, clear_audit_logs,
            get_settings, update_setting,
            get_dashboard_stats, get_profits,
            find_member_by_card,
            freeze_member, unfreeze_member,
            get_all_cards, generate_cards, delete_available_cards, get_card_stats,
            validate_card_code, assign_card, release_card,
        ])
        .setup(|app| {
            let _ = init_database(app.handle().clone());
            // Run backup on startup (async)
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(3));
                let _ = run_backup(handle);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
