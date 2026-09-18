#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.reactnativedatagrid.demo"
EXPO_GO_ID="host.exp.exponent"

resolve_adb() {
  if command -v adb >/dev/null 2>&1; then
    command -v adb
    return 0
  fi

  if [[ -n "${ANDROID_HOME:-}" && -x "${ANDROID_HOME}/platform-tools/adb" ]]; then
    echo "${ANDROID_HOME}/platform-tools/adb"
    return 0
  fi

  if [[ -n "${ANDROID_SDK_ROOT:-}" && -x "${ANDROID_SDK_ROOT}/platform-tools/adb" ]]; then
    echo "${ANDROID_SDK_ROOT}/platform-tools/adb"
    return 0
  fi

  local mac_sdk="${HOME}/Library/Android/sdk/platform-tools/adb"
  if [[ -x "${mac_sdk}" ]]; then
    echo "${mac_sdk}"
    return 0
  fi

  return 1
}

ios_app_installed() {
  command -v xcrun >/dev/null 2>&1 || return 1
  xcrun simctl list devices booted 2>/dev/null | grep -q "(Booted)" || return 1
  xcrun simctl get_app_container booted "${APP_ID}" data >/dev/null 2>&1
}

android_app_installed() {
  local adb_bin
  adb_bin="$(resolve_adb)" || return 1
  "${adb_bin}" get-state >/dev/null 2>&1 || return 1
  "${adb_bin}" shell pm list packages 2>/dev/null | grep -q "package:${APP_ID}"
}

expo_go_installed_on_android() {
  local adb_bin
  adb_bin="$(resolve_adb)" || return 1
  "${adb_bin}" get-state >/dev/null 2>&1 || return 1
  "${adb_bin}" shell pm list packages 2>/dev/null | grep -q "package:${EXPO_GO_ID}"
}

if ios_app_installed || android_app_installed; then
  exit 0
fi

cat >&2 <<EOF
Demo app "${APP_ID}" is not installed on the connected device or simulator.
EOF

if expo_go_installed_on_android; then
  cat >&2 <<EOF

Expo Go is installed, but Maestro e2e tests require the native dev build with
bundle id "${APP_ID}". "pnpm demo" (Expo Go) is not enough for e2e.

Install the native demo app once:

  pnpm demo:install:android

Then keep Metro running in another terminal:

  pnpm demo

And rerun:

  pnpm test:e2e
EOF
else
  cat >&2 <<EOF

Build and install the native demo app once:

  # iOS simulator
  pnpm demo:install:ios

  # Android emulator or device
  pnpm demo:install:android

After install, keep Metro running in another terminal:

  pnpm demo

Then run:

  pnpm test:e2e
EOF
fi

exit 1
