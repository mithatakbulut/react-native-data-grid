import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import {
  DataGrid,
  RowVirtualizedDataGrid,
  type DataGridColumn,
  type DataGridHandle
} from '@react-native-data-grid/react-native'
import {
  PRESETS,
  datasetIdForPreset,
  defaultLabConfig,
  labReadyLabel,
  parseLabUrl,
  publicRendererForCellMode,
  type CellMode,
  type GridImplementation,
  type Preset
} from './lab-config'

type DemoRow = {
  readonly id: number
  readonly name: string
  readonly region: string
  readonly status: 'Active' | 'Review' | 'Paused'
  readonly revenue: number
  readonly change: number
}

const BASE_COLUMNS = [
  { id: 'id', width: 86, header: 'ID' },
  { id: 'customer', width: 190, header: 'Customer' },
  { id: 'region', width: 120, header: 'Region' },
  { id: 'status', width: 108, header: 'Status' },
  { id: 'revenue', width: 140, header: 'Revenue' },
  { id: 'change', width: 108, header: 'Change' }
] as const

function getRow(index: number): DemoRow {
  const revenue = ((index * 7_919) % 900_000) + 15_000
  return {
    id: index + 1,
    name: `Account ${index + 1}`,
    region: ['Istanbul', 'Berlin', 'London', 'Tokyo'][index % 4]!,
    status: ['Active', 'Review', 'Paused'][index % 3]! as DemoRow['status'],
    revenue,
    change: ((index * 13) % 41) - 20
  }
}

function createColumns(
  columnCount: number,
  pinnedLeftCount: number,
  pinnedRightCount: number,
  cellMode: CellMode
): readonly DataGridColumn<DemoRow>[] {
  return Array.from({ length: columnCount }, (_, index) => {
    const isPinnedRight = pinnedRightCount > 0 && index === columnCount - 1
    const base = BASE_COLUMNS[index % BASE_COLUMNS.length]!
    const cycle = Math.floor(index / BASE_COLUMNS.length)
    const id = isPinnedRight ? 'actions' : cycle === 0 ? base.id : `${base.id}-${cycle + 1}`
    const header = isPinnedRight
      ? 'Actions'
      : cycle === 0
        ? base.header
        : `${base.header} ${cycle + 1}`
    return {
      id,
      width: isPinnedRight ? 86 : base.width,
      header,
      ...(index < pinnedLeftCount ? { pinned: 'left' as const } : {}),
      ...(isPinnedRight ? { pinned: 'right' as const } : {}),
      renderCell: ({ row, rowIndex }) =>
        cellMode === 'image' ? (
          <ImageCell
            row={row}
            rowIndex={rowIndex}
            columnId={id}
            columnIndex={index}
            isActions={isPinnedRight}
          />
        ) : cellMode === 'light' ? (
          <LightCell row={row} columnIndex={index} isActions={isPinnedRight} />
        ) : (
          <RichCell row={row} columnIndex={index} isActions={isPinnedRight} />
        )
    }
  })
}

function LightCell({
  row,
  columnIndex,
  isActions = false
}: {
  readonly row: DemoRow
  readonly columnIndex: number
  readonly isActions?: boolean
}) {
  const value = isActions
    ? 'Open'
    : [
        `#${row.id.toString().padStart(6, '0')}`,
        row.name,
        row.region,
        row.status,
        `$${row.revenue.toLocaleString('en-US')}`,
        `${row.change >= 0 ? '+' : ''}${row.change}%`
      ][columnIndex % BASE_COLUMNS.length]!
  return (
    <Text numberOfLines={1} style={styles.lightText}>
      {value}
    </Text>
  )
}

