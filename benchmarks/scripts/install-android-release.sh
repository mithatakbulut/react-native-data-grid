#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repo_root}"

if ! command -v adb >/dev/null 2>&1; then
  echo "Android platform-tools (adb) is required." >&2
  exit 1
fi

device_count="$(adb devices | awk 'NR > 1 && $2 == "device" { count += 1 } END { print count + 0 }')"
if [[ "${device_count}" != "1" ]]; then
  echo "Connect exactly one physical Android device before installing a release benchmark build." >&2
  exit 1
fi

if adb shell getprop ro.kernel.qemu | tr -d '\r' | grep -qx '1'; then
  echo "A physical Android device is required; the connected target is an emulator." >&2
  exit 1
fi

pnpm build
pnpm --filter @react-native-data-grid/demo exec expo run:android --variant release --device
