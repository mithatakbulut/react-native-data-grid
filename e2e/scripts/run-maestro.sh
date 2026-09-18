#!/usr/bin/env bash
set -euo pipefail

resolve_maestro() {
  if command -v maestro >/dev/null 2>&1; then
    command -v maestro
    return 0
  fi

  if [[ -x "${HOME}/.maestro/bin/maestro" ]]; then
    echo "${HOME}/.maestro/bin/maestro"
    return 0
  fi

  return 1
}

java_is_usable() {
  java -version >/dev/null 2>&1
}

ensure_java() {
  if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
    export PATH="${JAVA_HOME}/bin:${PATH}"
  elif [[ "$(uname -s)" == "Darwin" ]] && /usr/libexec/java_home >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home)"
    export PATH="${JAVA_HOME}/bin:${PATH}"
  fi

  if java_is_usable; then
    return 0
  fi

  echo "Java Runtime is required to run Maestro." >&2
  echo "Install a JDK, then retry. On macOS with Homebrew:" >&2
  echo "  brew install --cask temurin" >&2
  echo "Or download from https://adoptium.net/" >&2
  exit 127
}

if ! MAESTRO_BIN="$(resolve_maestro)"; then
  echo "Maestro CLI not found." >&2
  echo "Install it with: pnpm test:e2e:setup" >&2
  echo "Or manually: curl -fsSL \"https://get.maestro.mobile.dev\" | bash" >&2
  exit 127
fi

ensure_java

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/check-demo-app.sh"

exec "${MAESTRO_BIN}" "$@"
