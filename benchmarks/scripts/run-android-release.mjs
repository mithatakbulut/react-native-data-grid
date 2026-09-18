#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createAdb,
  nodeHasIdentifier,
  parseUiNodeBounds,
  resolveAdbPath,
  sleep,
  swipePath,
  tapCenter
} from './lib/adb.mjs'
import { generateReportMarkdown } from './lib/generate-report.mjs'
import {
  ACTIVITY,
  APP_ID,
  AUTOMATED_SCENARIOS,
  DATASETS,
  IMPLEMENTATIONS,
  MATRICES,
  RENDERERS,
  assertAllowed,
  expandMatrix,
  labReadyNeedle
} from './lib/lab-contract.mjs'
import { parseGfxInfo, parseMemInfoPssKb } from './lib/parse-gfxinfo.mjs'

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const identityPath = join(repoRoot, 'benchmarks/results/.android-release-build-identity.json')
const resultsRoot = join(repoRoot, 'benchmarks/results')
const dumpPathOnDevice = '/data/local/tmp/rndg-uidump.xml'

function usage(exitCode = 2) {
  const text = `Usage: pnpm benchmark:android:run -- [options]

Runs the release-device publish matrix on exactly one physical Android device,
captures raw gfxinfo, and writes a filled report under benchmarks/results/.

Options:
  --matrix publish|full       Named matrix (default: publish)
  --dataset NAME              Repeatable; cartesian with other selectors
  --implementation NAME       Repeatable
  --renderer NAME             Repeatable
  --scenario NAME             Repeatable (fast-vertical, fast-horizontal)
  --runs N                    Repetitions per combination (default: matrix)
  --serial SERIAL             adb device serial
  --install                   Build/install the Android release app first
  --allow-dirty               Allow a dirty git tree
  --fling-duration-ms N       adb swipe duration (default: 120)
  --settle-ms N               Wait after fling before gfxinfo dump (default: 1500)
  --launch-timeout-ms N       Wait for lab-ready (default: 45000)
  --report-only PATH          Regenerate REPORT.md from a session summary.json
  --dry-run                   Print the run list and lab URLs; do not touch a device
  --help
`
  if (exitCode === 0) console.log(text)
  else console.error(text)
  process.exit(exitCode)
}

