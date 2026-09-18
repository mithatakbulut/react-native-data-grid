# API reference

TypeScript types are the source of truth; this document summarizes public props and methods for `0.1.0`.

## React Native package

### `DataGrid` / `RowVirtualizedDataGrid`

Both components accept the same props. `DataGrid` virtualizes rows and columns; `RowVirtualizedDataGrid` virtualizes rows only.

#### `DataGridProps<Row>`

| Prop                   | Type                                | Default | Description                                                              |
| ---------------------- | ----------------------------------- | ------- | ------------------------------------------------------------------------ |
| `rowCount`             | `number`                            | —       | Total logical row count                                                  |
| `getRow`               | `(rowIndex: number) => Row`         | —       | Row accessor; avoid materializing full datasets                          |
| `rowHeight`            | `number`                            | —       | Fixed height for every row (px)                                          |
| `columns`              | `readonly DataGridColumn<Row>[]`    | —       | Column definitions (width, pin, render)                                  |
| `rowOverscan`          | `number`                            | `3`     | Extra rows mounted above/below the viewport                              |
| `columnOverscan`       | `number`                            | `1`     | Extra columns mounted left/right of the center window                    |
| `headerHeight`         | `number`                            | `44`    | Header row height (px)                                                   |
| `style`                | `StyleProp<ViewStyle>`              | —       | Root container style                                                     |
| `theme`                | `DataGridTheme`                     | —       | Static styles for grid structural surfaces                               |
| `getRowStyle`          | `(context) => StyleProp<ViewStyle>` | —       | Additional style for each mounted body row                               |
| `getCellStyle`         | `(context) => StyleProp<ViewStyle>` | —       | Additional style for each mounted body cell                              |
| `onCellPress`          | `(event) => void`                   | —       | Called when a body cell is pressed                                       |
| `onCellLongPress`      | `(event) => void`                   | —       | Called when a body cell is long-pressed                                  |
| `onRowPress`           | `(event) => void`                   | —       | Called when any body cell in a row is pressed                            |
| `testID`               | `string`                            | —       | Native test id; scroll surfaces and pinned cells use derived suffixes    |
| `onVisibleRangeChange` | `(range) => void`                   | —       | Called when the non-overscanned visible row/center-column window changes |
| `onRenderRangeChange`  | `(range) => void`                   | —       | Called when the overscanned mounted row/center-column window changes     |
| `enableProfiling`      | `boolean`                           | `false` | Dev-only React Profiler counters; disable for benchmarks                 |

Both range callbacks receive `{ rows: ItemRange, columns: ColumnRange }`. `rows.items` is contiguous across `[startIndex, endIndex)`. `columns.items` contains only unpinned center columns in `[logicalStartIndex, logicalEndIndex)`; pinned columns are omitted and available through `getPinnedColumns()`.

#### Styling

`theme` is the small static styling surface for `root`, `header`, `headerCell`, `cell`, `pinnedCell`, and `headerText`. Theme styles override the built-in visual defaults, while the grid keeps positional geometry (`top`, `left`, `width`, and `height`) authoritative.

```tsx
const theme: DataGridTheme = {
  root: { backgroundColor: '#0f172a' },
  header: { backgroundColor: '#1e293b', borderBottomWidth: 0 },
  headerCell: { backgroundColor: '#1e293b' },
  cell: {
    backgroundColor: '#0f172a',
    borderRightWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 8
  },
  pinnedCell: { borderRightWidth: 2, borderColor: '#38bdf8', shadowOpacity: 0 },
  headerText: { color: '#f8fafc', textTransform: 'none' }
}
```

Use `getRowStyle({ row, rowIndex })` for row-specific presentation and `getCellStyle({ row, rowIndex, column, columnIndex })` for cell-specific presentation. These resolvers run for every mounted row or cell; keep them cheap and prefer `theme` for static styling.

#### Interaction

`onCellPress` and `onCellLongPress` receive `DataGridCellEvent<Row>`: `{ row, rowIndex, column, columnIndex }`. `onRowPress` receives `DataGridRowEvent<Row>`: `{ row, rowIndex }`. All three callbacks apply identically to center and pinned body cells. If both press callbacks are provided, a tap invokes `onCellPress` followed by `onRowPress`; a long press invokes only `onCellLongPress`. No native `Pressable` surfaces are mounted when no interaction callbacks are supplied.

#### `DataGridColumn<Row>`

Extends `CoreGridColumn` with render callbacks.

