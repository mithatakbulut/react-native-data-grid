export type CoreGridColumn = {
  readonly id: string
  readonly width: number
  readonly pinned?: 'left' | 'right'
}

export type GridLayoutOptions = {
  readonly rowCount: number
  readonly rowHeight: number
  readonly columns: readonly CoreGridColumn[]
}

export type Viewport = {
  readonly scrollX?: number
  readonly scrollY?: number
  readonly viewportWidth?: number
  readonly viewportHeight?: number
  readonly overscan: number
}

export type ItemSize = {
  readonly index: number
  readonly offset: number
  readonly size: number
}

export type ItemRange = {
  /** Inclusive item index. `items` contains every index from `startIndex` through `endIndex - 1`. */
  readonly startIndex: number
  /** Exclusive item index. `items` contains every index from `startIndex` through `endIndex - 1`. */
  readonly endIndex: number
  readonly items: readonly ItemSize[]
}

/**
 * The logical column interval considered for a center-column render window.
 *
 * `items` contains only unpinned columns in this interval. Pinned columns can be
 * within `[logicalStartIndex, logicalEndIndex)` but are intentionally omitted
 * because callers render them from `getPinnedColumns()`.
 */
export type ColumnRange = {
  readonly logicalStartIndex: number
  readonly logicalEndIndex: number
  readonly items: readonly ItemSize[]
}

export type PinnedColumn = ItemSize & {
  readonly id: string
  readonly pinned: 'left' | 'right'
  readonly pinnedOffset: number
}

export type TotalSize = {
  readonly width: number
  readonly height: number
}

export type GridLayout = {
  getTotalSize(): TotalSize
  getVisibleRows(viewport: Pick<Viewport, 'scrollY' | 'viewportHeight' | 'overscan'>): ItemRange
  getVisibleColumns(viewport: Pick<Viewport, 'scrollX' | 'viewportWidth' | 'overscan'>): ColumnRange
  getRowOffset(rowIndex: number): number
  getColumnOffset(columnIndex: number): number
  getPinnedColumns(): readonly PinnedColumn[]
}

export function createGridLayout(options: GridLayoutOptions): GridLayout {
  validateOptions(options)

  const columns = options.columns.map((column) => ({ ...column }))
  const offsets = new Array<number>(columns.length)
  let totalWidth = 0

  for (let index = 0; index < columns.length; index += 1) {
    offsets[index] = totalWidth
    totalWidth += columns[index]!.width
  }

  const pinnedColumns = buildPinnedColumns(columns, offsets)

  return {
    getTotalSize: () => ({ width: totalWidth, height: options.rowCount * options.rowHeight }),
    getVisibleRows: ({ scrollY = 0, viewportHeight = 0, overscan }) =>
      getFixedSizeRange(options.rowCount, options.rowHeight, scrollY, viewportHeight, overscan),
    getVisibleColumns: ({ scrollX = 0, viewportWidth = 0, overscan }) =>
      getColumnRange(columns, offsets, scrollX, viewportWidth, overscan),
    getRowOffset: (rowIndex) =>
      getOffset(rowIndex, options.rowCount, options.rowHeight, 'rowIndex'),
    getColumnOffset: (columnIndex) => getColumnOffset(offsets, columnIndex),
    getPinnedColumns: () => pinnedColumns
  }
}

function validateOptions({ rowCount, rowHeight, columns }: GridLayoutOptions): void {
  assertNonNegativeInteger(rowCount, 'rowCount')
  assertPositiveFinite(rowHeight, 'rowHeight')

  const ids = new Set<string>()
  let pinnedSection: 'left' | 'center' | 'right' = 'left'
  for (const column of columns) {
    if (!column.id) throw new RangeError('columns must have a non-empty id')
    if (ids.has(column.id)) throw new RangeError(`duplicate column id: ${column.id}`)
    ids.add(column.id)
    assertPositiveFinite(column.width, `width for column ${column.id}`)
    pinnedSection = validatePinnedColumnPosition(column, pinnedSection)
  }
}

function validatePinnedColumnPosition(
  column: CoreGridColumn,
  pinnedSection: 'left' | 'center' | 'right'
): 'left' | 'center' | 'right' {
  if (column.pinned !== undefined && column.pinned !== 'left' && column.pinned !== 'right')
    throw new RangeError(`pinned value for column ${column.id} must be "left" or "right"`)

  if (column.pinned === 'left') {
    if (pinnedSection !== 'left') {
      throw new RangeError(
        'Invalid pinned column configuration: left-pinned columns must appear before all unpinned columns and right-pinned columns.'
      )
    }
    return 'left'
  }

  if (column.pinned === 'right') return 'right'

  if (pinnedSection === 'right') {
    throw new RangeError(
      'Invalid pinned column configuration: right-pinned columns must appear after all left-pinned and unpinned columns.'
    )
  }
  return 'center'
}