function RichCell({
  row,
  columnIndex,
  isActions = false
}: {
  readonly row: DemoRow
  readonly columnIndex: number
  readonly isActions?: boolean
}) {
  const statusColor = row.status === 'Active' ? styles.statusActive : styles.statusReview
  if (isActions) {
    return (
      <Text numberOfLines={1} style={styles.lightText}>
        Open
      </Text>
    )
  }
  return (
    <View style={styles.richCell}>
      <View
        style={[styles.avatar, { backgroundColor: AVATAR_COLORS[row.id % AVATAR_COLORS.length] }]}
      />
      <View style={styles.richText}>
        <Text numberOfLines={1} style={styles.richTitle}>
          {columnIndex % 2 === 0 ? row.name : `Metric ${columnIndex + 1}`}
        </Text>
        <View style={styles.richDetailRow}>
          <View style={[styles.statusDot, statusColor]} />
          <Text numberOfLines={1} style={styles.richDetail}>
            {row.status} · ${(row.revenue + columnIndex * 17).toLocaleString('en-US')}
          </Text>
        </View>
      </View>
    </View>
  )
}

const AVATAR_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fb7185'] as const

/** 1×1 PNG — offline-safe for device tests (no network). */
const IMAGE_PLACEHOLDER_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function ImageCell({
  row,
  rowIndex,
  columnId,
  columnIndex,
  isActions = false
}: {
  readonly row: DemoRow
  readonly rowIndex: number
  readonly columnId: string
  readonly columnIndex: number
  readonly isActions?: boolean
}) {
  if (isActions) {
    return (
      <Text numberOfLines={1} style={styles.lightText}>
        Open
      </Text>
    )
  }
  const isAvatarColumn = columnId === 'id' || columnId.startsWith('id-')
  const isCenterImageColumn = columnId === 'customer' || columnId.startsWith('customer-')
  if (!isAvatarColumn && !isCenterImageColumn) {
    return <LightCell row={row} columnIndex={columnIndex} isActions={false} />
  }
  const testID = isAvatarColumn
    ? `demo-grid-image-pinned-${rowIndex}`
    : `demo-grid-image-center-${rowIndex}`
  return (
    <View style={styles.imageCell}>
      <Image testID={testID} source={{ uri: IMAGE_PLACEHOLDER_URI }} style={styles.imageAvatar} />
      {isAvatarColumn ? (
        <Text numberOfLines={1} style={styles.imageLabel}>
          #{row.id.toString().padStart(4, '0')}
        </Text>
      ) : null}
    </View>
  )
}

