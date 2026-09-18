# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/w1that/react-native-data-grid/releases/tag/v0.1.0