async function main(argv) {
  const options = parseArgs(argv)
  if (options.help) usage(0)

  if (options.reportOnly) {
    const summaryPath = await resolveSummaryPath(options.reportOnly)
    const session = JSON.parse(await readFile(summaryPath, 'utf8'))
    const reportPath = join(dirname(summaryPath), 'REPORT.md')
    await writeFile(reportPath, generateReportMarkdown(session))
    console.log(`Wrote ${reportPath}`)
    return
  }

  const matrix = buildRunList(options)
  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          matrixName: matrix.name,
          runCount: matrix.runs.length,
          runs: matrix.runs
        },
        null,
        2
      )
    )
    return
  }

  if (options.install) {
    execFileSync('bash', [join(repoRoot, 'benchmarks/scripts/install-android-release.sh')], {
      cwd: repoRoot,
      stdio: 'inherit'
    })
  }

  const git = readGitState()
  if (git.dirty && !options.allowDirty) {
    throw new Error('Working tree is dirty. Commit, stash, or pass --allow-dirty.')
  }

  const adb = createAdb({ adbPath: resolveAdbPath(), serial: options.serial })
  const device = assertPhysicalReleaseDevice(adb)
  const identity = await readBuildIdentity()
  const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'))
  const demoPackage = JSON.parse(await readFile(join(repoRoot, 'apps/demo/package.json'), 'utf8'))
  const capturedAtUtc = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const sessionDirName = [
    capturedAtUtc.replace(/[:.]/g, ''),
    slug(device.label),
    git.commit.slice(0, 7)
  ].join('-')
  const sessionDir = join(resultsRoot, sessionDirName)
  const rawDir = join(sessionDir, 'raw')
  await mkdir(rawDir, { recursive: true })

  const animationScales = readAnimationScales(adb)
  const thermal = readThermalState(adb)
  const session = {
    generatedAtUtc: capturedAtUtc,
    matrixName: matrix.name,
    repetitions: matrix.repetitions,
    settleMs: options.settleMs,
    sourceCommit: git.commit,
    sourceDirty: git.dirty,
    packageVersion: packageJson.version,
    buildCommand: identity?.command ?? 'unknown — run pnpm benchmark:android:release first',
    buildCommit: identity?.sourceCommit ?? null,
    runtimeVersions: `react-native ${demoPackage.dependencies['react-native']}; expo ${demoPackage.dependencies.expo}`,
    devices: [
      {
        label: device.label,
        os: `Android ${device.androidRelease} (SDK ${device.sdk})`,
        storageThermal: thermal,
        serial: device.serial,
        animationScales
      }
    ],
    runs: []
  }

  if (identity?.sourceCommit && identity.sourceCommit !== git.commit) {
    console.warn(
      `Warning: last release install commit ${identity.sourceCommit} differs from HEAD ${git.commit}.`
    )
  }
  if (animationScales.some((scale) => scale.value !== '1' && scale.value !== '1.0')) {
    console.warn(
      `Warning: animator scales are not 1: ${animationScales
        .map((scale) => `${scale.name}=${scale.value}`)
        .join(', ')}`
    )
  }

  let failures = 0
  for (const [index, run] of matrix.runs.entries()) {
    const label = `${index + 1}/${matrix.runs.length} ${run.dataset} ${run.implementation} ${run.renderer} ${run.scenario} #${run.repetition}`
    console.log(`\n==> ${label}`)
    try {
      const captured = await captureRun(adb, {
        run,
        device,
        git,
        options,
        rawDir,
        capturedAtUtc: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
      })
      session.runs.push(captured)
      console.log(`    ${formatJankLine(captured.metrics)}`)
    } catch (error) {
      failures += 1
      const message = error instanceof Error ? error.message : String(error)
      console.error(`    FAILED: ${message}`)
      session.runs.push({
        deviceLabel: device.label,
        dataset: run.dataset,
        renderer: run.renderer,
        implementation: run.implementation,
        scenario: run.scenario,
        repetition: run.repetition,
        capturedAtUtc: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        sourceCommit: git.commit,
        rawArtifact: null,
        screenshotArtifact: null,
        metrics: null,
        memoryPssKb: null,
        error: message
      })
    }
  }

  session.generatedAtUtc = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const summaryPath = join(sessionDir, 'summary.json')
  const reportPath = join(sessionDir, 'REPORT.md')
  await writeFile(summaryPath, `${JSON.stringify(session, null, 2)}\n`)
  await writeFile(reportPath, generateReportMarkdown(session))
  console.log(`\nWrote ${reportPath}`)
  console.log(`Wrote ${summaryPath}`)
  if (failures > 0) {
    throw new Error(`${failures} run(s) failed. The report includes those rows as FAILED.`)
  }
}

function parseArgs(argv) {
  const options = {
    matrix: 'publish',
    datasets: [],
    implementations: [],
    renderers: [],
    scenarios: [],
    runs: null,
    serial: process.env.ANDROID_SERIAL || null,
    install: false,
    allowDirty: false,
    flingDurationMs: 120,
    settleMs: 1500,
    launchTimeoutMs: 45_000,
    reportOnly: null,
    dryRun: false,
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (value == null || value.startsWith('--')) usage()
      index += 1
      return value
    }
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true
        break
      case '--matrix':
        options.matrix = next()
        break
      case '--dataset':
        options.datasets.push(assertAllowed('dataset', next(), DATASETS))
        break
      case '--implementation':
        options.implementations.push(assertAllowed('implementation', next(), IMPLEMENTATIONS))
        break
      case '--renderer':
        options.renderers.push(assertAllowed('renderer', next(), RENDERERS))
        break
      case '--scenario':
        options.scenarios.push(assertAllowed('scenario', next(), AUTOMATED_SCENARIOS))
        break
      case '--runs':
        options.runs = Number.parseInt(next(), 10)
        break
      case '--serial':
        options.serial = next()
        break
      case '--install':
        options.install = true
        break
      case '--allow-dirty':
        options.allowDirty = true
        break
      case '--fling-duration-ms':
        options.flingDurationMs = Number.parseInt(next(), 10)
        break
      case '--settle-ms':
        options.settleMs = Number.parseInt(next(), 10)
        break
      case '--launch-timeout-ms':
        options.launchTimeoutMs = Number.parseInt(next(), 10)
        break
      case '--report-only':
        options.reportOnly = next()
        break
      case '--dry-run':
        options.dryRun = true
        break
      default:
        usage()
    }
  }

  return options
}

