# @react-native-data-grid/react-native

Virtualized 2D data grid for React Native with pinned columns.

Mounts only the visible row and column window (plus overscan and pinned columns), so cell count scales with the viewport — not with total rows × columns.

## Install

```sh
npm install @react-native-data-grid/react-native
```

### Peer dependencies

| Package        | Version              |
| -------------- | -------------------- |
| `react`        | `>= 19.2.3 < 20.0.0` |
| `react-native` | `>= 0.86.0 < 0.88.0` |

Supported React Native versions are **0.86.x** and **0.87.x**. CI runs this package's TypeScript and component test suite against 0.86.0 and 0.87.0 with React 19.2.3. Versions outside that range may work, but are not supported. The grid has no native modules and works in Expo or bare React Native projects that use a supported version.

## Quick start

```tsx
import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { DataGrid, type DataGridColumn } from '@react-native-data-grid/react-native'

type Row = { id: number; name: string }

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
  }
]

export function MyGrid() {
  const getRow = useMemo(() => (index: number) => ({ id: index + 1, name: `Row ${index + 1}` }), [])

  return (
    <DataGrid
      rowCount={10_000}
      getRow={getRow}
      rowHeight={44}
      columns={columns}
      style={{ flex: 1 }}
    />
  )
}
```

## Components

| Export                   | Purpose                                                                          |
| ------------------------ | -------------------------------------------------------------------------------- |
| `DataGrid`               | Full 2D virtualization (rows + columns)                                          |
| `RowVirtualizedDataGrid` | Row-only virtualization; mounts all columns per visible row (benchmark baseline) |

## Pinned column order

Pinned columns are edge-oriented. Left-pinned columns must be a contiguous prefix and right-pinned columns must be a contiguous suffix: `left-pinned* → unpinned* → right-pinned*`. Unsupported arrangements throw when the grid layout is created.

## Styling

Use the small `theme` object for static visual treatment and the optional style resolvers for row- or cell-specific presentation:

```tsx
import type { DataGridTheme } from '@react-native-data-grid/react-native'

const theme: DataGridTheme = {
  root: { backgroundColor: '#111827' },
  header: { backgroundColor: '#1f2937', borderBottomWidth: 0 },
  headerCell: { backgroundColor: '#1f2937' },
  cell: { backgroundColor: '#111827', borderRightWidth: 0, borderBottomWidth: 0, paddingHorizontal: 8 },
  pinnedCell: { borderRightWidth: 2, borderColor: '#38bdf8', shadowOpacity: 0 },
  headerText: { color: '#f9fafb', textTransform: 'none' }
}

<DataGrid
  {...props}
  theme={theme}
  getRowStyle={({ row }) => (row.id % 2 ? { backgroundColor: '#1f2937' } : undefined)}
/>
```

`getRowStyle` and `getCellStyle` run for every mounted row or cell, so keep them inexpensive; use `theme` for static styles. The grid retains control of positional geometry.

## Interaction

Use `onCellPress`, `onCellLongPress`, and `onRowPress` for whole-cell interactions. Cell events contain `{ row, rowIndex, column, columnIndex }`; row events contain `{ row, rowIndex }`. Pinned and center cells use the same event shapes. If both press callbacks are provided, `onCellPress` runs before `onRowPress` for the same tap. The grid mounts native `Pressable` surfaces only when at least one interaction callback is supplied.

```tsx
<DataGrid
  {...props}
  onCellPress={({ row, column }) => openCell(row, column.id)}
  onCellLongPress={({ row, column }) => showCellActions(row, column.id)}
  onRowPress={({ row }) => openRow(row)}
/>
```

## Imperative API

Pass a ref to access `DataGridHandle`:

```tsx
const ref = useRef<DataGridHandle>(null)

ref.current?.scrollToRow(500)
ref.current?.scrollToColumn('customer', { align: 'center' })
ref.current?.getProfilingSnapshot() // dev instrumentation
```

## Limitations (0.2.x)

- Fixed `rowHeight` for all rows
- Column widths must be known upfront
- No sorting, filtering, selection, inline editing, or variable row height
- No accessibility tree / screen-reader support yet

See the [full documentation](https://github.com/mithatakbulut/react-native-data-grid#readme) and
[API reference](https://github.com/mithatakbulut/react-native-data-grid/blob/main/docs/API.md).

## License

[MIT](https://github.com/mithatakbulut/react-native-data-grid/blob/main/LICENSE)
