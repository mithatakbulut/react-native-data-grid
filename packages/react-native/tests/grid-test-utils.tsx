import {
  act,
  create,
  type ReactElement,
  type ReactTestInstance,
  type ReactTestRenderer
} from 'react-test-renderer'
import {
  DataGrid,
  RowVirtualizedDataGrid,
  type DataGridCellEvent,
  type DataGridColumn,
  type DataGridHandle
} from '../src/index.js'
import type {
  DataGridCellStyleContext,
  DataGridRowEvent,
  DataGridRowStyleContext,
  DataGridTheme
} from '../src/index.js'
import type { StyleProp, ViewStyle } from 'react-native'
import type { TestAnimatedSum } from './test-animated-value.js'

export type TestRow = { readonly id: number }

export const basicColumns: readonly DataGridColumn<TestRow>[] = [
  { id: 'id', width: 80, renderCell: ({ row }) => `id-${row.id}` },
  { id: 'name', width: 120, renderCell: ({ row }) => `name-${row.id}` },
  { id: 'region', width: 100, renderCell: ({ row }) => `region-${row.id}` }
]

export const pinnedColumns: readonly DataGridColumn<TestRow>[] = [
  { id: 'id', width: 80, pinned: 'left', renderCell: ({ row }) => `id-${row.id}` },
  { id: 'name', width: 160, pinned: 'left', renderCell: ({ row }) => `name-${row.id}` },
  { id: 'region', width: 120, renderCell: ({ row }) => `region-${row.id}` },
  { id: 'revenue', width: 140, renderCell: ({ row }) => `revenue-${row.id}` },
  { id: 'status', width: 100, pinned: 'right', renderCell: ({ row }) => `status-${row.id}` },
  { id: 'actions', width: 72, pinned: 'right', renderCell: ({ row }) => `actions-${row.id}` }
]

export type RenderGridOptions<Row = TestRow> = {
  readonly Grid?: typeof DataGrid
  readonly rowCount?: number
  readonly rowHeight?: number
  readonly headerHeight?: number
  readonly columns?: readonly DataGridColumn<Row>[]
  readonly getRow?: (rowIndex: number) => Row
  readonly rowOverscan?: number
  readonly columnOverscan?: number
  readonly enableProfiling?: boolean
  readonly theme?: DataGridTheme
  readonly getRowStyle?: (context: DataGridRowStyleContext<Row>) => StyleProp<ViewStyle>
  readonly getCellStyle?: (context: DataGridCellStyleContext<Row>) => StyleProp<ViewStyle>
  readonly onCellPress?: (event: DataGridCellEvent<Row>) => void
  readonly onCellLongPress?: (event: DataGridCellEvent<Row>) => void
  readonly onRowPress?: (event: DataGridRowEvent<Row>) => void
  readonly gridRef?: { readonly current: DataGridHandle | null }
  readonly onVisibleRangeChange?: (range: {
    readonly rows: { readonly startIndex: number; readonly endIndex: number }
    readonly columns: {
      readonly logicalStartIndex: number
      readonly logicalEndIndex: number
      readonly items: readonly { readonly index: number }[]
    }
  }) => void
  readonly onRenderRangeChange?: (range: {
    readonly rows: { readonly startIndex: number; readonly endIndex: number }
    readonly columns: {
      readonly logicalStartIndex: number
      readonly logicalEndIndex: number
      readonly items: readonly { readonly index: number }[]
    }
  }) => void
}

export function createGridElement<Row = TestRow>(
  options: RenderGridOptions<Row> = {}
): ReactElement {
  const {
    Grid = DataGrid,
    rowCount = 10,
    rowHeight = 48,
    headerHeight = 44,
    columns = basicColumns as readonly DataGridColumn<Row>[],
    getRow = (rowIndex: number) => ({ id: rowIndex }) as Row,
    rowOverscan = 3,
    columnOverscan = 1,
    enableProfiling = false,
    theme,
    getRowStyle,
    getCellStyle,
    onCellPress,
    onCellLongPress,
    onRowPress,
    gridRef,
    onVisibleRangeChange,
    onRenderRangeChange
  } = options
  return (
    <Grid
      ref={gridRef ?? undefined}
      testID="grid"
      enableProfiling={enableProfiling}
      theme={theme}
      getRowStyle={getRowStyle}
      getCellStyle={getCellStyle}
      onCellPress={onCellPress}
      onCellLongPress={onCellLongPress}
      onRowPress={onRowPress}
      rowCount={rowCount}
      getRow={getRow}
      rowHeight={rowHeight}
      headerHeight={headerHeight}
      rowOverscan={rowOverscan}
      columnOverscan={columnOverscan}
      columns={columns}
      onVisibleRangeChange={onVisibleRangeChange}
      onRenderRangeChange={onRenderRangeChange}
    />
  )
}

export function renderGrid<Row = TestRow>(options: RenderGridOptions<Row> = {}): ReactTestRenderer {
  let grid: ReactTestRenderer | undefined
  act(() => {
    grid = create(createGridElement(options))
  })
  return grid!
}

export { DataGrid, RowVirtualizedDataGrid }

export function layoutGrid(
  grid: ReactTestRenderer,
  layout: { readonly width: number; readonly height: number }
): void {
  act(() => {
    findHandler(grid, 'grid', 'onLayout')({ nativeEvent: { layout } })
  })
}

