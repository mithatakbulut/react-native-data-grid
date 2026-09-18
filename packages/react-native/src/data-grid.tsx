import {
  createGridLayout,
  type CoreGridColumn,
  type ItemRange,
  type PinnedColumn
} from '@react-native-data-grid/core'
import {
  forwardRef,
  memo,
  Profiler,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle
} from 'react-native'

export type DataGridColumn<Row> = CoreGridColumn & {
  readonly header?: ReactNode | ((column: DataGridColumn<Row>) => ReactNode)
  readonly renderCell: (context: {
    readonly row: Row
    readonly rowIndex: number
    readonly column: DataGridColumn<Row>
  }) => ReactNode
}

export type DataGridProps<Row> = {
  readonly rowCount: number
  readonly getRow: (rowIndex: number) => Row
  readonly rowHeight: number
  readonly columns: readonly DataGridColumn<Row>[]
  readonly rowOverscan?: number
  readonly columnOverscan?: number
  readonly headerHeight?: number
  readonly style?: StyleProp<ViewStyle>
  /** Optional native test identifier. Child scroll surfaces and pinned cells derive stable suffixes. */
  readonly testID?: string
  readonly onVisibleRangeChange?: (range: {
    readonly rows: ItemRange
    readonly columns: ItemRange
  }) => void
  /** Development-only instrumentation; disable for representative release measurements. */
  readonly enableProfiling?: boolean
}

export type DataGridProfilingSnapshot = {
  readonly commits: number
  readonly commitDurationMs: number
  readonly rowRenders: number
  readonly rowMounts: number
  readonly rowUnmounts: number
  readonly cellRenders: number
  readonly cellMounts: number
  readonly cellUnmounts: number
  readonly scrollEvents: number
  readonly scrollEventsWithoutRangeChange: number
  readonly rangeChanges: number
}

export type DataGridHandle = {
  scrollToRow(rowIndex: number, animated?: boolean): void
  scrollToColumn(columnIndex: number, animated?: boolean): void
  getProfilingSnapshot(): DataGridProfilingSnapshot
  resetProfiling(): void
}

type RenderWindow = { readonly rows: ItemRange; readonly columns: ItemRange }
type ViewportSize = { readonly width: number; readonly height: number }

type VirtualizedDataGridProps<Row> = DataGridProps<Row> & {
  readonly virtualizeColumns: boolean
}

