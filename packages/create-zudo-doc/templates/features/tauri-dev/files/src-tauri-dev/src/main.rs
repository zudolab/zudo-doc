#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::thread;

use serde::Deserialize;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const IS_DEV: bool = cfg!(debug_assertions);

// ── Dev mode URL (matches tauri.conf.json devUrl) ──
const DEV_URL: &str = "http://localhost:4321/";

// ── Types ─────────────────────────────────────────

struct Sidecar {
    child: Child,
    pid: u32,
}

struct AppState {
    sidecar: Arc<Mutex<Option<Sidecar>>>,
    zoom: Mutex<f64>,
    // Resolved paths set once in setup(), then readable by menu handlers.
    app_log_path: Mutex<String>,
    sidecar_log_path: Mutex<String>,
    app_data_dir: Mutex<PathBuf>,
    // Bumped at the start of every launch attempt (initial setup + each
    // restart). A launch thread that finishes after a newer launch began
    // sees a mismatch and skips its navigate/emit so the two cannot race.
    launch_gen: AtomicU64,
}

/// Shape of config.json in the platform app-data dir.
// macOS path: ~/Library/Application Support/com.takazudo.zudo-doc-dev/config.json
#[derive(Debug, Deserialize)]
struct Config {
    version: u32,
    #[serde(rename = "projectDir")]
    project_dir: String,
    #[serde(rename = "devCommand")]
    dev_command: String,
    #[serde(rename = "devServerUrl")]
    dev_server_url: String,
}

// ── Logging ───────────────────────────────────────

fn log_to(path: &str, msg: &str) {
    use std::io::Write;
    if let Ok(mut f) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        let secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let _ = writeln!(f, "[{secs}] {msg}");
    }
}

// ── pnpm detection ────────────────────────────────

fn find_pnpm() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let candidates = [
        "/opt/homebrew/bin/pnpm".to_string(), // Apple Silicon Homebrew
        "/usr/local/bin/pnpm".to_string(),    // Intel Homebrew
        format!("{home}/.volta/bin/pnpm"),    // Volta shim (stable absolute path)
    ];
    for p in &candidates {
        let path = PathBuf::from(p);
        if path.exists() {
            return Some(path);
        }
    }
    if let Ok(output) = Command::new("/usr/bin/which").arg("pnpm").output() {
        let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path_str.is_empty() {
            let path = PathBuf::from(&path_str);
            if path.exists() {
                return Some(path);
            }
        }
    }
    None
}

// ── Config loading ────────────────────────────────

enum ConfigResult {
    Ok(Config),
    Missing,
    Invalid(String),
}

fn load_config(app_data_dir: &PathBuf, log_path: &str) -> ConfigResult {
    let config_path = app_data_dir.join("config.json");
    log_to(
        log_path,
        &format!("load_config: reading {}", config_path.display()),
    );
    let raw = match fs::read_to_string(&config_path) {
        Ok(r) => r,
        Err(e) => {
            log_to(log_path, &format!("load_config: missing ({e})"));
            return ConfigResult::Missing;
        }
    };
    let val: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            log_to(log_path, &format!("load_config: malformed JSON ({e})"));
            return ConfigResult::Invalid(format!("malformed JSON: {e}"));
        }
    };
    // version check before typed deserialization
    match val.get("version").and_then(|v| v.as_u64()) {
        Some(1) => {}
        other => {
            let msg = format!("unsupported version: {other:?}");
            log_to(log_path, &format!("load_config: {msg}"));
            return ConfigResult::Invalid(msg);
        }
    }
    match serde_json::from_value::<Config>(val) {
        Ok(c) => {
            // devCommand's first token must be `pnpm`: find_pnpm() resolves
            // only pnpm and spawn_sidecar substitutes it for token 0, so a
            // non-pnpm command would silently run the wrong binary.
            match c.dev_command.split_whitespace().next() {
                Some("pnpm") => {
                    log_to(
                        log_path,
                        &format!(
                            "load_config: ok projectDir={} devServerUrl={}",
                            c.project_dir, c.dev_server_url
                        ),
                    );
                    ConfigResult::Ok(c)
                }
                other => {
                    let msg =
                        format!("devCommand must start with 'pnpm' (got {other:?})");
                    log_to(log_path, &format!("load_config: {msg}"));
                    ConfigResult::Invalid(msg)
                }
            }
        }
        Err(e) => {
            let msg = format!("invalid fields: {e}");
            log_to(log_path, &format!("load_config: {msg}"));
            ConfigResult::Invalid(msg)
        }
    }
}

