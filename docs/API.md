# API reference

TypeScript types are the source of truth; this document summarizes public props and methods for `0.1.0`.

## React Native package

### `DataGrid` / `RowVirtualizedDataGrid`

Both components accept the same props. `DataGrid` virtualizes rows and columns; `RowVirtualizedDataGrid` virtualizes rows only.

#### `DataGridProps<Row>`

| Prop                   | Type                             | Default | Description                                                           |
| ---------------------- | -------------------------------- | ------- | --------------------------------------------------------------------- |
| `rowCount`             | `number`                         | —       | Total logical row count                                               |
| `getRow`               | `(rowIndex: number) => Row`      | —       | Row accessor; avoid materializing full datasets                       |
| `rowHeight`            | `number`                         | —       | Fixed height for every row (px)                                       |
| `columns`              | `readonly DataGridColumn<Row>[]` | —       | Column definitions (width, pin, render)                               |
| `rowOverscan`          | `number`                         | `3`     | Extra rows mounted above/below the viewport                           |
| `columnOverscan`       | `number`                         | `1`     | Extra columns mounted left/right of the center window                 |
| `headerHeight`         | `number`                         | `44`    | Header row height (px)                                                |
| `style`                | `StyleProp<ViewStyle>`           | —       | Root container style                                                  |
| `testID`               | `string`                         | —       | Native test id; scroll surfaces and pinned cells use derived suffixes |
| `onVisibleRangeChange` | `(range) => void`                | —       | Called when visible row/column windows change                         |
| `enableProfiling`      | `boolean`                        | `false` | Dev-only React Profiler counters; disable for benchmarks              |

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

| Method                                   | Description                                               |
| ---------------------------------------- | --------------------------------------------------------- |
| `scrollToRow(rowIndex, animated?)`       | Scroll vertically so `rowIndex` is in view                |
| `scrollToColumn(columnIndex, animated?)` | Scroll horizontally so `columnIndex` is in view           |
| `getProfilingSnapshot()`                 | Returns profiling counters when `enableProfiling` is true |
| `resetProfiling()`                       | Resets profiling counters                                 |

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
| `getVisibleColumns(viewport)`  | `ItemRange`         | Center column window (excludes pinned)                 |
| `getRowOffset(rowIndex)`       | `number`            | Top offset of a row                                    |
| `getColumnOffset(columnIndex)` | `number`            | Left offset of a column                                |
| `getPinnedColumns()`           | `PinnedColumn[]`    | Pinned columns with `pinnedOffset` for layout          |

#### `ItemRange`

```ts
{
  startIndex: number   // inclusive
  endIndex: number     // exclusive
  items: ItemSize[]    // { index, offset, size } for each index in range
}
```

#### `PinnedColumn`

Extends `ItemSize` with `id`, `pinned: 'left' | 'right'`, and `pinnedOffset` (distance from the pinned edge inside the viewport).