const VirtualizedDataGrid = forwardRef(function VirtualizedDataGrid<Row>(
  props: VirtualizedDataGridProps<Row>,
  ref: React.ForwardedRef<DataGridHandle>
) {
  const {
    rowCount,
    getRow,
    rowHeight,
    columns,
    rowOverscan = 3,
    columnOverscan = 1,
    headerHeight = 44,
    style,
    testID,
    onVisibleRangeChange,
    enableProfiling = false,
    virtualizeColumns
  } = props
  const layout = useMemo(
    () => createGridLayout({ rowCount, rowHeight, columns }),
    [columns, rowCount, rowHeight]
  )
  const totalSize = layout.getTotalSize()
  const horizontalScrollRef = useRef<ScrollView>(null)
  const verticalScrollRef = useRef<ScrollView>(null)
  const scrollX = useRef(new Animated.Value(0)).current
  const scrollOffsets = useRef({ x: 0, y: 0 })
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 })
  const [window, setWindow] = useState<RenderWindow>(() => emptyWindow())
  const windowRef = useRef(window)
  const profiling = useGridProfiling(enableProfiling)
  const allCenterColumns = useMemo<ItemRange>(
    () => ({
      startIndex: 0,
      endIndex: columns.length,
      items: columns.flatMap((column, index) =>
        column.pinned ? [] : [{ index, offset: layout.getColumnOffset(index), size: column.width }]
      )
    }),
    [columns, layout]
  )

  const updateWindow = useCallback(
    (nextViewport: ViewportSize, scrollOffsetX: number, scrollOffsetY: number) => {
      const bodyHeight = Math.max(0, nextViewport.height - headerHeight)
      const calculated = {
        rows: layout.getVisibleRows({
          scrollY: scrollOffsetY,
          viewportHeight: bodyHeight,
          overscan: rowOverscan
        }),
        columns: virtualizeColumns
          ? layout.getVisibleColumns({
              scrollX: scrollOffsetX,
              viewportWidth: nextViewport.width,
              overscan: columnOverscan
            })
          : allCenterColumns
      }
      const current = windowRef.current
      const next = {
        rows: sameRange(current.rows, calculated.rows) ? current.rows : calculated.rows,
        columns: sameRange(current.columns, calculated.columns)
          ? current.columns
          : calculated.columns
      }
      if (next.rows === current.rows && next.columns === current.columns) {
        profiling.recordScrollWithoutRangeChange()
        return
      }
      windowRef.current = next
      profiling.recordRangeChange()
      setWindow(next)
      onVisibleRangeChange?.(next)
    },
    [
      allCenterColumns,
      columnOverscan,
      headerHeight,
      layout,
      onVisibleRangeChange,
      profiling,
      rowOverscan,
      virtualizeColumns
    ]
  )

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextViewport = event.nativeEvent.layout
      const size = { width: nextViewport.width, height: nextViewport.height }
      setViewport(size)
      updateWindow(size, 0, 0)
    },
    [updateWindow]
  )

  useEffect(() => {
    if (viewport.width === 0 || viewport.height === 0) return
    updateWindow(viewport, scrollOffsets.current.x, scrollOffsets.current.y)
  }, [updateWindow, viewport])

  const onVerticalScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      profiling.recordScrollEvent()
      scrollOffsets.current.y = event.nativeEvent.contentOffset.y
      updateWindow(viewport, scrollOffsets.current.x, scrollOffsets.current.y)
    },
    [profiling, updateWindow, viewport]
  )

  const onHorizontalScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      profiling.recordScrollEvent()
      scrollOffsets.current.x = event.nativeEvent.contentOffset.x
      updateWindow(viewport, scrollOffsets.current.x, scrollOffsets.current.y)
    },
    [profiling, updateWindow, viewport]
  )

  useImperativeHandle(
    ref,
    () => ({
      scrollToRow: (rowIndex, animated = true) =>
        verticalScrollRef.current?.scrollTo({ y: layout.getRowOffset(rowIndex), animated }),
      scrollToColumn: (columnIndex, animated = true) =>
        horizontalScrollRef.current?.scrollTo({ x: layout.getColumnOffset(columnIndex), animated }),
      getProfilingSnapshot: () => profiling.getSnapshot(),
      resetProfiling: () => profiling.reset()
    }),
    [layout, profiling]
  )

  const pinnedColumns = layout.getPinnedColumns()
  return (
    <Profiler
      id={virtualizeColumns ? 'DataGrid' : 'RowVirtualizedDataGrid'}
      onRender={(_, phase, actualDuration) => profiling.recordCommit(phase, actualDuration)}
    >
      <View testID={testID} onLayout={onLayout} style={[styles.root, style]}>
        <Animated.ScrollView
          ref={horizontalScrollRef}
          testID={testID ? `${testID}-horizontal-scroll` : undefined}
          style={styles.horizontalScroll}
          horizontal
          bounces={false}
          directionalLockEnabled
          disableScrollViewPanResponder
          nestedScrollEnabled
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: true,
            listener: onHorizontalScroll
          })}
          showsHorizontalScrollIndicator
        >
          <View style={{ width: totalSize.width, height: viewport.height }}>
            <GridHeader
              columns={columns}
              centerColumns={window.columns}
              pinnedColumns={pinnedColumns}
              viewportWidth={viewport.width}
              scrollX={scrollX}
              height={headerHeight}
              testID={testID}
            />
            <ScrollView
              ref={verticalScrollRef}
              testID={testID ? `${testID}-vertical-scroll` : undefined}
              style={{ height: Math.max(0, viewport.height - headerHeight) }}
              contentContainerStyle={{ height: totalSize.height, width: totalSize.width }}
              nestedScrollEnabled
              bounces={false}
              scrollEventThrottle={16}
              onScroll={onVerticalScroll}
              showsVerticalScrollIndicator
            >
              {window.rows.items.map((row) => (
                <GridRow
                  key={row.index}
                  rowIndex={row.index}
                  top={row.offset}
                  height={row.size}
                  getRow={getRow}
                  columns={columns}
                  centerColumns={window.columns}
                  pinnedColumns={pinnedColumns}
                  viewportWidth={viewport.width}
                  scrollX={scrollX}
                  profiling={profiling}
                  testID={testID}
                />
              ))}
            </ScrollView>
          </View>
        </Animated.ScrollView>
      </View>
    </Profiler>
  )
}) as <Row>(
  props: VirtualizedDataGridProps<Row> & { readonly ref?: React.ForwardedRef<DataGridHandle> }
) => ReactNode