export function scrollHorizontal(grid: ReactTestRenderer, x: number): void {
  act(() => {
    findHandler(
      grid,
      'grid-horizontal-scroll',
      'onScroll'
    )({
      nativeEvent: { contentOffset: { x, y: 0 } }
    })
  })
}

export function scrollVertical(grid: ReactTestRenderer, y: number): void {
  act(() => {
    findHandler(
      grid,
      'grid-vertical-scroll',
      'onScroll'
    )({
      nativeEvent: { contentOffset: { x: 0, y } }
    })
  })
}

export function findHandler(
  grid: ReactTestRenderer,
  testID: string,
  handler: 'onLayout' | 'onScroll'
): (event: unknown) => void {
  const node = grid.root.findAll(
    (candidate) =>
      candidate.props.testID === testID && typeof candidate.props[handler] === 'function'
  )[0]
  if (!node) throw new Error(`expected ${handler} for ${testID}`)
  return node.props[handler] as (event: unknown) => void
}

export function findRenderedNode(grid: ReactTestRenderer, testID: string) {
  const node = findRenderedNodes(grid, testID)[0]
  if (!node) throw new Error(`expected rendered node for ${testID}`)
  return node
}

export function findRenderedNodes(grid: ReactTestRenderer, testID: string) {
  return grid.root.findAll(
    (candidate) =>
      candidate.type === 'AnimatedView' &&
      candidate.props.testID === testID &&
      Array.isArray(candidate.props.style)
  )
}

export function findBodyCellContent(grid: ReactTestRenderer, text: string) {
  return findScrollBody(grid).findAll((candidate) => nodeShowsText(candidate, text))
}

export function findBodyCellFrame(grid: ReactTestRenderer, text: string): ReactTestInstance {
  let current = findBodyCellContent(grid, text)[0]
  if (!current) throw new Error(`expected body cell content for ${text}`)
  while (current.parent) {
    if (hasCellGeometry(current.props.style)) return current
    current = current.parent
  }
  throw new Error(`expected body cell frame for ${text}`)
}

export function cellGeometry(style: unknown): {
  readonly left: number
  readonly width: number
  readonly height: number
} {
  if (!hasCellGeometry(style)) throw new Error('expected cell geometry')
  return style.find(
    (entry): entry is { readonly left: number; readonly width: number; readonly height: number } =>
      typeof entry === 'object' &&
      entry !== null &&
      'left' in entry &&
      'width' in entry &&
      'height' in entry
  )!
}

export function findHeaderText(grid: ReactTestRenderer, text: string) {
  return grid.root
    .findAll((candidate) => nodeShowsText(candidate, text))
    .filter((candidate) => !isInsideVerticalScroll(candidate))
}

function nodeShowsText(
  candidate: { readonly type: unknown; readonly props: { readonly children?: unknown } },
  text: string
): boolean {
  return (
    (candidate.type === 'View' || candidate.type === 'Text') &&
    readNodeText(candidate.props.children) === text
  )
}

function isInsideVerticalScroll(candidate: { readonly parent: unknown }): boolean {
  let current: { readonly parent: unknown; readonly props?: { readonly testID?: string } } | null =
    candidate as { readonly parent: unknown; readonly props?: { readonly testID?: string } }
  while (current) {
    if (current.props?.testID === 'grid-vertical-scroll') return true
    current = current.parent as typeof current
  }
  return false
}

/** @deprecated Prefer findBodyCellContent or findHeaderText */
export function findTextNodes(grid: ReactTestRenderer, text: string) {
  return [...findBodyCellContent(grid, text), ...findHeaderText(grid, text)]
}

function findScrollBody(grid: ReactTestRenderer) {
  const verticalScroll = grid.root.findAll(
    (candidate) => candidate.props.testID === 'grid-vertical-scroll'
  )[0]
  return verticalScroll ?? grid.root
}

function hasCellGeometry(style: unknown): style is readonly unknown[] {
  return (
    Array.isArray(style) &&
    style.some(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        'left' in entry &&
        'width' in entry &&
        'height' in entry
    )
  )
}

function readNodeText(children: unknown): string | undefined {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children) && children.length === 1) return readNodeText(children[0])
  return undefined
}

export function translateX(style: readonly unknown[]): number {
  const frame = style.find(
    (entry): entry is { readonly transform: readonly { readonly translateX: TestAnimatedSum }[] } =>
      typeof entry === 'object' && entry !== null && 'transform' in entry
  )
  if (!frame) throw new Error('expected an animated transform')
  return frame.transform[0]!.translateX.getValue()
}

export function absoluteLeft(style: readonly unknown[]): number {
  const frame = style.find(
    (entry): entry is { readonly left: number } =>
      typeof entry === 'object' && entry !== null && 'left' in entry
  )
  if (!frame) throw new Error('expected an absolute left offset')
  return frame.left
}

export function visualLeft(
  node: { readonly props: { readonly style: readonly unknown[] } },
  scrollX: number
): number {
  return absoluteLeft(node.props.style) - scrollX + translateX(node.props.style)
}

export function visualRight(
  node: { readonly props: { readonly style: readonly unknown[] } },
  scrollX: number,
  width: number
): number {
  return visualLeft(node, scrollX) + width
}
