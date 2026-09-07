#!/bin/bash
# Builds the macOS app. Run this ON a Mac — it cannot be cross-compiled from
# Linux, because `codesign`, `hdiutil` and the macOS SDK ship only with Xcode.
# If you have no Mac, use the desktop-macos GitHub Actions workflow instead.
#
#   bash desktop/scripts-build-macos.sh
#
# Produces a universal .dmg (Apple Silicon + Intel) next to this script.
set -euo pipefail
cd "$(dirname "$0")"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 — $2" >&2; exit 1; }
}

need xcrun    "run: xcode-select --install"
need cargo    "install Rust: https://rustup.rs"
need pnpm     "install pnpm: corepack enable && corepack prepare pnpm@11 --activate"

# Both halves of the universal binary.
rustup target add aarch64-apple-darwin x86_64-apple-darwin

pnpm install --frozen-lockfile

# Only the .app here. The disk image is assembled after signing: an image made
# from an unsigned app would hold an app that Apple Silicon refuses to launch.
pnpm exec tauri build --target universal-apple-darwin --bundles app

APP=$(find src-tauri/target/universal-apple-darwin/release/bundle/macos \
        -maxdepth 1 -name '*.app' | head -1)
[ -n "$APP" ] || { echo "no .app was produced" >&2; exit 1; }

# Ad-hoc signature. `lipo` drops the per-slice signatures the linker applied,
# and the kernel kills an unsigned arm64 binary on launch. It is also what
# lets macOS remember the camera and microphone grants between runs.
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"

VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")
DMG="qora-qarga_${VERSION}_macos_universal.dmg"

rm -rf dmg-staging && mkdir dmg-staging
cp -R "$APP" dmg-staging/
ln -s /Applications dmg-staging/Applications
rm -f "$DMG"
hdiutil create -volname "Qora Qarga" -srcfolder dmg-staging -ov -format UDZO "$DMG"
rm -rf dmg-staging

echo
echo "built: $(pwd)/$DMG"
lipo -archs "$APP/Contents/MacOS/"*
