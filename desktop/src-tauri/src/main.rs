// Windows release builds must not open a console window behind the app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Works around a WebKitGTK rendering fault before the webview starts.
///
/// WebKitGTK 2.42+ hands its rendered frames to the compositor through
/// DMA-BUF. On several Mesa drivers — Intel integrated graphics in particular —
/// the buffer stride the two sides agree on does not match, and the window is
/// drawn as skewed horizontal bands of the right colours in the wrong places.
/// The app looks broken while nothing in it is.
///
/// Disabling that path costs a little compositing performance and fixes the
/// display outright. It is set only when the user has not chosen a value, so
/// anyone whose driver is fine can opt back in with
/// `WEBKIT_DISABLE_DMABUF_RENDERER=0`.
#[cfg(target_os = "linux")]
fn apply_webkit_workarounds() {
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}

#[cfg(not(target_os = "linux"))]
fn apply_webkit_workarounds() {}

fn main() {
    apply_webkit_workarounds();
    qora_qarga_desktop_lib::run()
}
