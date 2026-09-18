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

if resolve_maestro >/dev/null; then
  echo "Maestro is already installed at $(resolve_maestro)"
  if java -version >/dev/null 2>&1; then
    "$(resolve_maestro)" --version
  else
    echo "Java Runtime is still required before running Maestro tests."
    echo "On macOS with Homebrew: brew install --cask temurin"
  fi
  exit 0
fi

echo "Maestro CLI not found. Installing to ~/.maestro/bin ..."
curl -fsSL "https://get.maestro.mobile.dev" | bash

if ! resolve_maestro >/dev/null; then
  echo "Maestro installation finished, but the CLI is still unavailable." >&2
  echo "Add this to your shell profile, then restart the terminal:" >&2
  echo '  export PATH="$HOME/.maestro/bin:$PATH"' >&2
  exit 1
fi

echo "Maestro installed at $(resolve_maestro)"
if java -version >/dev/null 2>&1; then
  "$(resolve_maestro)" --version
else
  echo
  echo "Next step: install a Java Runtime before running e2e tests."
  echo "On macOS with Homebrew: brew install --cask temurin"
fi