export const DataGrid = forwardRef(function DataGrid<Row>(
  props: DataGridProps<Row>,
  ref: React.ForwardedRef<DataGridHandle>
) {
  return <VirtualizedDataGrid {...props} ref={ref} virtualizeColumns />
}) as <Row>(
  props: DataGridProps<Row> & { readonly ref?: React.ForwardedRef<DataGridHandle> }
) => ReactNode

/**
 * Benchmark baseline: it uses the same rows, cell frames, styling, scroll topology, and pinned-column
 * compensation as DataGrid, but mounts every non-pinned column for each visible row.
 */
export const RowVirtualizedDataGrid = forwardRef(function RowVirtualizedDataGrid<Row>(
  props: DataGridProps<Row>,
  ref: React.ForwardedRef<DataGridHandle>
) {
  return <VirtualizedDataGrid {...props} ref={ref} virtualizeColumns={false} />
}) as <Row>(
  props: DataGridProps<Row> & { readonly ref?: React.ForwardedRef<DataGridHandle> }
) => ReactNode

type HeaderProps<Row> = {
  columns: readonly DataGridColumn<Row>[]
  centerColumns: ItemRange
  pinnedColumns: readonly PinnedColumn[]
  viewportWidth: number
  scrollX: Animated.Value
  height: number
  testID?: string
}
function GridHeader<Row>({
  columns,
  centerColumns,
  pinnedColumns,
  viewportWidth,
  scrollX,
  height,
  testID
}: HeaderProps<Row>) {
  return (
    <View style={[styles.header, { height }]}>
      {centerColumns.items.map((item) => {
        const column = columns[item.index]
        if (!column) return null
        return (
          <CellFrame
            key={column.id}
            left={item.offset}
            width={item.size}
            height={height}
            variant="header"
          >
            {renderHeader(column)}
          </CellFrame>
        )
      })}
      {pinnedColumns.map((column) => (
        <PinnedFrame
          key={column.id}
          column={column}
          viewportWidth={viewportWidth}
          scrollX={scrollX}
          height={height}
          variant="header"
          testID={testID ? `${testID}-pinned-header-${column.id}` : undefined}
        >
          {renderHeader(columns[column.index]!)}
        </PinnedFrame>
      ))}
    </View>
  )
}