| Field        | Type                                 | Description                                               |
| ------------ | ------------------------------------ | --------------------------------------------------------- |
| `id`         | `string`                             | Stable column identifier                                  |
| `width`      | `number`                             | Column width in px                                        |
| `pinned`     | `'left' \| 'right'`                  | Optional pin side                                         |
| `header`     | `ReactNode \| (column) => ReactNode` | Header cell content                                       |
| `renderCell` | `(ctx) => ReactNode`                 | Body cell renderer; `ctx` has `row`, `rowIndex`, `column` |

Pinned columns are edge-oriented: left-pinned columns must form a contiguous prefix and right-pinned columns must form a contiguous suffix. In other words, order columns as left-pinned, then unpinned, then right-pinned. Invalid arrangements throw when the grid layout is created.

#### `DataGridHandle`

| Method                             | Description                                                |
| ---------------------------------- | ---------------------------------------------------------- |
| `scrollToRow(rowIndex, animated?)` | Scroll vertically so `rowIndex` is in view                 |
| `scrollToColumn(column, options?)` | Scrolls an unpinned column into the usable center viewport |
| `getProfilingSnapshot()`           | Returns profiling counters when `enableProfiling` is true  |
| `resetProfiling()`                 | Resets profiling counters                                  |

`scrollToColumn` accepts a numeric index or stable column ID. Its options are:

```ts
{
  animated?: boolean // defaults to true
  align?: 'auto' | 'start' | 'center' | 'end' // defaults to 'auto'
}
```

`auto` scrolls the minimum distance needed to make a center column fully visible between the left- and right-pinned areas. `start`, `center`, and `end` align the target inside that same center viewport. A target wider than the usable center viewport aligns to `start`. Pinned targets are already visible, so calling this method for one leaves the current horizontal scroll position unchanged.

#### `DataGridProfilingSnapshot`

| Field                                                            | Description                    |
| ---------------------------------------------------------------- | ------------------------------ |
| `commits`, `commitDurationMs`                                    | React commit stats             |
| `rowRenders`, `rowMounts`, `rowUnmounts`                         | Row component lifecycle        |
| `cellRenders`, `cellMounts`, `cellUnmounts`                      | Cell component lifecycle       |
| `scrollEvents`, `scrollEventsWithoutRangeChange`, `rangeChanges` | Scroll vs. window update stats |

---

## Core package

### `createGridLayout(options: GridLayoutOptions): GridLayout`

#### `GridLayoutOptions`

| Field       | Type                        | Description                         |
| ----------- | --------------------------- | ----------------------------------- |
| `rowCount`  | `number`                    | Total rows                          |
| `rowHeight` | `number`                    | Fixed row height                    |
| `columns`   | `readonly CoreGridColumn[]` | Column id, width, optional `pinned` |

When using `pinned`, columns must be ordered as a contiguous left-pinned prefix, followed by unpinned columns, followed by a contiguous right-pinned suffix. `createGridLayout()` rejects unsupported arrangements.

#### `GridLayout` methods

| Method                         | Returns             | Description                                            |
| ------------------------------ | ------------------- | ------------------------------------------------------ |
| `getTotalSize()`               | `{ width, height }` | Full scrollable content size                           |
| `getVisibleRows(viewport)`     | `ItemRange`         | Row window for `scrollY`, `viewportHeight`, `overscan` |
| `getVisibleColumns(viewport)`  | `ColumnRange`       | Center-column window; pinned columns are excluded      |
| `getRowOffset(rowIndex)`       | `number`            | Top offset of a row                                    |
| `getColumnOffset(columnIndex)` | `number`            | Left offset of a column                                |
| `getPinnedColumns()`           | `PinnedColumn[]`    | Pinned columns with `pinnedOffset` for layout          |

#### `ItemRange`

```ts
{
  startIndex: number   // inclusive
  endIndex: number     // exclusive
  items: ItemSize[]    // { index, offset, size } for every index in range
}
```

`ItemRange` is contiguous: `items` contains every index in `[startIndex, endIndex)`.

#### `ColumnRange`

```ts
{
  logicalStartIndex: number // inclusive logical column bound
  logicalEndIndex: number   // exclusive logical column bound
  items: ItemSize[]         // unpinned center columns within the logical interval
}
```

`getVisibleColumns()` returns `ColumnRange`, not `ItemRange`. Its logical bounds can include pinned columns, but `items` intentionally omits those columns because they are supplied separately by `getPinnedColumns()`. Do not infer `items.length` from the logical bounds.

#### `PinnedColumn`

Extends `ItemSize` with `id`, `pinned: 'left' | 'right'`, and `pinnedOffset` (distance from the pinned edge inside the viewport).
