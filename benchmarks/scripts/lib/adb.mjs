import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024

export function resolveAdbPath() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
  const candidates = []
  if (sdk) candidates.push(join(sdk, 'platform-tools', 'adb'))
  candidates.push(join(homedir(), 'Library', 'Android', 'sdk', 'platform-tools', 'adb'))
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return 'adb'
}

export function createAdb({
  adbPath = resolveAdbPath(),
  serial,
  maxBuffer = DEFAULT_MAX_BUFFER
} = {}) {
  const prefix = serial ? ['-s', serial] : []

  function run(args, options = {}) {
    const stdout = execFileSync(adbPath, [...prefix, ...args], {
      encoding: 'utf8',
      maxBuffer,
      ...options
    })
    return stdout.replaceAll('\r', '')
  }

  function shell(command) {
    return run(['shell', command]).trim()
  }

  return {
    adbPath,
    serial,
    run,
    shell,
    devices() {
      const output = run(['devices', '-l'])
      return output
        .split('\n')
        .slice(1)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !line.startsWith('*'))
        .map((line) => {
          const [id, state, ...rest] = line.split(/\s+/)
          return { id, state, description: rest.join(' ') }
        })
        .filter((device) => device.state === 'device')
    }
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function parseUiNodeBounds(dumpXml, matcher) {
  const nodes = dumpXml.match(/<node\b[^>]*>/g) ?? []
  for (const node of nodes) {
    if (!matcher(node)) continue
    const bounds = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (!bounds) continue
    return {
      left: Number(bounds[1]),
      top: Number(bounds[2]),
      right: Number(bounds[3]),
      bottom: Number(bounds[4])
    }
  }
  return null
}

export function nodeHasIdentifier(node, identifier) {
  return (
    node.includes(`content-desc="${identifier}"`) ||
    node.includes(`resource-id="${identifier}"`) ||
    node.includes(`resource-id="com.reactnativedatagrid.demo:id/${identifier}"`) ||
    node.includes(`text="${identifier}"`)
  )
}

export function tapCenter(bounds) {
  return {
    x: Math.round((bounds.left + bounds.right) / 2),
    y: Math.round((bounds.top + bounds.bottom) / 2)
  }
}

export function swipePath(bounds, scenario) {
  const width = bounds.right - bounds.left
  const height = bounds.bottom - bounds.top
  const xMid = Math.round(bounds.left + width / 2)
  const yMid = Math.round(bounds.top + height / 2)

  if (scenario === 'fast-vertical') {
    return {
      x1: xMid,
      y1: Math.round(bounds.top + height * 0.82),
      x2: xMid,
      y2: Math.round(bounds.top + height * 0.18)
    }
  }

  if (scenario === 'fast-horizontal') {
    return {
      x1: Math.round(bounds.left + width * 0.86),
      y1: yMid,
      x2: Math.round(bounds.left + width * 0.14),
      y2: yMid
    }
  }

  throw new Error(`No automated gesture for scenario "${scenario}"`)
}
