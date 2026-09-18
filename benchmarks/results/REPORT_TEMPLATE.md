# Release-build benchmark report — template

> This template is not benchmark evidence. `pnpm benchmark:android:run` writes a completed copy
> under `benchmarks/results/` after a physical-device session. Copy it by hand only when attaching
> an iPhone Instruments trace or an operator-driven scenario the runner does not inject.

## Build identity

| Field                             | Value                                    |
| --------------------------------- | ---------------------------------------- |
| Source commit                     | `<40-character Git SHA>`                 |
| Package version                   | `<version>`                              |
| Build type                        | `Android release` / `iOS Release`        |
| Build command/tool version        | `<exact command and Expo/Xcode version>` |
| React Native / Expo               | `<versions>`                             |
| Profiling enabled for frame claim | `No`                                     |

## Physical devices

| Device                    | OS                  | Storage / thermal state | Frame diagnostic tool                           |
| ------------------------- | ------------------- | ----------------------- | ----------------------------------------------- |
| `<mid/low Android model>` | `<Android version>` | `<state>`               | `adb dumpsys gfxinfo`                           |
| `<current iPhone model>`  | `<iOS version>`     | `<state>`               | `<Instruments/Core Animation tool and version>` |

## Method

- Cold-launch before each of three repetitions.
- Use row overscan `3`, column overscan `2`, one left and one right pinned column.
- Compare only `2D virtualized` and `Rows only` with identical dataset, renderer, viewport, and
  gesture.
- Run stable range, fast vertical, fast horizontal, and alternating scenarios. Record any visible
  blanking/pop-in as a defect, even if frame counters look good.

## Results

One row per repetition. Cover 10k × 20, 100k × 20, 100k × 100, and 100k × 250 with text, rich,
and image cells for both implementations on both physical-device classes.

| Device     | Dataset     | Renderer     | Implementation     | Scenario     | Run | Janky/dropped frame evidence | JS responsiveness / commits / mounts | Memory            | Blanking/pop-in     | Raw artifact              |
| ---------- | ----------- | ------------ | ------------------ | ------------ | --: | ---------------------------- | ------------------------------------ | ----------------- | ------------------- | ------------------------- |
| `<device>` | `<dataset>` | `<renderer>` | `<implementation>` | `<scenario>` |   1 | `<metric>`                   | `<metric or N/A with reason>`        | `<metric or N/A>` | `<none / describe>` | `[capture](./raw/<file>)` |

## Interpretation

State observations only. Do not claim superiority to another library unless an explicitly
documented apples-to-apples external baseline was run. Distinguish release-frame diagnostics from
any separate development diagnostic run used to inspect React commits or mounts.