function buildRunList(options) {
  const named = MATRICES[options.matrix]
  if (!named) {
    throw new Error(`Unknown matrix "${options.matrix}". Expected publish or full.`)
  }

  const spec = {
    name: named.name,
    datasets: options.datasets.length > 0 ? options.datasets : named.datasets,
    renderers: options.renderers.length > 0 ? options.renderers : named.renderers,
    implementations:
      options.implementations.length > 0 ? options.implementations : named.implementations,
    scenarios: options.scenarios.length > 0 ? options.scenarios : named.scenarios,
    repetitions:
      Number.isFinite(options.runs) && options.runs > 0 ? options.runs : named.repetitions
  }
  spec.name =
    options.datasets.length ||
    options.renderers.length ||
    options.implementations.length ||
    options.scenarios.length ||
    options.runs
      ? `custom:${named.name}`
      : named.name

  return { ...spec, runs: expandMatrix(spec) }
}

function readGitState() {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8'
  }).trim()
  const dirty =
    execFileSync('git', ['status', '--porcelain'], {
      cwd: repoRoot,
      encoding: 'utf8'
    }).trim().length > 0
  return { commit, dirty }
}

async function readBuildIdentity() {
  try {
    return JSON.parse(await readFile(identityPath, 'utf8'))
  } catch {
    return null
  }
}

function assertPhysicalReleaseDevice(adb) {
  const devices = adb.devices()
  if (devices.length !== 1 && !adb.serial) {
    throw new Error(
      `Connect exactly one physical Android device (found ${devices.length}). Pass --serial if several.`
    )
  }
  const selected = adb.serial ? devices.find((device) => device.id === adb.serial) : devices[0]
  if (!selected) {
    throw new Error(`adb device ${adb.serial} is not connected.`)
  }
  if (selected.id.startsWith('emulator-') || /\bemulator\b/.test(selected.description)) {
    throw new Error('A physical Android device is required; the connected target is an emulator.')
  }
  if (adb.shell('getprop ro.kernel.qemu') === '1') {
    throw new Error('A physical Android device is required; the connected target is an emulator.')
  }

  const packagePath = adb.shell(`pm path ${APP_ID}`)
  if (!packagePath.includes('package:')) {
    throw new Error(
      `Release demo app ${APP_ID} is not installed. Run pnpm benchmark:android:release first.`
    )
  }

  const pkgDump = adb.shell(`dumpsys package ${APP_ID}`)
  if (/\bDEBUGGABLE\b/.test(pkgDump)) {
    throw new Error(
      `${APP_ID} is a debuggable/development build. Install a release build with pnpm benchmark:android:release.`
    )
  }

  const manufacturer = adb.shell('getprop ro.product.manufacturer')
  const model = adb.shell('getprop ro.product.model')
  return {
    serial: selected.id,
    manufacturer,
    model,
    label: `${manufacturer} ${model}`.trim(),
    androidRelease: adb.shell('getprop ro.build.version.release'),
    sdk: adb.shell('getprop ro.build.version.sdk'),
    packagePath
  }
}

function readAnimationScales(adb) {
  return ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale'].map(
    (name) => ({
      name,
      value: adb.shell(`settings get global ${name}`)
    })
  )
}

