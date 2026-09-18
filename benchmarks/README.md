# Release-build benchmark protocol

This directory is the source of truth for reproducible performance claims. A benchmark is
publishable only when its completed report is committed under [results](./results) and links its
raw device capture. Do not turn a simulator, a development build, or an unfilled result template
into a performance claim.

## Automated Android capture

The default command drives the publish matrix on exactly one physical Android device. It does not
wait for an operator to tap or fling. Each run cold-launches the installed **release** package,
configures the lab through `rndg://lab`, resets `gfxinfo`, injects a fast fling with
`adb shell input swipe`, dumps the raw `gfxinfo` response, and writes a filled report.

```sh
# Connected physical Android device required. Emulators and debuggable builds are rejected.
pnpm benchmark:android:release
pnpm benchmark:android:run
```

Default **publish** matrix (24 runs):

| Dimension      | Values                                     |
| -------------- | ------------------------------------------ |
| Dataset        | 100k × 100, 100k × 250                     |
| Renderer       | text                                       |
| Implementation | 2D virtualized, rows only                  |
| Scenario       | fast vertical fling, fast horizontal fling |
| Repetitions    | 3, each after a cold launch                |

That matrix is the question the project exists to answer: whether 2D virtualization changes frame
behavior versus rows-only at wide, tall grids. Output lands in a timestamped folder:

```
benchmarks/results/<utc>-<device>-<sha7>/
  REPORT.md
  summary.json
  raw/*.txt
```

Commit `REPORT.md` plus the linked `raw/` captures to publish the measurement. Regenerating
markdown from an existing session does not require a device:

```sh
pnpm benchmark:android:report -- benchmarks/results/<session-dir>
```

Inspect the run list without touching a device:

```sh
pnpm benchmark:android:run -- --dry-run
pnpm benchmark:android:run -- --dry-run --matrix full
pnpm benchmark:android:run -- --dry-run --dataset 100k-x-250 --scenario fast-horizontal --runs 1
```

`--matrix full` expands every dataset and renderer in this directory's required matrix, still only
for the two automated fling scenarios. `stable-range` and `alternating` stay operator-driven
because they are not flings; use `pnpm benchmark:android:capture` for those.

The runner refuses emulators, refuses a debuggable/development package, records the git commit,
device identity, animator scales, and battery/thermal state, and keeps profiling off (`enableProfiling`
is disabled in release). It does not classify visual blanking; screenshots next to the dump are
supplementary. iPhone Instruments capture is not automated yet — the report format is the same
when an operator attaches a Release Instruments trace.

## Required release-device matrix

Capture every combination below for both **2D virtualized** and **Rows only**. Keep the renderer,
overscan (rows 3, columns 2), and one left/one right pinned column fixed while comparing the two
implementations.

| Dataset    | Cell renderers                       |
| ---------- | ------------------------------------ |
| 10k × 20   | text, rich nested views, image cells |
| 100k × 20  | text, rich nested views, image cells |
| 100k × 100 | text, rich nested views, image cells |
| 100k × 250 | text, rich nested views, image cells |

Run the full matrix on at least one physical mid/low-tier Android device and one physical
current-generation iPhone. Run each scenario three times after a cold launch. An external baseline
may be added only when it uses the same data, viewport, renderer complexity, and interaction; do
not write “faster than” claims otherwise.

The automated publish matrix is the first slice of this table that is worth committing. It does not
replace the rest of the table.

## Build and capture

The Android scripts deliberately target the installed **release** package and preserve the raw
`gfxinfo` response. They do not build an Expo development client or use its numbers as evidence.

```sh
# Connected physical Android device required.
pnpm benchmark:android:release

# Automated publish matrix (preferred).
pnpm benchmark:android:run

# Single operator-driven scenario, if you need a gesture the runner does not inject.
pnpm benchmark:android:capture -- \
  --scenario fast-horizontal \
  --implementation two-dimensional \
  --renderer text \
  --dataset 100k-x-250
```

