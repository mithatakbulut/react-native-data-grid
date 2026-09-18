#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ensure-android-jdk.sh
source "${SCRIPT_DIR}/ensure-android-jdk.sh"
# shellcheck source=ensure-android-sdk.sh
source "${SCRIPT_DIR}/ensure-android-sdk.sh"

repo_root="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${repo_root}"

pnpm build
pnpm --filter @react-native-data-grid/demo run:android