function readThermalState(adb) {
  const battery = adb.shell('dumpsys battery')
  const level = battery.match(/level:\s*(\d+)/)?.[1]
  let thermal = 'unavailable'
  try {
    thermal = adb.shell('cat /sys/class/thermal/thermal_zone0/temp')
  } catch {
    // Some devices do not expose this sysfs node.
  }
  const parts = []
  if (level) parts.push(`battery ${level}%`)
  if (thermal && thermal !== 'unavailable') {
    const milliC = Number(thermal)
    parts.push(
      Number.isFinite(milliC) && milliC > 1000
        ? `thermal ${(milliC / 1000).toFixed(1)}C`
        : `thermal ${thermal}`
    )
  }
  return parts.join('; ') || 'unrecorded'
}

async function captureRun(adb, { run, device, git, options, rawDir, capturedAtUtc }) {
  await launchConfiguredLab(adb, run, options.launchTimeoutMs)
  await sleep(800)

  const dumpXml = dumpUi(adb)
  const targetId =
    run.scenario === 'fast-horizontal' ? 'demo-grid-horizontal-scroll' : 'demo-grid-vertical-scroll'
  const bounds =
    parseUiNodeBounds(dumpXml, (node) => nodeHasIdentifier(node, targetId)) ??
    parseUiNodeBounds(dumpXml, (node) => nodeHasIdentifier(node, 'demo-grid')) ??
    fallbackScreenBounds(adb)

  const gesture = swipePath(bounds, run.scenario)
  adb.shell(`dumpsys gfxinfo ${APP_ID} reset`)
  adb.shell(
    `input swipe ${gesture.x1} ${gesture.y1} ${gesture.x2} ${gesture.y2} ${options.flingDurationMs}`
  )
  await sleep(options.settleMs)

  const gfxinfo = adb.shell(`dumpsys gfxinfo ${APP_ID}`)
  const meminfo = adb.shell(`dumpsys meminfo ${APP_ID}`)
  const metrics = parseGfxInfo(gfxinfo)
  if (metrics.totalFrames == null || metrics.totalFrames < 8) {
    throw new Error(
      `gfxinfo reported ${metrics.totalFrames ?? 0} frames; the fling likely missed the grid.`
    )
  }

  const stem = [
    'android',
    capturedAtUtc.replace(/[:.-]/g, ''),
    run.dataset,
    run.implementation,
    run.renderer,
    run.scenario,
    `r${run.repetition}`
  ].join('-')
  const rawName = `${stem}.txt`
  const screenshotName = `${stem}.png`
  const rawPath = join(rawDir, rawName)
  const screenshotPath = join(rawDir, screenshotName)

  const rawText = [
    `captured_at_utc=${capturedAtUtc}`,
    `source_commit=${git.commit}`,
    `scenario=${run.scenario}`,
    `implementation=${run.implementation}`,
    `renderer=${run.renderer}`,
    `dataset=${run.dataset}`,
    `repetition=${run.repetition}`,
    'build_type=Android release',
    'automation=adb-input-swipe+dumpsys-gfxinfo',
    `lab_url=${run.labUrl}`,
    `device_model=${device.label}`,
    `android_release=${device.androidRelease}`,
    `android_sdk=${device.sdk}`,
    `app_package_path=${device.packagePath}`,
    `gesture=${gesture.x1},${gesture.y1} -> ${gesture.x2},${gesture.y2} ${options.flingDurationMs}ms`,
    `settle_ms=${options.settleMs}`,
    '',
    `--- dumpsys gfxinfo ${APP_ID} ---`,
    gfxinfo.trim(),
    '',
    `--- dumpsys meminfo ${APP_ID} ---`,
    meminfo.trim(),
    ''
  ].join('\n')

  await writeFile(rawPath, rawText)
  try {
    await screenshotWrite(adb, screenshotPath)
  } catch {
    // Screenshot is supplementary evidence; gfxinfo remains the publishable metric.
  }

  return {
    deviceLabel: device.label,
    dataset: run.dataset,
    renderer: run.renderer,
    implementation: run.implementation,
    scenario: run.scenario,
    repetition: run.repetition,
    capturedAtUtc,
    sourceCommit: git.commit,
    labUrl: run.labUrl,
    rawArtifact: `./raw/${rawName}`,
    screenshotArtifact: `./raw/${screenshotName}`,
    metrics,
    memoryPssKb: parseMemInfoPssKb(meminfo),
    gesture
  }
}

