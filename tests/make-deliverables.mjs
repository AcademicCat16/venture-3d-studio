/**
 * Produces the Mission 2 deliverables the way a student would, in a fresh browser session on the LIVE studio:
 * one meaningful design change (snap closure enlarged 25% for a sturdier closure), save, Confirm Model, download.
 * Output: ../deliverables/ (Venture_3D_Confirmed_Handoff.zip, model.glb, project file, worksheet screenshot).
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync, strFromU8 } from 'fflate'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright-core'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', '..', 'deliverables'); mkdirSync(OUT, { recursive: true })
const BASE = process.env.BASE_URL ?? 'https://academiccat16.github.io/venture-3d-studio/'
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(3500)
await page.click('[data-testid="onboard-close"]')

// explore + review like a student
const box = await page.locator('canvas').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2
await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 120, cy + 30, { steps: 8 }); await page.mouse.up()
await page.click('[data-testid="view-front"]'); await page.click('[data-testid="view-iso"]')

// meaningful change: enlarge the snap closure by 25 %
await page.click('[data-testid="tab-objects"]'); await page.click('[data-testid="node-Right panel"]'); await page.click('[data-testid="node-Snap closure"]'); await page.waitForTimeout(300)
const w0 = +(await page.inputValue('[data-testid="size-W"]'))
await page.fill('[data-testid="size-W"]', String(+(w0 * 1.25).toFixed(2))); await page.press('[data-testid="size-W"]', 'Enter'); await page.waitForTimeout(500)
await page.fill('textarea[placeholder^="e.g."]', 'Enlarged, reinforced snap closure (25% larger) to be tested through repeated use, because faulty snaps were the top defect in 80 Amazon reviews.')
await page.locator('textarea[placeholder^="e.g."]').blur(); await page.waitForTimeout(300)
await page.click('[data-testid="toggle-notes"]'); await page.waitForTimeout(800)
await page.screenshot({ path: join(OUT, 'revised-3d-model-screenshot.png') })
await page.click('[data-testid="toggle-notes"]')

// save + project backup
await page.click('[data-testid="tab-project"]'); await page.click('[data-testid="save-version"]')
const [pdl] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="export-project"]')]); await pdl.saveAs(join(OUT, pdl.suggestedFilename()))

// confirm + download
await page.click('[data-testid="confirm-model"]')
await page.waitForSelector('[data-testid="confirm-ok"], [data-testid="confirm-error"]', { timeout: 90000 })
if (!(await page.locator('[data-testid="confirm-ok"]').isVisible())) throw new Error(await page.locator('[data-testid="confirm-error"]').innerText())
await page.screenshot({ path: join(OUT, 'confirm-model-dialog.png') })
const [zdl] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="download-handoff"]')])
const zipPath = join(OUT, zdl.suggestedFilename()); await zdl.saveAs(zipPath)
await b.close()

const files = unzipSync(readFileSync(zipPath))
const man = JSON.parse(strFromU8(files['model-manifest.json']))
writeFileSync(join(OUT, 'model.glb'), files['model.glb']); writeFileSync(join(OUT, 'preview.png'), files['preview.png'])
const sha = createHash('sha256').update(files['model.glb']).digest('hex')
console.log({ zip: zipPath, files: Object.keys(files), shaMatches: sha === man.integrity.model.sha256, sha, dims: man.dimensions.measured, hotspots: man.hotspots.length, snapNote: man.hotspots.find((h) => h.name === 'Snap closure')?.description, width: `${w0} -> ${(w0 * 1.25).toFixed(2)} cm` })
