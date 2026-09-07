mod secrets;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, WindowEvent,
};

/// Brings the main window back from the tray (or from behind other windows).
fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Turns on media capture and WebRTC, and answers the permission prompts.
///
/// A browser answers `getUserMedia` with a permission prompt. An embedded
/// WebKitGTK view has no prompt of its own: unless the host application
/// handles `permission-request`, every request is denied outright — which is
/// why calls and voice messages failed on Linux without ever asking.
///
/// Only media-device requests are granted here. Everything else keeps the
/// default deny, so this does not quietly become a blanket yes.
#[cfg(target_os = "linux")]
fn allow_media_devices(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    window.with_webview(|webview| {
        use webkit2gtk::glib::prelude::*;
        use webkit2gtk::{PermissionRequestExt, SettingsExt, UserMediaPermissionRequest, WebViewExt};

        let view = webview.inner();

        // Each of these is off or partial by default in WebKitGTK, and each
        // breaks something different: without `media_stream` there is no
        // `navigator.mediaDevices` at all, and without `webrtc` an
        // `RTCPeerConnection` negotiates but never carries audio or video —
        // which is a call that connects and stays silent.
        if let Some(settings) = WebViewExt::settings(&view) {
            settings.set_enable_media(true);
            settings.set_enable_media_stream(true);
            settings.set_enable_mediasource(true);
            settings.set_enable_webrtc(true);
        }

        view.connect_permission_request(|_, request| {
            if request.downcast_ref::<UserMediaPermissionRequest>().is_some() {
                request.allow();
                return true;
            }
            false
        });
    })
}

/// Tray icon with a two-item menu.
///
/// Closing the window only hides it, so the tray is the one place that can
/// actually quit the app — without it the process would be unkillable from
/// the UI.
fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Qora Qarg'a", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("Qora Qarg'a")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => focus_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    // The macOS menu bar expects a template image: a silhouette it recolours
    // for the light or dark bar and for selection. A full-colour icon there is
    // the mark of an app that was never looked at on a Mac.
    #[cfg(target_os = "macos")]
    {
        builder = builder.icon_as_template(true);
    }

    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // `mut` is only used on desktop, where the single-instance plugin is added.
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    // A second launch should raise the running window rather than start a
    // duplicate client holding a second WebSocket session.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_main_window(app);
        }));
    }

    builder
        .invoke_handler(tauri::generate_handler![
            secrets::secret_set,
            secrets::secret_get,
            secrets::secret_delete,
            secrets::device_name
        ])
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            build_tray(app.handle())?;

            #[cfg(target_os = "linux")]
            if let Some(window) = app.get_webview_window("main") {
                allow_media_devices(&window)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide instead of quitting: messages and calls keep arriving while
            // the app sits in the tray.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Qora Qarg'a");
}