// ── Port helpers ──────────────────────────────────

fn parse_port(url: &str) -> Option<u16> {
    // Parses the port from a URL like "http://localhost:4321"
    url.split(':').nth(2).and_then(|s| {
        // strip any trailing path
        s.split('/').next()?.parse().ok()
    })
}

fn kill_port(port: u16, log_path: &str) {
    if let Ok(output) = Command::new("/usr/bin/lsof")
        .args(["-ti", &format!(":{port}")])
        .output()
    {
        let pids = String::from_utf8_lossy(&output.stdout);
        for line in pids.trim().lines() {
            if let Ok(pid) = line.trim().parse::<i32>() {
                log_to(
                    log_path,
                    &format!("kill_port: killing stale pid {pid} on port {port}"),
                );
                #[cfg(unix)]
                unsafe {
                    libc::kill(pid, libc::SIGTERM);
                }
            }
        }
        if !pids.trim().is_empty() {
            thread::sleep(Duration::from_millis(500));
        }
    }
}

// ── Sidecar management ──────────────────────────

/// Spawn the dev-server sidecar. Returns `Err` (instead of panicking) on the
/// realistic unhappy paths — a bad `projectDir`, an unwritable log location —
/// so the caller can surface a `launch-error` rather than leave the loading
/// spinner stuck forever in a panicked background thread.
fn spawn_sidecar(
    config: &Config,
    pnpm_path: &std::path::Path,
    sidecar_log_path: &str,
    app_log_path: &str,
) -> Result<Sidecar, String> {
    log_to(
        app_log_path,
        &format!(
            "spawn_sidecar: pnpm={} projectDir={} devCommand={}",
            pnpm_path.display(),
            config.project_dir,
            config.dev_command
        ),
    );

    let log_file = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(sidecar_log_path)
        .map_err(|e| {
            log_to(app_log_path, &format!("Failed to open sidecar log: {e}"));
            format!("failed to open sidecar log at {sidecar_log_path}: {e}")
        })?;
    let log_file_clone = log_file.try_clone().map_err(|e| {
        log_to(app_log_path, &format!("Failed to clone sidecar log handle: {e}"));
        format!("failed to clone sidecar log handle: {e}")
    })?;

    // devCommand is e.g. "pnpm dev" — first token is pnpm (verified by
    // load_config); pnpm_path replaces it, rest become args.
    let tokens: Vec<&str> = config.dev_command.split_whitespace().collect();
    let args: &[&str] = if tokens.len() > 1 { &tokens[1..] } else { &[] };

    let mut cmd = Command::new(pnpm_path);
    cmd.args(args)
        .current_dir(&config.project_dir)
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_file_clone));

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    let child = cmd.spawn().map_err(|e| {
        log_to(
            app_log_path,
            &format!("Failed to spawn sidecar (pnpm={}): {e}", pnpm_path.display()),
        );
        format!(
            "failed to spawn pnpm sidecar in {}: {e}",
            config.project_dir
        )
    })?;
    let pid = child.id();
    log_to(app_log_path, &format!("spawn_sidecar: pid={pid}"));

    Ok(Sidecar { child, pid })
}

fn kill_sidecar(sidecar: &mut Sidecar, log_path: &str) {
    log_to(log_path, &format!("kill_sidecar: pid={}", sidecar.pid));
    #[cfg(unix)]
    {
        if let Ok(pid) = i32::try_from(sidecar.pid) {
            unsafe { libc::kill(-pid, libc::SIGTERM) };
        }
    }
    thread::sleep(Duration::from_millis(500));
    match sidecar.child.try_wait() {
        Ok(Some(_)) => {
            log_to(log_path, "kill_sidecar: process already exited");
        }
        _ => {
            log_to(log_path, "kill_sidecar: escalating to SIGKILL");
            let _ = sidecar.child.kill();
            let _ = sidecar.child.wait();
        }
    }
}

// ── Readiness polling ────────────────────────────

