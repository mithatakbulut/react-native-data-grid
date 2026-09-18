# Render profiling protocol

The demo's development profiler is deliberately opt-in (`enableProfiling`). It records values in refs, not React state, so collecting a sample does not itself cause scroll-time grid updates.

Use the **Reset profile** button before each scenario, perform the interaction, then press **Snapshot**. The output records:

- React commits and cumulative commit duration;
- row and cell renders, mounts, and unmounts;
- native scroll events;
- scroll events that did not change either visible-range boundary;
- visible-range changes.

The profiler is a diagnostic tool. Disable it for any release-build performance claim.

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

For Android graphics diagnostics, reset and dump `gfxinfo` around one scenario:

```sh
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
$ADB shell dumpsys gfxinfo host.exp.exponent reset
# run exactly one scenario in the demo
$ADB shell dumpsys gfxinfo host.exp.exponent
```

`gfxinfo` from Expo development mode is diagnostic only. Record public numbers only from release builds on physical devices.

## Result record

For each run, record the device, OS, React Native/Expo versions, build kind, scenario, dataset, overscan, profiling snapshot, `gfxinfo` summary, and visual defects. Keep raw results outside source code until they are reproducible enough to publish.