type RowProps<Row> = {
  rowIndex: number
  top: number
  height: number
  getRow: (index: number) => Row
  columns: readonly DataGridColumn<Row>[]
  centerColumns: ItemRange
  pinnedColumns: readonly PinnedColumn[]
  viewportWidth: number
  scrollX: Animated.Value
  profiling: GridProfilingRecorder
  testID?: string
}
const GridRow = memo(function GridRow<Row>({
  rowIndex,
  top,
  height,
  getRow,
  columns,
  centerColumns,
  pinnedColumns,
  viewportWidth,
  scrollX,
  profiling,
  testID
}: RowProps<Row>) {
  profiling.recordRowRender()
  useEffect(() => {
    profiling.recordRowMount()
    return () => profiling.recordRowUnmount()
  }, [profiling])
  return (
    <View style={[styles.row, { top, height }]}>
      {centerColumns.items.map((item) => {
        const column = columns[item.index]
        if (!column) return null
        return (
          <GridCell
            key={column.id}
            rowIndex={rowIndex}
            getRow={getRow}
            column={column}
            left={item.offset}
            width={item.size}
            height={height}
            profiling={profiling}
          />
        )
      })}
      {pinnedColumns.map((column) => {
        const definition = columns[column.index]!
        return (
          <GridPinnedCell
            key={column.id}
            rowIndex={rowIndex}
            getRow={getRow}
            definition={definition}
            column={column}
            viewportWidth={viewportWidth}
            scrollX={scrollX}
            height={height}
            profiling={profiling}
            testID={testID ? `${testID}-pinned-cell-${rowIndex}-${column.id}` : undefined}
          />
        )
      })}
    </View>
  )
}) as <Row>(props: RowProps<Row>) => ReactNode

type GridCellProps<Row> = {
  rowIndex: number
  getRow: (index: number) => Row
  column: DataGridColumn<Row>
  left: number
  width: number
  height: number
  profiling: GridProfilingRecorder
}
const GridCell = memo(function GridCell<Row>({
  rowIndex,
  getRow,
  column,
  left,
  width,
  height,
  profiling
}: GridCellProps<Row>) {
  profiling.recordCellRender()
  useEffect(() => {
    profiling.recordCellMount()
    return () => profiling.recordCellUnmount()
  }, [profiling])
  const row = getRow(rowIndex)
  return (
    <CellFrame left={left} width={width} height={height}>
      {column.renderCell({ row, rowIndex, column })}
    </CellFrame>
  )
}) as <Row>(props: GridCellProps<Row>) => ReactNode

type GridPinnedCellProps<Row> = {
  rowIndex: number
  getRow: (index: number) => Row
  definition: DataGridColumn<Row>
  column: PinnedColumn
  viewportWidth: number
  scrollX: Animated.Value
  height: number
  profiling: GridProfilingRecorder
  testID?: string
}
const GridPinnedCell = memo(function GridPinnedCell<Row>({
  rowIndex,
  getRow,
  definition,
  column,
  viewportWidth,
  scrollX,
  height,
  profiling,
  testID
}: GridPinnedCellProps<Row>) {
  profiling.recordCellRender()
  useEffect(() => {
    profiling.recordCellMount()
    return () => profiling.recordCellUnmount()
  }, [profiling])
  const row = getRow(rowIndex)
  return (
    <PinnedFrame
      column={column}
      viewportWidth={viewportWidth}
      scrollX={scrollX}
      height={height}
      testID={testID}
    >
      {definition.renderCell({ row, rowIndex, column: definition })}
    </PinnedFrame>
  )
}) as <Row>(props: GridPinnedCellProps<Row>) => ReactNode

type FrameProps = {
  left: number
  width: number
  height: number
  variant?: 'header'
  children: ReactNode
}
function CellFrame({ left, width, height, variant, children }: FrameProps) {
  return (
    <View style={[styles.cell, variant === 'header' && styles.headerCell, { left, width, height }]}>
      {children}
    </View>
  )
}

type PinnedFrameProps = Omit<FrameProps, 'left' | 'width'> & {
  column: PinnedColumn
  viewportWidth: number
  scrollX: Animated.Value
  testID?: string
}
function PinnedFrame({
  column,
  viewportWidth,
  scrollX,
  height,
  variant,
  children,
  testID
}: PinnedFrameProps) {
  const targetLeft =
    column.pinned === 'left'
      ? column.pinnedOffset
      : viewportWidth - column.pinnedOffset - column.size
  const compensation = targetLeft - column.offset
  return (
    <Animated.View
      testID={testID}
      style={[
        styles.cell,
        styles.pinnedCell,
        variant === 'header' && styles.headerCell,
        {
          left: column.offset,
          width: column.size,
          height,
          transform: [{ translateX: Animated.add(scrollX, compensation) }]
        }
      ]}
    >
      {children}
    </Animated.View>
  )
}