/// Outcome of waiting for the dev server to become ready.
///
/// `SidecarExited` short-circuits the wait: once the sidecar process has
/// died there is no point burning the rest of the timeout on curl polls.
#[derive(Debug)]
enum ReadyResult {
    Ready,
    Timeout,
    SidecarExited { code: Option<i32> },
}

/// Poll dev server root via curl. Returns HTTP status code as string.
fn curl_ready(url: &str) -> String {
    Command::new("/usr/bin/curl")
        .args(["-s", "-o", "/dev/null", "-w", "%{http_code}", url])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "err".to_string())
}

/// Wait until the dev server responds with 200, up to timeout.
///
/// The `sidecar` handle is inspected each tick via `try_wait`; if it has
/// exited we return `SidecarExited` immediately instead of waiting out the
/// full timeout.
fn wait_for_ready(
    timeout: Duration,
    sidecar: &Arc<Mutex<Option<Sidecar>>>,
    dev_server_url: &str,
    log_path: &str,
) -> ReadyResult {
    log_to(log_path, "wait_for_ready: start");
    let probe_url = format!("{}/", dev_server_url.trim_end_matches('/'));
    let start = Instant::now();
    while start.elapsed() < timeout {
        // Check sidecar liveness before curl so we detect exits even if the
        // port still happens to be held (e.g. by a leftover process).
        {
            let mut guard = sidecar.lock().unwrap();
            if let Some(ref mut s) = *guard {
                match s.child.try_wait() {
                    Ok(Some(status)) => {
                        let code = status.code();
                        log_to(
                            log_path,
                            &format!(
                                "wait_for_ready: sidecar exited early (code={:?})",
                                code
                            ),
                        );
                        return ReadyResult::SidecarExited { code };
                    }
                    Ok(None) => {} // still running
                    Err(e) => {
                        log_to(log_path, &format!("wait_for_ready: try_wait error: {e}"));
                    }
                }
            }
        }

        let code = curl_ready(&probe_url);
        log_to(
            log_path,
            &format!("curl: {code} ({}s)", start.elapsed().as_secs()),
        );
        if code == "200" {
            log_to(log_path, "wait_for_ready: ready");
            return ReadyResult::Ready;
        }
        thread::sleep(Duration::from_secs(1));
    }
    log_to(log_path, "wait_for_ready: TIMEOUT — dev server may not be up");
    ReadyResult::Timeout
}

// ── Error emission ────────────────────────────────

fn emit_launch_error_str(app_handle: &AppHandle, reason: &str, sidecar_log_path: &str) {
    let payload = serde_json::json!({
        "reason": reason,
        "logPath": sidecar_log_path,
    });
    let state = app_handle.state::<AppState>();
    let app_log = state.app_log_path.lock().unwrap();
    log_to(
        &app_log,
        &format!(
            "emit_launch_error: reason={reason} logPath={sidecar_log_path}"
        ),
    );
    if let Some(w) = app_handle.get_webview_window("main") {
        if let Err(e) = w.emit("launch-error", payload) {
            log_to(&app_log, &format!("emit_launch_error: emit failed: {e}"));
        }
    } else {
        log_to(&app_log, "emit_launch_error: no main window to emit to");
    }
}

fn emit_launch_error(app_handle: &AppHandle, result: &ReadyResult) {
    let reason = match result {
        ReadyResult::Ready => return,
        ReadyResult::Timeout => "timeout",
        ReadyResult::SidecarExited { code } => {
            let state = app_handle.state::<AppState>();
            let app_log = state.app_log_path.lock().unwrap();
            log_to(
                &app_log,
                &format!("emit_launch_error: sidecar exit code = {code:?}"),
            );
            "sidecar_exited"
        }
    };
    let state = app_handle.state::<AppState>();
    let sidecar_log = state.sidecar_log_path.lock().unwrap().clone();
    drop(state);
    emit_launch_error_str(app_handle, reason, &sidecar_log);
}

// ── Restart dev server ────────────────────────────

