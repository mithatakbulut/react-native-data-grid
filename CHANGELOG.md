# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-09-18

The production-foundation release. `0.1.0` shipped with several geometry and scrolling
defects that made the grid untrustworthy when layout inputs changed at runtime; this
release fixes those, narrows the compatibility claim to the versions actually tested,
and adds the styling and interaction primitives an application needs. No sorting,
filtering, selection, or editing features were added — that remains out of scope.

**Everyone on `0.1.0` should upgrade.** Read the breaking changes first: the supported
`react`/`react-native` range is narrower, and the column range callbacks changed shape.

### Breaking

- **Narrowed peer dependencies** to the versions covered by the new compatibility matrix: `react >=19.2.3 <20.0.0` (was `>=19.0.0`) and `react-native >=0.86.0 <0.88.0` (was `>=0.79.0`). The previous range advertised support that was never tested. Stay on `0.1.0` if you cannot upgrade React Native yet, or open an issue if you need a specific older version tested and re-supported.
- **Column ranges use a dedicated `ColumnRange` type** instead of `ItemRange`. `onVisibleRangeChange` and `onRenderRangeChange` now report `columns` as `{ logicalStartIndex, logicalEndIndex, items }` rather than `{ startIndex, endIndex, items }`. The rename is deliberate: the interval covers pinned columns too, while `items` contains only unpinned center columns, so the old `ItemRange` contract (`items` contiguous across the interval) did not hold. `rows` is unchanged. `ColumnRange` is exported from `@react-native-data-grid/core`.
- **Invalid pinned-column configurations now throw.** `createGridLayout` rejects layouts the renderer cannot represent: left-pinned columns must precede all unpinned columns, and right-pinned columns must follow them. Interleaved pin configurations previously rendered incorrectly instead of failing.

### Added

- `theme` prop (`DataGridTheme`) for static styles on the grid's structural surfaces: `root`, `header`, `headerCell`, `cell`, `pinnedCell`, and `headerText`.
- `getRowStyle` and `getCellStyle` props for per-row and per-cell styles, receiving `DataGridRowStyleContext` / `DataGridCellStyleContext` (which include `columnIndex`).
- Interaction callbacks `onCellPress`, `onCellLongPress`, and `onRowPress`, receiving `DataGridCellEvent` / `DataGridRowEvent`.
- `onRenderRangeChange` callback, reporting the overscanned window actually mounted for rendering, alongside the existing non-overscanned `onVisibleRangeChange`.
- Alignment options for `scrollToColumn`: `{ align: 'auto' | 'start' | 'center' | 'end', animated }` via the new `ScrollToColumnOptions` and `ColumnScrollAlignment` types.
- Exports that the documentation already referenced but the entrypoint did not expose: `DataGridProfilingSnapshot`, `DataGridTheme`, `DataGridCellEvent`, `DataGridRowEvent`, `DataGridCellStyleContext`, `DataGridRowStyleContext`, `ScrollToColumnOptions`, `ColumnScrollAlignment`, and `ColumnRange` from core.

### Fixed

- **Stale render geometry after layout props change.** Window comparison only checked range boundaries, so changes to `columns`, column widths, pinning, or `rowHeight` that kept the same start/end indices left the previous cell offsets and sizes on screen. Cell geometry is now part of the comparison.
- **`scrollToColumn` ignored pinned columns.** It scrolled the target to the raw viewport edge, which left the column underneath a pinned overlay. It now targets the center band between the pinned overlays, clamps to the scrollable content, and does nothing for pinned targets, which are always on screen.
- **Resize and orientation changes recalculated the window from the origin.** `onLayout` reset the scroll offsets to `(0, 0)`, so a grid scrolled to row 50,000 briefly emitted and rendered row 0. Current offsets are now preserved across viewport changes, and the redundant follow-up recalculation is skipped.
- **`onVisibleRangeChange` measured columns against the full viewport.** Pinned columns overlay both viewport edges, so a center column hidden entirely behind one was reported as visible. The visible window is now measured against the center band. The render window still uses the full viewport plus `columnOverscan`, since extra mounted cells guard against blanking during fast scrolls.

### Performance

- `getRow` is called once per rendered row instead of once per rendered cell. With 20 mounted columns this removes 19 of every 20 accessor calls, which matters for consumers whose accessor is not a trivial array index.
- `GridHeader` is memoized, so vertical scrolling no longer re-renders the header and its cell renderers when no horizontal range change occurred.

### Documentation

- Added `docs/API.md` with a prop-by-prop reference, and documented the range-callback semantics (visible vs. render window, pinned-column exclusion) in both READMEs.
- Added a release-build benchmark capture workflow under `benchmarks/`. Reports committed to `benchmarks/results/` are the only numbers treated as published evidence; the device matrix itself is still pending.

### Internal

- CI runs format, lint, typecheck, unit tests, and package builds on every pull request, plus Android native E2E via Maestro (smoke flows on pull requests, the full suite on `main` and nightly).
- Added a React Native compatibility workflow that builds and tests against each supported version, with a policy test keeping the peer-dependency range and the documented matrix in sync.
- Added a packed-tarball smoke test that installs both packages as an external consumer would, so packaging regressions surface before publish.
- Migrated the component test suite off the deprecated `react-test-renderer`.

## [0.1.0] - 2026-09-18

### Added

- `@react-native-data-grid/core` — React-free layout engine for fixed-row, variable-width column grids with pinned columns, overscan, and range calculation.
- `@react-native-data-grid/react-native` — `DataGrid` and `RowVirtualizedDataGrid` components with 2D virtualization, imperative scroll API, and optional profiling.
- Left and right pinned column support with counter-translated horizontal scroll.
- `onVisibleRangeChange` callback and `DataGridHandle` (`scrollToRow`, `scrollToColumn`, `getProfilingSnapshot`).
- Unit and component test suite; Maestro e2e flows for pinned-column scenarios.

### Notes

- Early-access release (`0.x`); the public API may change before `1.0.0`.
- Demo app (`@react-native-data-grid/demo`) is monorepo-only and not published to npm.
- Requires `react >= 19.0.0` and `react-native >= 0.79.0` (see peer dependencies).

[unreleased]: https://github.com/mithatakbulut/react-native-data-grid/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/mithatakbulut/react-native-data-grid/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mithatakbulut/react-native-data-grid/releases/tag/v0.1.0
