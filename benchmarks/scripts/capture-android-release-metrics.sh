#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: pnpm benchmark:android:capture -- --scenario NAME --implementation NAME --renderer NAME --dataset NAME

Required values are recorded verbatim in the raw capture so a completed report can identify the
exact run. Valid names are documented in benchmarks/README.md.
EOF
  exit 2
}

scenario=""
implementation=""
renderer=""
dataset=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario) scenario="${2:-}"; shift 2 ;;
    --implementation) implementation="${2:-}"; shift 2 ;;
    --renderer) renderer="${2:-}"; shift 2 ;;
    --dataset) dataset="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done

[[ -n "${scenario}" && -n "${implementation}" && -n "${renderer}" && -n "${dataset}" ]] || usage

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repo_root}"
app_id="com.reactnativedatagrid.demo"

if ! command -v adb >/dev/null 2>&1; then
  echo "Android platform-tools (adb) is required." >&2
  exit 1
fi

device_count="$(adb devices | awk 'NR > 1 && $2 == "device" { count += 1 } END { print count + 0 }')"
if [[ "${device_count}" != "1" ]]; then
  echo "Connect exactly one physical Android device." >&2
  exit 1
fi
if adb shell getprop ro.kernel.qemu | tr -d '\r' | grep -qx '1'; then
  echo "A physical Android device is required; the connected target is an emulator." >&2
  exit 1
fi
if ! adb shell pm path "${app_id}" | grep -q '^package:'; then
  echo "Release demo app ${app_id} is not installed. Run pnpm benchmark:android:release first." >&2
  exit 1
fi

output_dir="${repo_root}/benchmarks/results/raw"
mkdir -p "${output_dir}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_file="${output_dir}/android-${timestamp}-${dataset}-${implementation}-${renderer}-${scenario}.txt"

adb shell dumpsys gfxinfo "${app_id}" reset

cat <<EOF
gfxinfo counters have been reset for ${app_id}.

On the physical device, cold-launch the installed release app, select:
  dataset:        ${dataset}
  implementation: ${implementation}
  renderer:       ${renderer}
Then perform exactly this scenario once: ${scenario}

Press Enter here only after the interaction has completed.
EOF
read -r

{
  echo "captured_at_utc=${timestamp}"
  echo "source_commit=$(git rev-parse HEAD)"
  echo "scenario=${scenario}"
  echo "implementation=${implementation}"
  echo "renderer=${renderer}"
  echo "dataset=${dataset}"
  echo "build_type=Android release (operator must verify no Metro server is used)"
  echo "device_model=$(adb shell getprop ro.product.manufacturer | tr -d '\r') $(adb shell getprop ro.product.model | tr -d '\r')"
  echo "android_release=$(adb shell getprop ro.build.version.release | tr -d '\r')"
  echo "android_sdk=$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
  echo "app_package_path=$(adb shell pm path "${app_id}" | tr -d '\r')"
  echo
  echo "--- dumpsys gfxinfo ${app_id} ---"
  adb shell dumpsys gfxinfo "${app_id}"
} > "${output_file}"

echo "Wrote raw physical-device frame capture: ${output_file}"
