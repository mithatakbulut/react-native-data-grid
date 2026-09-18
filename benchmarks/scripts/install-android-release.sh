#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
# shellcheck source=../../e2e/scripts/ensure-android-jdk.sh
source "${repo_root}/e2e/scripts/ensure-android-jdk.sh"
# shellcheck source=../../e2e/scripts/ensure-android-sdk.sh
source "${repo_root}/e2e/scripts/ensure-android-sdk.sh"
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

identity_dir="${repo_root}/benchmarks/results"
mkdir -p "${identity_dir}"
commit="$(git rev-parse HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  dirty=true
else
  dirty=false
fi
cat > "${identity_dir}/.android-release-build-identity.json" <<EOF
{
  "sourceCommit": "${commit}",
  "sourceDirty": ${dirty},
  "builtAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "command": "pnpm --filter @react-native-data-grid/demo exec expo run:android --variant release --device",
  "appId": "com.reactnativedatagrid.demo"
}
EOF

echo "Recorded release-build identity: ${identity_dir}/.android-release-build-identity.json"