function getFixedSizeRange(
  count: number,
  size: number,
  scrollOffset: number,
  viewportSize: number,
  overscan: number
): ItemRange {
  assertNonNegativeInteger(overscan, 'overscan')
  assertNonNegativeFinite(viewportSize, 'viewport size')
  const normalizedOffset = normalizeScrollOffset(scrollOffset)
  if (count === 0 || viewportSize === 0) return emptyRange()

  const firstVisible = Math.min(count - 1, Math.floor(normalizedOffset / size))
  const lastVisibleExclusive = Math.min(count, Math.ceil((normalizedOffset + viewportSize) / size))
  const startIndex = Math.max(0, firstVisible - overscan)
  const endIndex = Math.min(count, Math.max(firstVisible + 1, lastVisibleExclusive) + overscan)
  return makeRange(
    startIndex,
    endIndex,
    (index) => index * size,
    () => size
  )
}

function getColumnRange(
  columns: readonly CoreGridColumn[],
  offsets: readonly number[],
  scrollOffset: number,
  viewportSize: number,
  overscan: number
): ColumnRange {
  assertNonNegativeInteger(overscan, 'overscan')
  assertNonNegativeFinite(viewportSize, 'viewport size')
  const normalizedOffset = normalizeScrollOffset(scrollOffset)
  if (columns.length === 0 || viewportSize === 0) return emptyColumnRange()

  const firstVisible = findFirstColumnEndingAfter(columns, offsets, normalizedOffset)
  const viewportEnd = normalizedOffset + viewportSize
  let lastVisibleExclusive = firstVisible
  while (lastVisibleExclusive < columns.length && offsets[lastVisibleExclusive]! < viewportEnd) {
    lastVisibleExclusive += 1
  }

  const startIndex = Math.max(0, firstVisible - overscan)
  const endIndex = Math.min(
    columns.length,
    Math.max(firstVisible + 1, lastVisibleExclusive) + overscan
  )
  const items: ItemSize[] = []
  for (let index = startIndex; index < endIndex; index += 1) {
    if (!columns[index]!.pinned) {
      items.push({ index, offset: offsets[index]!, size: columns[index]!.width })
    }
  }
  return { logicalStartIndex: startIndex, logicalEndIndex: endIndex, items }
}

function findFirstColumnEndingAfter(
  columns: readonly CoreGridColumn[],
  offsets: readonly number[],
  position: number
): number {
  let low = 0
  let high = columns.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    const end = offsets[middle]! + columns[middle]!.width
    if (end <= position) low = middle + 1
    else high = middle
  }
  return Math.min(low, columns.length - 1)
}

function buildPinnedColumns(
  columns: readonly CoreGridColumn[],
  offsets: readonly number[]
): readonly PinnedColumn[] {
  let leftOffset = 0
  let rightOffset = 0
  const left: PinnedColumn[] = []
  const right: PinnedColumn[] = []
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]!
    if (column.pinned === 'left') {
      left.push({
        index,
        id: column.id,
        offset: offsets[index]!,
        size: column.width,
        pinned: 'left',
        pinnedOffset: leftOffset
      })
      leftOffset += column.width
    }
  }
  for (let index = columns.length - 1; index >= 0; index -= 1) {
    const column = columns[index]!
    if (column.pinned === 'right') {
      right.unshift({
        index,
        id: column.id,
        offset: offsets[index]!,
        size: column.width,
        pinned: 'right',
        pinnedOffset: rightOffset
      })
      rightOffset += column.width
    }
  }
  return [...left, ...right]
}

function getOffset(index: number, count: number, size: number, label: string): number {
  assertNonNegativeInteger(index, label)
  if (index >= count) throw new RangeError(`${label} must be smaller than ${count}`)
  return index * size
}

function getColumnOffset(offsets: readonly number[], index: number): number {
  assertNonNegativeInteger(index, 'columnIndex')
  if (index >= offsets.length)
    throw new RangeError(`columnIndex must be smaller than ${offsets.length}`)
  return offsets[index]!
}

function makeRange(
  startIndex: number,
  endIndex: number,
  getItemOffset: (index: number) => number,
  getItemSize: (index: number) => number
): ItemRange {
  const items: ItemSize[] = []
  for (let index = startIndex; index < endIndex; index += 1)
    items.push({ index, offset: getItemOffset(index), size: getItemSize(index) })
  return { startIndex, endIndex, items }
}

function emptyRange(): ItemRange {
  return { startIndex: 0, endIndex: 0, items: [] }
}
function emptyColumnRange(): ColumnRange {
  return { logicalStartIndex: 0, logicalEndIndex: 0, items: [] }
}
function normalizeScrollOffset(offset: number): number {
  assertFinite(offset, 'scroll offset')
  return Math.max(0, offset)
}
function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${label} must be a positive finite number`)
}
function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${label} must be a non-negative finite number`)
}
function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0)
    throw new RangeError(`${label} must be a non-negative integer`)
}
function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
}