function renderHeader<Row>(column: DataGridColumn<Row>): ReactNode {
  if (typeof column.header === 'function') return column.header(column)
  const header = column.header ?? column.id
  return typeof header === 'string' || typeof header === 'number' ? (
    <Text style={styles.headerText}>{header}</Text>
  ) : (
    header
  )
}

function emptyWindow(): RenderWindow {
  return {
    rows: { startIndex: 0, endIndex: 0, items: [] },
    columns: { startIndex: 0, endIndex: 0, items: [] }
  }
}
function sameRange(a: ItemRange, b: ItemRange): boolean {
  return (
    a.startIndex === b.startIndex &&
    a.endIndex === b.endIndex &&
    a.items.length === b.items.length &&
    a.items.every(
      (item, index) =>
        item.index === b.items[index]?.index &&
        item.offset === b.items[index]?.offset &&
        item.size === b.items[index]?.size
    )
  )
}

type GridProfilingRecorder = {
  recordCommit(phase: string, actualDuration: number): void
  recordRowRender(): void
  recordRowMount(): void
  recordRowUnmount(): void
  recordCellRender(): void
  recordCellMount(): void
  recordCellUnmount(): void
  recordScrollEvent(): void
  recordScrollWithoutRangeChange(): void
  recordRangeChange(): void
  getSnapshot(): DataGridProfilingSnapshot
  reset(): void
}

function useGridProfiling(enabled: boolean): GridProfilingRecorder {
  const snapshotRef = useRef<MutableProfilingSnapshot>(emptyProfilingSnapshot())
  return useMemo(() => {
    const increment = (key: keyof DataGridProfilingSnapshot, amount = 1) => {
      if (!enabled) return
      snapshotRef.current[key] += amount
    }
    return {
      recordCommit: (_, actualDuration) => {
        increment('commits')
        increment('commitDurationMs', actualDuration)
      },
      recordRowRender: () => increment('rowRenders'),
      recordRowMount: () => increment('rowMounts'),
      recordRowUnmount: () => increment('rowUnmounts'),
      recordCellRender: () => increment('cellRenders'),
      recordCellMount: () => increment('cellMounts'),
      recordCellUnmount: () => increment('cellUnmounts'),
      recordScrollEvent: () => increment('scrollEvents'),
      recordScrollWithoutRangeChange: () => increment('scrollEventsWithoutRangeChange'),
      recordRangeChange: () => increment('rangeChanges'),
      getSnapshot: () => ({ ...snapshotRef.current }),
      reset: () => {
        snapshotRef.current = emptyProfilingSnapshot()
      }
    }
  }, [enabled])
}

function emptyProfilingSnapshot(): DataGridProfilingSnapshot {
  return {
    commits: 0,
    commitDurationMs: 0,
    rowRenders: 0,
    rowMounts: 0,
    rowUnmounts: 0,
    cellRenders: 0,
    cellMounts: 0,
    cellUnmounts: 0,
    scrollEvents: 0,
    scrollEventsWithoutRangeChange: 0,
    rangeChanges: 0
  }
}

type MutableProfilingSnapshot = { -readonly [Key in keyof DataGridProfilingSnapshot]: number }

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#fff' },
  horizontalScroll: { flex: 1, alignSelf: 'stretch' },
  header: {
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#d9e0e8',
    backgroundColor: '#f8fafc',
    zIndex: 2
  },
  row: { position: 'absolute', left: 0, right: 0 },
  cell: {
    position: 'absolute',
    top: 0,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden'
  },
  pinnedCell: {
    zIndex: 1,
    backgroundColor: '#fff',
    shadowColor: '#334155',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1
  },
  headerCell: { backgroundColor: '#f8fafc', borderBottomWidth: 0 },
  headerText: { fontSize: 12, fontWeight: '700', color: '#334155', textTransform: 'uppercase' }
})
