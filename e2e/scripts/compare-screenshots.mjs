#!/usr/bin/env node
import { readdir, readFile, copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const baselinesDir = path.join(rootDir, 'screenshots', 'baselines')
const capturedDir = path.join(rootDir, 'screenshots', 'captured')
const diffDir = path.join(rootDir, 'screenshots', 'diff')

/** Maximum allowed mismatch ratio (0.1%). */
const MAX_MISMATCH_RATIO = 0.001

const updateBaselines = process.argv.includes('--update')

async function readPng(filePath) {
  return PNG.sync.read(await readFile(filePath))
}

async function comparePair(name) {
  const baselinePath = path.join(baselinesDir, `${name}.png`)
  const capturedPath = path.join(capturedDir, `${name}.png`)

  let baseline
  try {
    baseline = await readPng(baselinePath)
  } catch {
    if (updateBaselines) {
      await copyFile(capturedPath, baselinePath)
      return { name, status: 'baseline-created' }
    }
    return { name, status: 'missing-baseline' }
  }

  const captured = await readPng(capturedPath)
  if (baseline.width !== captured.width || baseline.height !== captured.height) {
    return {
      name,
      status: 'size-mismatch',
      detail: `${baseline.width}x${baseline.height} vs ${captured.width}x${captured.height}`
    }
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height })
  const mismatchedPixels = pixelmatch(
    baseline.data,
    captured.data,
    diff.data,
    baseline.width,
    baseline.height,
    { threshold: 0.1 }
  )
  const mismatchRatio = mismatchedPixels / (baseline.width * baseline.height)

  if (mismatchRatio > MAX_MISMATCH_RATIO) {
    await mkdir(diffDir, { recursive: true })
    await writeFile(path.join(diffDir, `${name}.png`), PNG.sync.write(diff))
    return {
      name,
      status: 'failed',
      detail: `${(mismatchRatio * 100).toFixed(3)}% > ${(MAX_MISMATCH_RATIO * 100).toFixed(3)}%`
    }
  }

  if (updateBaselines) {
    await copyFile(capturedPath, baselinePath)
    return { name, status: 'baseline-updated', detail: `${(mismatchRatio * 100).toFixed(3)}%` }
  }

  return { name, status: 'passed', detail: `${(mismatchRatio * 100).toFixed(3)}%` }
}

async function main() {
  await mkdir(capturedDir, { recursive: true })
  await mkdir(baselinesDir, { recursive: true })

  const capturedFiles = (await readdir(capturedDir)).filter((file) => file.endsWith('.png'))
  if (capturedFiles.length === 0) {
    console.error(
      'No captured screenshots found. Copy Maestro outputs into e2e/screenshots/captured/.'
    )
    process.exit(1)
  }

  const results = []
  for (const file of capturedFiles.sort()) {
    results.push(await comparePair(path.basename(file, '.png')))
  }

  let exitCode = 0
  for (const result of results) {
    if (result.status === 'passed' || result.status === 'baseline-updated') {
      console.log(`✓ ${result.name}${result.detail ? ` (${result.detail})` : ''}`)
      continue
    }
    exitCode = 1
    if (result.status === 'failed') {
      console.error(`✗ ${result.name}: mismatch ${result.detail}`)
      continue
    }
    if (result.status === 'missing-baseline') {
      console.error(`✗ ${result.name}: missing baseline (run with --update to seed)`)
      continue
    }
    console.error(`✗ ${result.name}: ${result.status}${result.detail ? ` (${result.detail})` : ''}`)
  }

  if (exitCode === 0) {
    console.log(
      `Compared ${results.length} screenshot(s) within ${MAX_MISMATCH_RATIO * 100}% tolerance.`
    )
  }

  process.exit(exitCode)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
