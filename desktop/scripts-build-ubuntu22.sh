#!/bin/bash
# Builds the .deb inside an Ubuntu 22.04 (jammy) chroot.
#
# A glibc-linked binary runs on the glibc it was built against or any newer
# one, never an older one. Built on this machine (glibc 2.39+) the app dies on
# Ubuntu 22.04 with `version GLIBC_2.39 not found`, so the package that gets
# handed to other people is built against jammy's glibc 2.35 instead.
#
# Run as root:  sudo bash desktop/scripts-build-ubuntu22.sh
set -e
ROOT=/home/abdurahmon/jammy-build
SRC=/home/abdurahmon/Desktop/cognigramm

mount --bind /dev "$ROOT/dev" 2>/dev/null || true
mount -t proc proc "$ROOT/proc" 2>/dev/null || true
mount -t sysfs sys "$ROOT/sys" 2>/dev/null || true
mkdir -p "$ROOT/src"
mountpoint -q "$ROOT/src" || mount --bind "$SRC" "$ROOT/src"
cp /etc/resolv.conf "$ROOT/etc/resolv.conf"

chroot "$ROOT" /bin/bash -eu <<'INNER'
export HOME=/root
export CI=true
. "$HOME/.cargo/env"

# Compiled artifacts live outside the copied tree so they survive between
# runs: a cold build of this dependency graph is roughly twenty minutes.
export CARGO_TARGET_DIR=/build/cargo-target

# A copy, not the bind mount: the host's node_modules and target/ were built
# against a different toolchain, and pnpm would want to purge them. tar does
# the excluding, so the host's multi-gigabyte target/ is never even read.
mkdir -p /build
# Carry over the target directory an earlier run left inside the tree.
if [ -d /build/desktop/src-tauri/target ] && [ ! -d "$CARGO_TARGET_DIR" ]; then
  mv /build/desktop/src-tauri/target "$CARGO_TARGET_DIR"
fi
[ -d /build/desktop/node_modules ] && mv /build/desktop/node_modules /build/node_modules.keep || true
rm -rf /build/desktop
tar -C /src -cf - desktop \
  --exclude='desktop/node_modules' \
  --exclude='desktop/dist' \
  --exclude='desktop/src-tauri/target' \
  --exclude='desktop/playwright-report' \
  --exclude='desktop/test-results' | tar -C /build -xf -
[ -d /build/node_modules.keep ] && mv /build/node_modules.keep /build/desktop/node_modules || true

cd /build/desktop
pnpm install --frozen-lockfile
pnpm exec tauri build --bundles deb

echo "BUILT: $(ls "$CARGO_TARGET_DIR"/release/bundle/deb/*.deb)"
INNER