async function launchConfiguredLab(adb, run, timeoutMs) {
  const ready = labReadyNeedle(run)
  adb.shell(`am force-stop ${APP_ID}`)
  await sleep(400)
  adb.run([
    'shell',
    'am',
    'start',
    '-W',
    '-a',
    'android.intent.action.VIEW',
    '-c',
    'android.intent.category.BROWSABLE',
    '-d',
    run.labUrl,
    ACTIVITY
  ])

  try {
    await waitForUi(
      adb,
      (xml) => xml.includes(ready),
      Math.min(timeoutMs, 20_000),
      `lab ready via intent (${ready})`
    )
    return
  } catch {
    // Older APKs may not have the rndg:// intent filter. Configure the lab by tapping testIDs.
  }

  adb.shell(`am force-stop ${APP_ID}`)
  await sleep(400)
  adb.run(['shell', 'am', 'start', '-W', '-n', ACTIVITY])
  await waitForUi(
    adb,
    (xml) => xml.includes('demo-lab-ready') || xml.includes('2D Virtualization Lab'),
    timeoutMs,
    'lab chrome'
  )
  await tapIdentifier(adb, `demo-preset-${run.dataset}`)
  await tapIdentifier(adb, rendererTestId(run.renderer))
  await tapIdentifier(adb, `demo-implementation-${run.implementation}`)
  await waitForUi(adb, (xml) => xml.includes(ready), timeoutMs, `lab ready via taps (${ready})`)
}

function rendererTestId(renderer) {
  if (renderer === 'text') return 'demo-cell-mode-light'
  if (renderer === 'rich') return 'demo-cell-mode-rich'
  return 'demo-cell-mode-image'
}

async function tapIdentifier(adb, identifier) {
  const xml = dumpUi(adb)
  const bounds = parseUiNodeBounds(xml, (node) => nodeHasIdentifier(node, identifier))
  if (!bounds) {
    throw new Error(`Could not find on-screen control ${identifier}`)
  }
  const point = tapCenter(bounds)
  adb.shell(`input tap ${point.x} ${point.y}`)
  await sleep(400)
}

async function waitForUi(adb, predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  let lastError = 'no dump yet'
  while (Date.now() < deadline) {
    try {
      const xml = dumpUi(adb)
      if (predicate(xml)) return xml
      lastError = 'predicate not matched'
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await sleep(1000)
  }
  throw new Error(`Timed out waiting for ${label}: ${lastError}`)
}

function dumpUi(adb) {
  adb.shell(`uiautomator dump ${dumpPathOnDevice}`)
  return adb.run(['exec-out', 'cat', dumpPathOnDevice])
}

function fallbackScreenBounds(adb) {
  const size = adb.shell('wm size')
  const match = size.match(/(\d+)x(\d+)/)
  if (!match) {
    throw new Error('Could not read screen size for a fallback swipe target.')
  }
  const width = Number(match[1])
  const height = Number(match[2])
  return { left: 0, top: Math.round(height * 0.42), right: width, bottom: height }
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatJankLine(metrics) {
  if (!metrics) return 'no metrics'
  return `frames ${metrics.totalFrames} janky ${metrics.jankyFrames} (${metrics.jankyPercent}%)`
}

async function resolveSummaryPath(inputPath) {
  const resolved = resolve(inputPath)
  if (resolved.endsWith('summary.json')) return resolved
  return join(resolved, 'summary.json')
}

function screenshotWrite(adb, outputPath) {
  const args = []
  if (adb.serial) args.push('-s', adb.serial)
  args.push('exec-out', 'screencap', '-p')
  const png = execFileSync(adb.adbPath, args, { maxBuffer: 16 * 1024 * 1024 })
  return writeFile(outputPath, png)
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