fn do_restart(app_handle: &AppHandle) {
    if IS_DEV {
        // In dev mode, just navigate back to the dev URL.
        if let Some(w) = app_handle.get_webview_window("main") {
            let url: tauri::Url = DEV_URL.parse().expect("BUG: DEV_URL is invalid");
            let _ = w.navigate(url);
        }
        return;
    }

    let state = app_handle.state::<AppState>();
    let app_log = state.app_log_path.lock().unwrap().clone();
    let sidecar_log = state.sidecar_log_path.lock().unwrap().clone();
    let app_data_dir = state.app_data_dir.lock().unwrap().clone();
    // Claim a new launch generation: any in-flight launch (the initial setup
    // thread or an earlier restart) is now stale and will skip its navigate.
    let my_gen = state.launch_gen.fetch_add(1, Ordering::SeqCst) + 1;
    drop(state);

    log_to(&app_log, "do_restart: re-reading config.json");

    // 1. Re-read config.json
    let config = match load_config(&app_data_dir, &app_log) {
        ConfigResult::Ok(c) => c,
        ConfigResult::Missing => {
            emit_launch_error_str(app_handle, "config_missing", &sidecar_log);
            return;
        }
        ConfigResult::Invalid(_) => {
            emit_launch_error_str(app_handle, "config_invalid", &sidecar_log);
            return;
        }
    };

    let port = match parse_port(&config.dev_server_url) {
        Some(p) => p,
        None => {
            log_to(&app_log, "do_restart: could not parse port from devServerUrl");
            emit_launch_error_str(app_handle, "config_invalid", &sidecar_log);
            return;
        }
    };

    let pnpm_path = match find_pnpm() {
        Some(p) => {
            log_to(&app_log, &format!("do_restart: pnpm found at {}", p.display()));
            p
        }
        None => {
            log_to(&app_log, "do_restart: pnpm not found");
            emit_launch_error_str(app_handle, "pnpm_not_found", &sidecar_log);
            return;
        }
    };

    let dev_server_url = config.dev_server_url.clone();
    let state = app_handle.state::<AppState>();
    let sidecar_arc = state.sidecar.clone();

    // 2. Kill current sidecar
    {
        let mut guard = sidecar_arc.lock().unwrap();
        if let Some(mut old) = guard.take() {
            kill_sidecar(&mut old, &app_log);
        }
    }

    // 3. Kill stale port holders
    kill_port(port, &app_log);

    // 4. Spawn new sidecar
    {
        let mut guard = sidecar_arc.lock().unwrap();
        match spawn_sidecar(&config, &pnpm_path, &sidecar_log, &app_log) {
            Ok(s) => *guard = Some(s),
            Err(e) => {
                drop(guard);
                log_to(&app_log, &format!("do_restart: spawn failed: {e}"));
                emit_launch_error_str(app_handle, "spawn_failed", &sidecar_log);
                return;
            }
        }
    }

    // 5. Wait for ready (use full 120s — restart may point at a cold project)
    let result = wait_for_ready(
        Duration::from_secs(120),
        &sidecar_arc,
        &dev_server_url,
        &app_log,
    );

    // 6. Skip navigate/emit if a newer launch superseded this one.
    if app_handle.state::<AppState>().launch_gen.load(Ordering::SeqCst) != my_gen {
        log_to(
            &app_log,
            "do_restart: superseded by a newer launch — skipping navigate/emit",
        );
        return;
    }

    // 7. Navigate or emit error
    match result {
        ReadyResult::Ready => {
            if let Some(w) = app_handle.get_webview_window("main") {
                if let Ok(url) = dev_server_url.parse::<tauri::Url>() {
                    let _ = w.navigate(url);
                }
            }
        }
        ReadyResult::Timeout | ReadyResult::SidecarExited { .. } => {
            emit_launch_error(app_handle, &result);
        }
    }
}

fn apply_zoom(app_handle: &AppHandle, level: f64) {
    let state = app_handle.state::<AppState>();
    *state.zoom.lock().unwrap() = level;
    if let Some(w) = app_handle.get_webview_window("main") {
        let _ = w.eval(&format!("document.body.style.zoom = '{level}'"));
    }
}

#[tauri::command]
fn retry_launch(app_handle: AppHandle) {
    let state = app_handle.state::<AppState>();
    let app_log = state.app_log_path.lock().unwrap().clone();
    drop(state);
    log_to(&app_log, "retry_launch: invoked from frontend");
    thread::spawn(move || do_restart(&app_handle));
}

// ── Main ──────────────────────────────────────────

