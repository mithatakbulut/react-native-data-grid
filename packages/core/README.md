# @react-native-data-grid/core

React-free TypeScript layout engine for virtualized data grids.

Computes visible row and column windows, overscan, pinned-column offsets, and total grid dimensions for fixed-height rows and known column widths. Intended for custom renderers or headless testing — most apps should use [`@react-native-data-grid/react-native`](../react-native).

## Install

```sh
npm install @react-native-data-grid/core
```

This package is also installed automatically as a dependency of `@react-native-data-grid/react-native`.

## Usage

```ts
import { createGridLayout } from '@react-native-data-grid/core'

const layout = createGridLayout({
  rowCount: 100_000,
  rowHeight: 44,
  columns: [
    { id: 'id', width: 86, pinned: 'left' },
    { id: 'name', width: 190 },
    { id: 'actions', width: 86, pinned: 'right' }
  ]
})

const { width, height } = layout.getTotalSize()
const rows = layout.getVisibleRows({ scrollY: 0, viewportHeight: 600, overscan: 3 })
const columns = layout.getVisibleColumns({ scrollX: 0, viewportWidth: 400, overscan: 1 })
const pinned = layout.getPinnedColumns()
```

## Pinned column order

Pinned columns are edge-oriented. Left-pinned columns must be a contiguous prefix and right-pinned columns must be a contiguous suffix: `left-pinned* → unpinned* → right-pinned*`. `createGridLayout()` rejects unsupported arrangements.

## Exports

- `createGridLayout(options)` — build a `GridLayout` instance
- Types: `CoreGridColumn`, `GridLayout`, `GridLayoutOptions`, `ItemRange`, `ItemSize`, `PinnedColumn`, `TotalSize`, `Viewport`

See the [API reference](../../docs/API.md#core-package) for details.

## License

[MIT](../../LICENSE)