The release installer invokes Expo's Android release variant and writes a local build-identity
file. Before publishing, confirm the app launches with no Metro server running.
`benchmark:android:run` rejects emulators and debuggable packages, records the device identity and
source revision, and writes timestamped raw captures next to the generated report.

For iPhone, create a Release configuration archive/install using Xcode, run the same scenarios on a
physical device, and attach the exported Instruments/Core Animation trace to the result report.
The report must identify the tool and its version. The reporting requirements are identical even
though the raw artifact format differs.

## Published report requirements

Start from [results/REPORT_TEMPLATE.md](./results/REPORT_TEMPLATE.md). `pnpm benchmark:android:run`
fills this structure from parsed `gfxinfo`; do not hand-edit numbers. A completed report must
include all of the following for every device and run:

- exact device model, memory/storage state if relevant, OS, React Native and Expo versions;
- release build method/type and the Git source commit used to build it;
- dataset, renderer, overscan, pin configuration, implementation, scenario, and repetition;
- dropped/janky-frame evidence, JS responsiveness evidence, mount/unmount and commit measurements
  where the platform tool exposes them, memory when practical, and visual blanking/pop-in result;
- raw `gfxinfo`/Instruments artifact paths and a short interpretation that separates observations
  from conclusions.

`gfxinfo` is Android frame evidence, not a cross-platform score. React commit and mount counters
come from a separate diagnostic run and must be labelled as such; profiling instrumentation stays
off for the release-frame claim itself.

Parser and report-generation tests run with `pnpm test:benchmark` (included in `pnpm test`). They
do not require a device and are not themselves measurements.

# Render profiling protocol

The demo's development profiler is deliberately opt-in (`enableProfiling`). It records values in refs, not React state, so collecting a sample does not itself cause scroll-time grid updates.

Use the **Reset profile** button before each scenario, perform the interaction, then press **Snapshot**. The output records:

- React commits and cumulative commit duration;
- row and cell renders, mounts, and unmounts;
- native scroll events;
- scroll events that did not change either visible-range boundary;
- visible-range changes.

The profiler is a diagnostic tool. Disable it for any release-build performance claim. The release
demo turns `enableProfiling` off (`__DEV__` is false); do not re-enable it for a frame-claim run.

## Compared implementations

The demo exposes two deliberately comparable implementations:

- **2D virtualized** mounts the visible row window and visible non-pinned column window, plus pinned columns.
- **Rows only** mounts the same visible row window, but every non-pinned column for each of those rows.

They share the same `GridRow`, `GridCell`, header and pinned-cell components, styles, row overscan,
data access, and nested scroll topology. Switch only the **Implementation** control while keeping the
scenario, renderer, overscan, and pinned-column setting fixed.

## Scenarios

Run every scenario three times after a cold launch and record the snapshot plus Android frame statistics.

| Scenario        | Interaction                                                               | Expected invariant                                                                                           |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Stable range    | Make small vertical movements that remain within the row overscan window. | `scrollEventsWithoutRangeChange > 0`; no additional grid commit, row render, or cell render after the reset. |
| Fast vertical   | Fling from the top toward the middle.                                     | Range changes occur; rows/cells leaving the window unmount, and only incoming window entries mount.          |
| Fast horizontal | Drag across the central columns.                                          | Column range changes; pinned cells remain mounted and visually aligned.                                      |
| Alternating     | Repeat vertical then horizontal gestures.                                 | Mounted cells remain proportional to the visible row × column window plus pinned cells.                      |

The automated runner implements fast vertical and fast horizontal. For Android graphics diagnostics
on an operator-driven scenario:

```sh
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
$ADB shell dumpsys gfxinfo com.reactnativedatagrid.demo reset
# run exactly one scenario in the demo
$ADB shell dumpsys gfxinfo com.reactnativedatagrid.demo
```

`gfxinfo` from Expo development mode is diagnostic only. Record public numbers only from release builds on physical devices.

## Result record

For each run, record the device, OS, React Native/Expo versions, build kind, scenario, dataset, overscan, profiling snapshot, `gfxinfo` summary, and visual defects. Automated sessions store that in `summary.json` and `REPORT.md`; keep raw dumps next to the report until they are committed as published evidence.