fn main() {
    // AppState is initialized with empty log path strings; they are filled in
    // during setup() once app_data_dir is available from AppHandle.
    let app_state = AppState {
        sidecar: Arc::new(Mutex::new(None)),
        zoom: Mutex::new(1.0),
        app_log_path: Mutex::new(String::new()),
        sidecar_log_path: Mutex::new(String::new()),
        app_data_dir: Mutex::new(PathBuf::new()),
        launch_gen: AtomicU64::new(0),
    };
    let sidecar_for_exit = app_state.sidecar.clone();

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![retry_launch])
        .setup(move |app| {
            // ── Resolve app-data paths ──
            // These are derived from the bundle identifier
            // (com.takazudo.zudo-doc-dev) via Tauri's path resolver.
            let app_data_dir = app.path().app_data_dir()
                .expect("app_data_dir unavailable");
            fs::create_dir_all(&app_data_dir)?;

            let app_log_path = app_data_dir.join("zudo-doc-dev.log")
                .to_string_lossy()
                .into_owned();
            let sidecar_log_path = app_data_dir.join("zudo-doc-dev-sidecar.log")
                .to_string_lossy()
                .into_owned();

            {
                let state = app.state::<AppState>();
                *state.app_log_path.lock().unwrap() = app_log_path.clone();
                *state.sidecar_log_path.lock().unwrap() = sidecar_log_path.clone();
                *state.app_data_dir.lock().unwrap() = app_data_dir.clone();
            }

            log_to(&app_log_path, "setup: starting zudo-doc dev");

            // ── Menu ──
            let app_menu = SubmenuBuilder::new(app, "zudo-doc dev")
                .about(None)
                .separator()
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(
                    &MenuItemBuilder::with_id("restart", "Restart dev server")
                        .accelerator("CmdOrCtrl+R")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id("devtools", "Toggle Developer Tools")
                        .accelerator("CmdOrCtrl+Alt+I")
                        .build(app)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::with_id("actual_size", "Actual Size")
                        .accelerator("CmdOrCtrl+0")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id("zoom_in", "Zoom In")
                        .accelerator("CmdOrCtrl+=")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id("zoom_out", "Zoom Out")
                        .accelerator("CmdOrCtrl+-")
                        .build(app)?,
                )
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(|app_handle, event| match event.id().as_ref() {
                "restart" => {
                    let handle = app_handle.clone();
                    thread::spawn(move || do_restart(&handle));
                }
                "devtools" => {
                    if let Some(w) = app_handle.get_webview_window("main") {
                        if w.is_devtools_open() {
                            w.close_devtools();
                        } else {
                            w.open_devtools();
                        }
                    }
                }
                "actual_size" => apply_zoom(app_handle, 1.0),
                "zoom_in" => {
                    let state = app_handle.state::<AppState>();
                    let z = (*state.zoom.lock().unwrap() + 0.1).min(3.0);
                    apply_zoom(app_handle, z);
                }
                "zoom_out" => {
                    let state = app_handle.state::<AppState>();
                    let z = (*state.zoom.lock().unwrap() - 0.1).max(0.1);
                    apply_zoom(app_handle, z);
                }
                _ => {}
            });

            // ── Window ──
            // Open immediately with the bundled loading page. In production
            // a background thread handles config loading, sidecar spawn, and
            // ready polling, then navigates to devServerUrl.
            if IS_DEV {
                let url: tauri::Url = DEV_URL.parse().expect("BUG: DEV_URL is invalid");
                WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                    .title("zudo-doc dev")
                    .inner_size(1200.0, 800.0)
                    .build()?;
            } else {
                // Show the bundled loading spinner immediately — never block setup().
                WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                    .title("zudo-doc dev")
                    .inner_size(1200.0, 800.0)
                    .build()?;

                let handle = app.handle().clone();
                let app_log = app_log_path.clone();
                let sidecar_log = sidecar_log_path.clone();
                let data_dir = app_data_dir.clone();

                thread::spawn(move || {
                    // Claim this launch's generation; a restart pressed during
                    // the wait below bumps it and makes this thread skip its
                    // navigate/emit so the two launches do not race.
                    let my_gen = {
                        let state = handle.state::<AppState>();
                        state.launch_gen.fetch_add(1, Ordering::SeqCst) + 1
                    };

                    // Load config.json — location is <app_data_dir>/config.json
                    let config = match load_config(&data_dir, &app_log) {
                        ConfigResult::Ok(c) => c,
                        ConfigResult::Missing => {
                            log_to(&app_log, "setup thread: config missing");
                            emit_launch_error_str(&handle, "config_missing", &sidecar_log);
                            return;
                        }
                        ConfigResult::Invalid(reason) => {
                            log_to(&app_log, &format!("setup thread: config invalid: {reason}"));
                            emit_launch_error_str(&handle, "config_invalid", &sidecar_log);
                            return;
                        }
                    };

                    let port = match parse_port(&config.dev_server_url) {
                        Some(p) => p,
                        None => {
                            log_to(
                                &app_log,
                                "setup thread: could not parse port from devServerUrl",
                            );
                            emit_launch_error_str(&handle, "config_invalid", &sidecar_log);
                            return;
                        }
                    };

                    let pnpm_path = match find_pnpm() {
                        Some(p) => {
                            log_to(
                                &app_log,
                                &format!("setup thread: pnpm found at {}", p.display()),
                            );
                            p
                        }
                        None => {
                            log_to(&app_log, "setup thread: pnpm not found");
                            emit_launch_error_str(&handle, "pnpm_not_found", &sidecar_log);
                            return;
                        }
                    };

                    // Kill any stale process holding the port before spawning.
                    kill_port(port, &app_log);

                    let state = handle.state::<AppState>();
                    let sidecar_arc = state.sidecar.clone();
                    drop(state);

                    {
                        let mut guard = sidecar_arc.lock().unwrap();
                        match spawn_sidecar(&config, &pnpm_path, &sidecar_log, &app_log) {
                            Ok(s) => *guard = Some(s),
                            Err(e) => {
                                drop(guard);
                                log_to(&app_log, &format!("setup thread: spawn failed: {e}"));
                                emit_launch_error_str(&handle, "spawn_failed", &sidecar_log);
                                return;
                            }
                        }
                    }

                    let dev_server_url = config.dev_server_url.clone();
                    let result = wait_for_ready(
                        Duration::from_secs(120),
                        &sidecar_arc,
                        &dev_server_url,
                        &app_log,
                    );

                    if handle.state::<AppState>().launch_gen.load(Ordering::SeqCst)
                        != my_gen
                    {
                        log_to(
                            &app_log,
                            "setup thread: superseded by a restart — skipping navigate/emit",
                        );
                        return;
                    }

                    match result {
                        ReadyResult::Ready => {
                            if let Some(w) = handle.get_webview_window("main") {
                                if let Ok(url) = dev_server_url.parse::<tauri::Url>() {
                                    let _ = w.navigate(url);
                                }
                            }
                        }
                        ReadyResult::Timeout | ReadyResult::SidecarExited { .. } => {
                            emit_launch_error(&handle, &result);
                        }
                    }
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |app_handle, event| match &event {
            tauri::RunEvent::WindowEvent {
                event: tauri::WindowEvent::Destroyed,
                ..
            } => {
                if !IS_DEV {
                    // Retrieve log path from AppState (set during setup()).
                    let log_path = {
                        let state = app_handle.state::<AppState>();
                        let p = state.app_log_path.lock().unwrap().clone();
                        p
                    };
                    if let Ok(mut g) = sidecar_for_exit.lock() {
                        if let Some(mut s) = g.take() {
                            kill_sidecar(&mut s, &log_path);
                        }
                    }
                }
                app_handle.exit(0);
            }
            _ => {}
        });
}

// ── Tests ─────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Stdio;

    fn read_tauri_conf() -> serde_json::Value {
        let conf_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json");
        let raw = std::fs::read_to_string(&conf_path).expect("Failed to read tauri.conf.json");
        serde_json::from_str(&raw).expect("Failed to parse tauri.conf.json")
    }

    #[test]
    fn find_pnpm_returns_valid_path_or_none() {
        let result = find_pnpm();
        if let Some(ref path) = result {
            assert!(path.is_absolute(), "pnpm path should be absolute");
            assert!(path.exists(), "returned pnpm path should exist");
        }
    }

    #[test]
    fn parse_port_standard_url() {
        assert_eq!(parse_port("http://localhost:4321"), Some(4321));
        assert_eq!(parse_port("http://localhost:4321/"), Some(4321));
        assert_eq!(parse_port("http://localhost:4321/docs/"), Some(4321));
    }

    #[test]
    fn parse_port_returns_none_for_missing() {
        assert_eq!(parse_port("not-a-url"), None);
    }

    #[test]
    fn tauri_conf_identifier_matches() {
        let conf = read_tauri_conf();
        let id = conf["identifier"].as_str().expect("identifier must be string");
        assert_eq!(id, "com.takazudo.zudo-doc-dev");
    }

    #[test]
    fn tauri_conf_product_name() {
        let conf = read_tauri_conf();
        let name = conf["productName"].as_str().expect("productName must be string");
        assert_eq!(name, "zudo-doc dev");
    }

    #[test]
    fn tauri_conf_dev_url_is_port_4321() {
        let conf = read_tauri_conf();
        let dev_url = conf["build"]["devUrl"].as_str().expect("devUrl must be string");
        assert!(
            dev_url.contains("4321"),
            "devUrl '{dev_url}' should reference port 4321"
        );
    }

    #[test]
    fn tauri_conf_enables_global_tauri() {
        let conf = read_tauri_conf();
        let flag = conf["app"]["withGlobalTauri"].as_bool();
        assert_eq!(
            flag,
            Some(true),
            "app.withGlobalTauri must be true for the bundled loading page"
        );
    }

    #[test]
    fn tauri_conf_before_dev_command() {
        let conf = read_tauri_conf();
        let cmd = conf["build"]["beforeDevCommand"]
            .as_str()
            .expect("beforeDevCommand must be a string");
        assert!(!cmd.is_empty(), "beforeDevCommand must not be empty");
        assert!(
            cmd.contains("pnpm dev"),
            "beforeDevCommand '{cmd}' should run pnpm dev"
        );
    }

    #[test]
    fn loading_page_wires_launch_error_and_retry_launch() {
        let html_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("frontend")
            .join("index.html");
        let html = std::fs::read_to_string(&html_path)
            .expect("Failed to read frontend/index.html");
        assert!(
            html.contains("\"launch-error\""),
            "frontend/index.html should listen for the launch-error event"
        );
        assert!(
            html.contains("\"retry_launch\""),
            "frontend/index.html should invoke the retry_launch command"
        );
    }

    #[test]
    fn wait_for_ready_detects_sidecar_exit() {
        let child = Command::new("/bin/sh")
            .args(["-c", "exit 7"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("failed to spawn test child");
        let pid = child.id();
        let sidecar = Arc::new(Mutex::new(Some(Sidecar { child, pid })));

        let start = Instant::now();
        let result = wait_for_ready(
            Duration::from_secs(30),
            &sidecar,
            "http://localhost:19999",
            "/dev/null",
        );
        let elapsed = start.elapsed();

        match result {
            ReadyResult::SidecarExited { code } => {
                assert_eq!(code, Some(7), "expected child exit code 7, got {code:?}");
                assert!(
                    elapsed < Duration::from_secs(10),
                    "SidecarExited should be detected quickly, took {elapsed:?}"
                );
            }
            other => panic!("expected SidecarExited, got {other:?}"),
        }
    }

    #[test]
    fn wait_for_ready_times_out_without_sidecar_or_server() {
        let sidecar: Arc<Mutex<Option<Sidecar>>> = Arc::new(Mutex::new(None));
        let start = Instant::now();
        let result = wait_for_ready(
            Duration::from_millis(100),
            &sidecar,
            "http://localhost:19998",
            "/dev/null",
        );
        let elapsed = start.elapsed();
        assert!(
            elapsed < Duration::from_secs(5),
            "wait_for_ready should exit quickly on short timeout, took {elapsed:?}"
        );
        match result {
            ReadyResult::Timeout | ReadyResult::Ready => {}
            ReadyResult::SidecarExited { .. } => {
                panic!("did not pass a sidecar — SidecarExited is impossible")
            }
        }
    }

    #[test]
    fn config_deserializes_valid_json() {
        let raw = r#"{
            "version": 1,
            "projectDir": "/Users/foo/repos/my-doc",
            "devCommand": "pnpm dev",
            "devServerUrl": "http://localhost:4321"
        }"#;
        let c: Config = serde_json::from_str(raw).expect("should parse");
        assert_eq!(c.version, 1);
        assert_eq!(c.project_dir, "/Users/foo/repos/my-doc");
        assert_eq!(c.dev_command, "pnpm dev");
        assert_eq!(c.dev_server_url, "http://localhost:4321");
    }
}