export default function App() {
  const gridRef = useRef<DataGridHandle>(null)
  const defaults = defaultLabConfig()
  const [preset, setPreset] = useState<Preset>(
    PRESETS.find((item) => item.id === defaults.dataset)!
  )
  const [rowOverscan, setRowOverscan] = useState(defaults.rowOverscan)
  const [columnOverscan, setColumnOverscan] = useState(defaults.columnOverscan)
  const [pinnedLeftCount, setPinnedLeftCount] = useState(defaults.pinnedLeftCount)
  const [pinnedRightCount, setPinnedRightCount] = useState(defaults.pinnedRightCount)
  const [cellMode, setCellMode] = useState<CellMode>(defaults.cellMode)
  const [gridImplementation, setGridImplementation] = useState<GridImplementation>(
    defaults.implementation
  )
  const [labReady, setLabReady] = useState(false)
  const [metrics, setMetrics] = useState({
    rowStart: 0,
    rowEnd: 0,
    columnStart: 0,
    columnEnd: 0,
    rows: 0,
    centerColumns: 0
  })
  const [profiling, setProfiling] = useState('Reset profile, scroll, then capture a snapshot.')
  const columns = useMemo(
    () => createColumns(preset.columnCount, pinnedLeftCount, pinnedRightCount, cellMode),
    [cellMode, pinnedLeftCount, pinnedRightCount, preset.columnCount]
  )
  const logicalCells = preset.rowCount * preset.columnCount
  const mountedCells = metrics.rows * (metrics.centerColumns + pinnedLeftCount + pinnedRightCount)
  const selectGridImplementation = (next: GridImplementation) => {
    setGridImplementation(next)
    setMetrics({
      rowStart: 0,
      rowEnd: 0,
      columnStart: 0,
      columnEnd: 0,
      rows: 0,
      centerColumns: 0
    })
    setProfiling('Reset profile, scroll, then capture a snapshot.')
  }
  const selectPreset = useCallback((next: Preset) => {
    setPreset(next)
    setMetrics({
      rowStart: 0,
      rowEnd: 0,
      columnStart: 0,
      columnEnd: 0,
      rows: 0,
      centerColumns: 0
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const applyUrl = (url: string | null) => {
      const parsed = parseLabUrl(url)
      if (parsed) {
        const nextPreset = PRESETS.find((item) => item.id === parsed.dataset)
        if (nextPreset) selectPreset(nextPreset)
        setGridImplementation(parsed.implementation)
        setCellMode(parsed.cellMode)
        setRowOverscan(parsed.rowOverscan)
        setColumnOverscan(parsed.columnOverscan)
        setPinnedLeftCount(parsed.pinnedLeftCount)
        setPinnedRightCount(parsed.pinnedRightCount)
        setMetrics({
          rowStart: 0,
          rowEnd: 0,
          columnStart: 0,
          columnEnd: 0,
          rows: 0,
          centerColumns: 0
        })
        setProfiling('Reset profile, scroll, then capture a snapshot.')
      }
      if (!cancelled) setLabReady(true)
    }

    void Linking.getInitialURL().then((url) => {
      if (!cancelled) applyUrl(url)
    })
    const subscription = Linking.addEventListener('url', ({ url }) => applyUrl(url))
    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [selectPreset])

  const captureProfiling = () => {
    const snapshot = gridRef.current?.getProfilingSnapshot()
    if (!snapshot) return
    setProfiling(
      `commits ${snapshot.commits} (${snapshot.commitDurationMs.toFixed(1)}ms) · cell mounts ${snapshot.cellMounts} · range changes ${snapshot.rangeChanges} · unchanged scroll events ${snapshot.scrollEventsWithoutRangeChange}`
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.title}>2D Virtualization Lab</Text>
          <Text style={styles.subtitle}>
            Logical data stays cheap; mounted cells stay inspectable.
          </Text>
        </View>
        <TouchableOpacity
          testID="demo-jump-to-middle"
          onPress={() => gridRef.current?.scrollToRow(Math.floor(preset.rowCount / 2))}
          style={styles.jumpButton}
        >
          <Text style={styles.jumpButtonText}>Jump to middle</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <View
          testID="demo-lab-ready"
          collapsable={false}
          accessible
          accessibilityLabel={
            labReady
              ? labReadyLabel({
                  dataset: datasetIdForPreset(preset),
                  implementation: gridImplementation,
                  renderer: publicRendererForCellMode(cellMode)
                })
              : 'lab-pending'
          }
          style={styles.labReady}
        />
        <ControlLabel label="Scenario">
          {PRESETS.map((item) => (
            <ChoiceButton
              key={item.id}
              testID={`demo-preset-${item.id}`}
              label={item.label}
              selected={preset.id === item.id}
              onPress={() => selectPreset(item)}
            />
          ))}
        </ControlLabel>
        <ControlLabel label="Cell renderer">
          <ChoiceButton
            testID="demo-cell-mode-light"
            label="Light"
            selected={cellMode === 'light'}
            onPress={() => setCellMode('light')}
          />
          <ChoiceButton
            testID="demo-cell-mode-rich"
            label="Rich"
            selected={cellMode === 'rich'}
            onPress={() => setCellMode('rich')}
          />
          <ChoiceButton
            testID="demo-cell-mode-image"
            label="Image"
            selected={cellMode === 'image'}
            onPress={() => setCellMode('image')}
          />
        </ControlLabel>
        <ControlLabel label="Implementation">
          <ChoiceButton
            testID="demo-implementation-two-dimensional"
            label="2D virtualized"
            selected={gridImplementation === 'two-dimensional'}
            onPress={() => selectGridImplementation('two-dimensional')}
          />
          <ChoiceButton
            testID="demo-implementation-rows-only"
            label="Rows only"
            selected={gridImplementation === 'rows-only'}
            onPress={() => selectGridImplementation('rows-only')}
          />
        </ControlLabel>
        <ControlLabel label="Overscan">
          <Stepper label={`Rows ${rowOverscan}`} value={rowOverscan} onChange={setRowOverscan} />
          <Stepper
            label={`Columns ${columnOverscan}`}
            value={columnOverscan}
            onChange={setColumnOverscan}
          />
        </ControlLabel>
        <ControlLabel label="Pinned left">
          <Stepper
            testID="demo-pinned-left"
            label={`${pinnedLeftCount} column${pinnedLeftCount === 1 ? '' : 's'}`}
            value={pinnedLeftCount}
            onChange={setPinnedLeftCount}
            maximum={Math.min(3, preset.columnCount - pinnedRightCount - 1)}
          />
        </ControlLabel>
        <ControlLabel label="Pinned right">
          <Stepper
            testID="demo-pinned-right"
            label={`${pinnedRightCount} column${pinnedRightCount === 1 ? '' : 's'}`}
            value={pinnedRightCount}
            onChange={setPinnedRightCount}
            maximum={Math.min(1, preset.columnCount - pinnedLeftCount - 1)}
          />
        </ControlLabel>
      </View>

      <View style={styles.debugOverlay}>
        <DebugMetric
          label="Logical grid"
          value={`${preset.rowCount.toLocaleString()} × ${preset.columnCount}`}
        />
        <DebugMetric label="Logical cells" value={logicalCells.toLocaleString()} />
        <DebugMetric
          label="Implementation"
          value={gridImplementation === 'two-dimensional' ? '2D virtualized' : 'Rows only'}
        />
        <DebugMetric label="Row range" value={formatRange(metrics.rowStart, metrics.rowEnd)} />
        <DebugMetric
          label="Column range"
          value={formatRange(metrics.columnStart, metrics.columnEnd)}
        />
        <DebugMetric label="Rendered rows" value={metrics.rows.toString()} />
        <DebugMetric label="Center columns" value={metrics.centerColumns.toString()} />
        <DebugMetric label="Mounted cells" value={mountedCells.toLocaleString()} />
      </View>

      {__DEV__ ? (
        <>
          <View style={styles.profilingControls}>
            <TouchableOpacity
              onPress={() => gridRef.current?.resetProfiling()}
              style={styles.profileButton}
            >
              <Text style={styles.profileButtonText}>Reset profile</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={captureProfiling} style={styles.profileButton}>
              <Text style={styles.profileButtonText}>Snapshot</Text>
            </TouchableOpacity>
          </View>
          <Text selectable style={styles.profileText}>
            {profiling}
          </Text>
        </>
      ) : null}

      {gridImplementation === 'two-dimensional' ? (
        <DataGrid
          ref={gridRef}
          testID="demo-grid"
          enableProfiling={__DEV__}
          rowCount={preset.rowCount}
          getRow={getRow}
          rowHeight={52}
          columns={columns}
          rowOverscan={rowOverscan}
          columnOverscan={columnOverscan}
          style={styles.grid}
          onRenderRangeChange={({ rows, columns: visibleColumns }) => {
            setMetrics({
              rowStart: rows.startIndex,
              rowEnd: rows.endIndex,
              columnStart: visibleColumns.logicalStartIndex,
              columnEnd: visibleColumns.logicalEndIndex,
              rows: rows.items.length,
              centerColumns: visibleColumns.items.length
            })
          }}
        />
      ) : (
        <RowVirtualizedDataGrid
          ref={gridRef}
          testID="demo-grid"
          enableProfiling={__DEV__}
          rowCount={preset.rowCount}
          getRow={getRow}
          rowHeight={52}
          columns={columns}
          rowOverscan={rowOverscan}
          columnOverscan={columnOverscan}
          style={styles.grid}
          onRenderRangeChange={({ rows, columns: visibleColumns }) => {
            setMetrics({
              rowStart: rows.startIndex,
              rowEnd: rows.endIndex,
              columnStart: visibleColumns.logicalStartIndex,
              columnEnd: visibleColumns.logicalEndIndex,
              rows: rows.items.length,
              centerColumns: visibleColumns.items.length
            })
          }}
        />
      )}
    </SafeAreaView>
  )
}

function ControlLabel({
  label,
  children
}: {
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <View style={styles.controlGroup}>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={styles.controlChoices}>{children}</View>
    </View>
  )
}

function ChoiceButton({
  label,
  selected,
  onPress,
  testID
}: {
  readonly label: string
  readonly selected: boolean
  readonly onPress: () => void
  readonly testID?: string
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.choiceButton, selected && styles.choiceButtonSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </TouchableOpacity>
  )
}

function Stepper({
  label,
  value,
  onChange,
  maximum = 12,
  testID
}: {
  readonly label: string
  readonly value: number
  readonly onChange: (value: number) => void
  readonly maximum?: number
  readonly testID?: string
}) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        testID={testID ? `${testID}-minus` : undefined}
        onPress={() => onChange(Math.max(0, value - 1))}
        style={styles.stepperButton}
      >
        <Text style={styles.stepperText}>−</Text>
      </TouchableOpacity>
      <Text testID={testID ? `${testID}-value` : undefined} style={styles.stepperLabel}>
        {label}
      </Text>
      <TouchableOpacity
        testID={testID ? `${testID}-plus` : undefined}
        onPress={() => onChange(Math.min(maximum, value + 1))}
        style={styles.stepperButton}
      >
        <Text style={styles.stepperText}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

function DebugMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.debugMetric}>
      <Text style={styles.debugLabel}>{label}</Text>
      <Text style={styles.debugValue}>{value}</Text>
    </View>
  )
}

