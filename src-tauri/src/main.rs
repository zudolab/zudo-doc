#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use std::{env, thread};

use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tower_http::services::ServeDir;

const DEFAULT_PORT: u16 = 4893;
const DEV_PORT: u16 = 4321;
const DOCS_PATH: &str = "/";
const IS_DEV: bool = cfg!(debug_assertions);

struct AppState {
    zoom: Mutex<f64>,
    port: u16,
}

// ── Helpers ───────────────────────────────────────

fn project_dir() -> std::path::PathBuf {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    std::path::PathBuf::from(manifest_dir)
        .parent()
        .expect("src-tauri must have a parent directory")
        .to_path_buf()
}

fn dist_dir() -> std::path::PathBuf {
    project_dir().join("dist")
}

fn docs_url(port: u16) -> String {
    let p = if IS_DEV { DEV_PORT } else { port };
    format!("http://localhost:{p}{DOCS_PATH}")
}

// ── Static file server ──────────────────────────

async fn ready_handler() -> impl IntoResponse {
    if dist_dir().join("index.html").exists() {
        (axum::http::StatusCode::OK, "ready")
    } else {
        (axum::http::StatusCode::SERVICE_UNAVAILABLE, "not ready")
    }
}

/// Try to bind a TCP listener on the given port, or fall back to port 0 (OS-assigned).
/// Returns the actual port the server is listening on.
fn start_server(preferred_port: u16) -> u16 {
    use std::sync::mpsc;
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("Failed to create tokio runtime");
        rt.block_on(async {
            let dist = dist_dir();
            let app = Router::new()
                .route("/___ready", get(ready_handler))
                .fallback_service(ServeDir::new(&dist));

            // Try preferred port first, then fall back to OS-assigned
            let addr = format!("127.0.0.1:{preferred_port}");
            let listener = match tokio::net::TcpListener::bind(&addr).await {
                Ok(l) => l,
                Err(_) => {
                    eprintln!("Port {preferred_port} in use, using OS-assigned port");
                    tokio::net::TcpListener::bind("127.0.0.1:0")
                        .await
                        .expect("Failed to bind any port")
                }
            };
            let actual_port = listener.local_addr().unwrap().port();
            let _ = tx.send(actual_port);

            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("Server error: {e}");
            }
        });
    });

    rx.recv().expect("Failed to receive port from server thread")
}

// ── Readiness polling ────────────────────────────

fn wait_for_ready(port: u16, timeout: Duration) {
    let start = Instant::now();
    let url = format!("http://localhost:{port}/___ready");
    while start.elapsed() < timeout {
        if let Ok(output) = Command::new("curl")
            .args(["-s", "-o", "/dev/null", "-w", "%{http_code}", &url])
            .output()
        {
            let code = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if code == "200" {
                return;
            }
        }
        thread::sleep(Duration::from_secs(1));
    }
}

// ── Refresh / Zoom ───────────────────────────────

fn do_refresh(app_handle: &AppHandle) {
    let state = app_handle.state::<AppState>();
    let port = state.port;
    if let Some(w) = app_handle.get_webview_window("main") {
        let _ = w.navigate(
            docs_url(port)
                .parse()
                .expect("BUG: docs_url produced an invalid URL"),
        );
    }
}

fn apply_zoom(app_handle: &AppHandle, level: f64) {
    let state = app_handle.state::<AppState>();
    *state.zoom.lock().unwrap() = level;
    if let Some(w) = app_handle.get_webview_window("main") {
        let _ = w.eval(&format!("document.body.style.zoom = '{level}'"));
    }
}

// ── Main ──────────────────────────────────────────

fn main() {
    let actual_port = if IS_DEV {
        DEV_PORT
    } else {
        start_server(DEFAULT_PORT)
    };

    let app_state = AppState {
        zoom: Mutex::new(1.0),
        port: actual_port,
    };

    tauri::Builder::default()
        .manage(app_state)
        .setup(move |app| {
            // ── Menu ──
            let app_menu = SubmenuBuilder::new(app, "ZudoDoc")
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
                    &MenuItemBuilder::with_id("refresh", "Refresh")
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
                "refresh" => {
                    let handle = app_handle.clone();
                    thread::spawn(move || do_refresh(&handle));
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
            if IS_DEV {
                let url: tauri::Url = docs_url(actual_port)
                    .parse()
                    .expect("BUG: docs_url produced an invalid URL");
                WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                    .title("ZudoDoc")
                    .inner_size(1200.0, 800.0)
                    .build()?;
            } else {
                // Show loading page immediately, navigate once server is ready
                WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                    .title("ZudoDoc")
                    .inner_size(1200.0, 800.0)
                    .build()?;

                let handle = app.handle().clone();
                thread::spawn(move || {
                    wait_for_ready(actual_port, Duration::from_secs(30));
                    if let Some(w) = handle.get_webview_window("main") {
                        let url: tauri::Url = docs_url(actual_port)
                            .parse()
                            .expect("BUG: docs_url produced an invalid URL");
                        let _ = w.navigate(url);
                    }
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::WindowEvent {
                event: tauri::WindowEvent::Destroyed,
                ..
            } = &event
            {
                app_handle.exit(0);
            }
        });
}
