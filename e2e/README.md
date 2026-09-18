# Device tests

Maestro flows exercise pinned-column scrolling on the Expo development build
(`com.reactnativedatagrid.demo`).

## Prerequisites

1. Install the Maestro CLI and a Java Runtime (once per machine):

```sh
pnpm test:e2e:setup
brew install --cask temurin      # Maestro CLI
brew install --cask temurin@21   # Android native builds (Gradle needs JDK 21 or 17)
```

If the installer succeeds but `maestro` is still missing from new shells, add
`export PATH="$HOME/.maestro/bin:$PATH"` to your shell profile.

2. Boot an Android emulator, iOS simulator, or connect a physical device.
3. Build and install the **native dev build** once. Expo Go (`pnpm demo` alone) is not enough —
   Maestro targets bundle id `com.reactnativedatagrid.demo`:

```sh
# iOS simulator
pnpm demo:install:ios

# Android emulator or device (requires Android SDK + JDK 21)
pnpm demo:install:android
```

`demo:install:android` auto-detects `~/Library/Android/sdk` on macOS and writes
`apps/demo/android/local.properties`. If the SDK lives elsewhere, set `ANDROID_HOME`
before running the command.

This installs `com.reactnativedatagrid.demo` on the connected device.

4. Start Metro in a separate terminal:

```sh
pnpm demo
```

## Run

```sh
# Full device suite (scroll, multi-pinned, nested scroll, viewport checks)
pnpm test:e2e

# Screenshot capture flows only
pnpm test:e2e:screenshots
```

This suite is intentionally excluded from `pnpm check` because it requires a booted device with the
development build installed.

## Flows

| Flow                                 | Covers                                                            |
| ------------------------------------ | ----------------------------------------------------------------- |
| `pinned-columns.yaml`                | Basic horizontal + vertical scroll with left/right pinned headers |
| `pinned-columns-100-cols.yaml`       | 100-column horizontal scroll, then vertical scroll                |
| `pinned-columns-multi-left.yaml`     | One, two, and three left pinned columns                           |
| `pinned-columns-nested-scroll.yaml`  | Alternating horizontal and vertical scroll flings                 |
| `pinned-columns-central-column.yaml` | Center column leaves view while pinned columns stay visible       |
| `pinned-columns-viewports.yaml`      | Multi-pinned grid on phone/tablet profiles (run on both)          |
| `pinned-columns-rich-cells.yaml`     | Rich cell renderer with horizontal and vertical scroll            |
| `pinned-columns-image-cells.yaml`    | Image avatar cells in pinned ID and center Customer columns       |
| `screenshots/multi-left-pinned.yaml` | Screenshot regression: three left pinned columns                  |
| `screenshots/right-pinned.yaml`      | Screenshot regression: right pinned actions column                |

## Viewport matrix

Run `pinned-columns-viewports.yaml` on:

- The narrowest supported phone profile (e.g. iPhone SE)
- A tablet-sized profile (e.g. iPad Air)

Pinned headers must remain visible in both runs.

## Screenshot regression

See [screenshots/README.md](./screenshots/README.md) for baseline capture, comparison tolerance, and
update workflow.
