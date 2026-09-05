use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

/// Credential storage for the renderer.
///
/// The refresh token is a 180-day credential, so it must not live in
/// `localStorage`, where any script in the webview can read it. It is kept in
/// the app's private data directory instead, in a file the webview cannot open
/// and — on Unix — that only the owning user can read.
///
/// A real OS keychain (Secret Service, Keychain, Credential Manager) would be
/// the next step up; it is deliberately not pulled in here because it adds a
/// native dependency that fails to build on machines without the matching
/// development headers.
const SECRETS_FILE: &str = "secrets.json";

type SecretMap = HashMap<String, String>;

fn secrets_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("no data directory: {error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("cannot create data directory: {error}"))?;
    restrict_permissions(&dir, 0o700);
    Ok(dir.join(SECRETS_FILE))
}

/// Owner-only access. A no-op on platforms without Unix permission bits, where
/// the per-user data directory is already the access boundary.
fn restrict_permissions(path: &PathBuf, mode: u32) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = fs::metadata(path) {
            let mut permissions = metadata.permissions();
            permissions.set_mode(mode);
            let _ = fs::set_permissions(path, permissions);
        }
    }
    #[cfg(not(unix))]
    {
        let _ = (path, mode);
    }
}

fn read_all(app: &AppHandle) -> Result<SecretMap, String> {
    let path = secrets_path(app)?;
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(serde_json::from_str(&contents).unwrap_or_default()),
        // A missing file is the normal state before the first sign-in.
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(SecretMap::new()),
        Err(error) => Err(format!("cannot read secrets: {error}")),
    }
}

fn write_all(app: &AppHandle, secrets: &SecretMap) -> Result<(), String> {
    let path = secrets_path(app)?;
    let encoded =
        serde_json::to_string(secrets).map_err(|error| format!("cannot encode secrets: {error}"))?;
    fs::write(&path, encoded).map_err(|error| format!("cannot write secrets: {error}"))?;
    restrict_permissions(&path, 0o600);
    Ok(())
}

#[tauri::command]
pub fn secret_set(app: AppHandle, key: String, value: String) -> Result<(), String> {
    let mut secrets = read_all(&app)?;
    secrets.insert(key, value);
    write_all(&app, &secrets)
}

#[tauri::command]
pub fn secret_get(app: AppHandle, key: String) -> Result<Option<String>, String> {
    Ok(read_all(&app)?.get(&key).cloned())
}

#[tauri::command]
pub fn secret_delete(app: AppHandle, key: String) -> Result<(), String> {
    let mut secrets = read_all(&app)?;
    if secrets.remove(&key).is_none() {
        return Ok(());
    }
    write_all(&app, &secrets)
}

/// A name for this machine, shown in the account's device list so a user can
/// tell which row to revoke. Built from what the standard library already
/// knows, rather than pulling in a hostname crate.
#[tauri::command]
pub fn device_name() -> String {
    let os = match std::env::consts::OS {
        "macos" => "macOS",
        "windows" => "Windows",
        "linux" => "Linux",
        other => other,
    };

    let host = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .ok()
        .filter(|value| !value.trim().is_empty());

    match host {
        Some(name) => format!("Qora Qarga Desktop — {name} ({os})"),
        None => format!("Qora Qarga Desktop ({os})"),
    }
}
