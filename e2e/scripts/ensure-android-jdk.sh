#!/usr/bin/env bash
set -euo pipefail

find_android_jdk_home() {
  if ! command -v /usr/libexec/java_home >/dev/null 2>&1; then
    return 1
  fi

  for version in 21 17; do
    if home="$(/usr/libexec/java_home -v "${version}" 2>/dev/null)"; then
      echo "${home}"
      return 0
    fi
  done

  return 1
}

if jdk_home="$(find_android_jdk_home)"; then
  export JAVA_HOME="${jdk_home}"
  export PATH="${JAVA_HOME}/bin:${PATH}"
  echo "Using JAVA_HOME=${JAVA_HOME} for Android build"
  java -version
  return 0 2>/dev/null || exit 0
fi

cat >&2 <<'EOF'
Android builds require JDK 21 or 17. The current default JDK is too new for Gradle.

Install JDK 21, then rerun:

  brew install --cask temurin@21

Optional: pin it for this shell before building:

  export JAVA_HOME=$(/usr/libexec/java_home -v 21)
EOF

exit 1