function formatRange(start: number, end: number): string {
  return end > start ? `${start}–${end - 1}` : '—'
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f1f5f9' },
  topbar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  subtitle: { marginTop: 2, color: '#64748b', fontSize: 12 },
  jumpButton: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 6
  },
  jumpButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  labReady: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  controls: { paddingHorizontal: 16, paddingBottom: 8, gap: 7 },
  controlGroup: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  controlLabel: { width: 86, color: '#475569', fontSize: 11, fontWeight: '700' },
  controlChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 },
  choiceButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#e2e8f0'
  },
  choiceButtonSelected: { backgroundColor: '#1d4ed8' },
  choiceText: { fontSize: 11, color: '#334155', fontWeight: '600' },
  choiceTextSelected: { color: '#fff' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 5,
    padding: 3
  },
  stepperButton: {
    minWidth: 22,
    alignItems: 'center',
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: '#cbd5e1'
  },
  stepperText: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  stepperLabel: { color: '#334155', fontSize: 11, fontWeight: '600' },
  debugOverlay: {
    marginHorizontal: 16,
    padding: 9,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  debugMetric: { minWidth: 88 },
  debugLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: '700' },
  debugValue: { marginTop: 1, color: '#0f172a', fontSize: 13, fontWeight: '700' },
  profilingControls: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  profileButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5
  },
  profileButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  profileText: {
    minHeight: 32,
    paddingHorizontal: 16,
    paddingTop: 5,
    color: '#475569',
    fontSize: 10
  },
  grid: { margin: 12, marginTop: 5, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  lightText: { color: '#334155', fontSize: 12 },
  imageCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  imageAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e2e8f0' },
  imageLabel: { color: '#334155', fontSize: 11, fontWeight: '600' },
  richCell: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  richText: { flex: 1 },
  richTitle: { color: '#1e293b', fontSize: 11, fontWeight: '700' },
  richDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  richDetail: { color: '#64748b', fontSize: 9, flex: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusActive: { backgroundColor: '#16a34a' },
  statusReview: { backgroundColor: '#eab308' }
})
