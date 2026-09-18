# React Native Data Grid

[![npm: react-native](https://img.shields.io/npm/v/@react-native-data-grid/react-native?label=react-native)](https://www.npmjs.com/package/@react-native-data-grid/react-native)
[![npm: core](https://img.shields.io/npm/v/@react-native-data-grid/core?label=core)](https://www.npmjs.com/package/@react-native-data-grid/core)
[![license](https://img.shields.io/npm/l/@react-native-data-grid/react-native)](./LICENSE)

Experimental **0.1.x** release — a React Native data grid with true two-dimensional virtualization and pinned columns.

Mounted cells scale with the visible row and column windows, not with every column in each visible row. The API may change before `1.0.0`.

## Installation

```sh
npm install @react-native-data-grid/react-native
# or: pnpm add @react-native-data-grid/react-native
# or: yarn add @react-native-data-grid/react-native
```

`@react-native-data-grid/core` is installed automatically as a dependency.

### Peer dependencies

| Package        | Version     |
| -------------- | ----------- |
| `react`        | `>= 19.0.0` |
| `react-native` | `>= 0.79.0` |

Tested with Expo SDK 53 and React Native 0.79. See [Expo / bare RN](#expo--bare-react-native) below.

## Quick start

```tsx
import { useMemo } from 'react'
import { Text } from 'react-native'
import { DataGrid, type DataGridColumn } from '@react-native-data-grid/react-native'

type Row = { id: number; name: string; region: string }

const columns: DataGridColumn<Row>[] = [
  {
    id: 'id',
    width: 86,
    pinned: 'left',
    header: 'ID',
    renderCell: ({ row }) => <Text>{row.id}</Text>
  },
  {
    id: 'name',
    width: 190,
    header: 'Name',
    renderCell: ({ row }) => <Text>{row.name}</Text>
  },
  {
    id: 'region',
    width: 120,
    header: 'Region',
    renderCell: ({ row }) => <Text>{row.region}</Text>
  }
]

export function OrdersGrid() {
  const getRow = useMemo(
    () => (index: number) => ({
      id: index + 1,
      name: `Account ${index + 1}`,
      region: ['Istanbul', 'Berlin', 'London'][index % 3]!
    }),
    []
  )

  return (
    <DataGrid
      rowCount={100_000}
      getRow={getRow}
      rowHeight={44}
      columns={columns}
      style={{ flex: 1 }}
    />
  )
}
```

You do not need to allocate an array of 100,000 rows — provide a `getRow` accessor instead.

## Packages

| Package                                                           | Description                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------- |
| [`@react-native-data-grid/react-native`](./packages/react-native) | `DataGrid`, `RowVirtualizedDataGrid` — use this in apps |
| [`@react-native-data-grid/core`](./packages/core)                 | React-free layout engine for custom renderers           |

### Exports

**`@react-native-data-grid/react-native`**

- `DataGrid`, `RowVirtualizedDataGrid`
- `ColumnScrollAlignment`, `DataGridColumn`, `DataGridProps`, `DataGridHandle`, `DataGridProfilingSnapshot`, `ScrollToColumnOptions`

**`@react-native-data-grid/core`**

- `createGridLayout`
- `CoreGridColumn`, `GridLayout`, `GridLayoutOptions`, `ItemRange`, `ItemSize`, `PinnedColumn`, `TotalSize`, `Viewport`

Full prop reference: [docs/API.md](./docs/API.md).

## Imperative API

Attach a ref to `DataGrid` or `RowVirtualizedDataGrid`:

```tsx
import { useRef } from 'react'
import { DataGrid, type DataGridHandle } from '@react-native-data-grid/react-native'

const ref = useRef<DataGridHandle>(null)

// Later:
ref.current?.scrollToRow(500, true)
ref.current?.scrollToColumn('region', { align: 'center', animated: false })
ref.current?.getProfilingSnapshot() // when enableProfiling is true
ref.current?.resetProfiling()
```

## Callbacks

`onVisibleRangeChange` fires when the visible row or column window changes:

```tsx
<DataGrid
  {...props}
  onVisibleRangeChange={({ rows, columns }) => {
    // rows: { startIndex, endIndex, items }
    // columns: center (non-pinned) column window
  }}
/>
```

Pinned columns are excluded from the `columns` range; they are always mounted separately.

Pinned columns are edge-oriented. Declare any left-pinned columns first and any right-pinned columns last: `left-pinned* → unpinned* → right-pinned*`. Unsupported arrangements throw when the grid layout is created.

`scrollToColumn` accepts a column index or stable ID. Its default `align: 'auto'` makes the target fully visible in the unpinned center viewport; use `start`, `center`, or `end` for explicit placement. Pinned targets are already visible and do not change the horizontal scroll position.

## RowVirtualizedDataGrid

Use `RowVirtualizedDataGrid` when you want row virtualization only — every column is mounted for each visible row. Same props and pinned-column behavior as `DataGrid`. Useful as a performance baseline or when column count is small.

```tsx
import { RowVirtualizedDataGrid } from '@react-native-data-grid/react-native'

<RowVirtualizedDataGrid rowCount={...} getRow={...} rowHeight={44} columns={columns} />
```

## Architecture

`@react-native-data-grid/core` owns fixed-row and variable-column geometry, range calculation, overscan, and pinned-column offsets. The React Native layer consumes that geometry directly and does not recalculate visibility.

The header sits outside the vertical scroller. A single horizontal scroller owns `scrollX`; pinned cells are counter-translated from that animated value — no synchronized vertical lists or per-row horizontal scrollers.

Ranges use exclusive bounds: `[startIndex, endIndex)`.

## Limitations

Do not expect AG Grid–class features in `0.1.x`:

- **Fixed row height** — all rows share the same `rowHeight`
- **Known column widths** — widths must be set on each column upfront
- **No** sorting, filtering, grouping, selection, inline editing, or tree data
- **No** variable row height or dynamic column resize
- **No** accessibility tree (screen reader / keyboard navigation)

## Expo / bare React Native

- **Pure JavaScript** — no native modules; works in Expo managed workflow and bare RN.
- **Peer deps** — ensure your app uses React 19+ and RN 0.79+ (or widen at your own risk; not tested on older versions).
- **Nested scroll views** — the grid uses vertical + horizontal `ScrollView`s; test nested-scroll scenarios in your layout (see demo and Maestro flows in this repo).

Reference implementation: [`apps/demo`](./apps/demo) (Expo app, monorepo-only, not published).

## Contributing

```sh
pnpm install
pnpm test          # unit + component tests
pnpm build         # build both packages
pnpm check         # format, lint, typecheck, test, build
pnpm demo          # start Expo demo
```

See [docs/API.md](./docs/API.md) for the full prop reference.

## License

[MIT](./LICENSE) — see [CHANGELOG.md](./CHANGELOG.md) for release history.
