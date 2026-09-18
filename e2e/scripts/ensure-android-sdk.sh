#!/usr/bin/env bash
set -euo pipefail

resolve_android_sdk() {
  if [[ -n "${ANDROID_HOME:-}" && -d "${ANDROID_HOME}" ]]; then
    echo "${ANDROID_HOME}"
    return 0
  fi

  if [[ -n "${ANDROID_SDK_ROOT:-}" && -d "${ANDROID_SDK_ROOT}" ]]; then
    echo "${ANDROID_SDK_ROOT}"
    return 0
  fi

  local mac_sdk="${HOME}/Library/Android/sdk"
  if [[ -d "${mac_sdk}" ]]; then
    echo "${mac_sdk}"
    return 0
  fi

  return 1
}

write_local_properties() {
  local sdk_dir="$1"
  local android_dir="$2"
  local properties_file="${android_dir}/local.properties"

  mkdir -p "${android_dir}"
  printf 'sdk.dir=%s\n' "${sdk_dir}" > "${properties_file}"
  echo "Wrote ${properties_file}"
}

if ! sdk_dir="$(resolve_android_sdk)"; then
  cat >&2 <<'EOF'
Android SDK not found.

Install Android Studio (or the command-line tools), then set ANDROID_HOME or create
~/Library/Android/sdk on macOS.

Example after installing Android Studio:

  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$ANDROID_HOME/platform-tools:$PATH"
EOF
  return 1 2>/dev/null || exit 1
fi

if [[ ! -x "${sdk_dir}/platform-tools/adb" ]]; then
  echo "Android SDK found at ${sdk_dir}, but platform-tools/adb is missing." >&2
  echo "Open Android Studio → SDK Manager and install Android SDK Platform-Tools." >&2
  return 1 2>/dev/null || exit 1
fi

export ANDROID_HOME="${sdk_dir}"
export ANDROID_SDK_ROOT="${sdk_dir}"
export PATH="${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/emulator:${PATH}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
write_local_properties "${sdk_dir}" "${repo_root}/apps/demo/android"

echo "Using ANDROID_HOME=${ANDROID_HOME}"
return 0 2>/dev/null || exit 0
