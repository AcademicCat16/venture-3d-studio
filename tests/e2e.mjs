/**
 * End-to-end test of the Venture 3D Studio (system Chrome via playwright-core).
 * Local:  npm run build && node tests/e2e.mjs        Live: BASE_URL=https://academiccat16.github.io/venture-3d-studio/ node tests/e2e.mjs
 * Covers: reference import, model/template loading, orbit/zoom/pan, selection, resize, colour/material, texture + decal,
 * save & reload, GLB export → independent viewer → re-import, undo/redo, Confirm Model, ZIP + manifest + checksum validation.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync, strFromU8 } from 'fflate'
import { chromium } from 'playwright-core'

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..'), OUT = join(here, 'output')
mkdirSync(OUT, { recursive: true })
const LIVE = process.env.BASE_URL
const BASE = LIVE ?? 'http://localhost:4200/venture-3d-studio/'
let server
if (!LIVE) {
  server = spawn('npx vite preview --port 4200 --strictPort', { cwd: root, shell: true, stdio: 'ignore' })
  for (let i = 0; ; i++) { try { if ((await fetch(BASE)).ok) break } catch { /* not up */ } if (i > 60) throw new Error('preview did not start'); await new Promise((r) => setTimeout(r, 500)) }
}

// tiny PNG test images (checkerboard texture + transparent logo), written with plain zlib
import { deflateSync } from 'node:zlib'
function png(w, h, px) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b, a] = px(x, y); raw.set([r, g, b, a], y * (w * 4 + 1) + 1 + x * 4) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const texPath = join(OUT, 'test-pattern.png'), logoPath = join(OUT, 'test-logo.png')
writeFileSync(texPath, png(128, 128, (x, y) => ((x >> 4) + (y >> 4)) % 2 ? [40, 74, 70, 255] : [214, 182, 122, 255]))
writeFileSync(logoPath, png(128, 64, (x, y) => (Math.hypot(x - 64, y - 32) < 26 ? [224, 180, 94, 255] : [0, 0, 0, 0])))

let passed = 0; const fails = []
const check = (c, l) => { if (c) { passed++; console.log('  ✓', l) } else { fails.push(l); console.log('  ✗', l) } }
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const errors = []
const S = (page, fn, arg) => page.evaluate(fn, arg)
const state = (page) => S(page, () => { const s = window.__studio.getState(); return { parts: s.project.parts, guide: s.guide, past: s.past.length, sel: s.selectedId, refs: s.project.references.length, assets: Object.keys(s.project.assets).length, saveStatus: s.saveStatus } })
const partByName = (st, n) => st.parts.find((p) => p.name === n)

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(3500)

  console.log('1. Opens with a real, editable 3D model')
  let st = await state(page)
  check(st.parts.length > 80 && partByName(st, 'Snap closure') && partByName(st, 'Necklace bar'), `starting model has ${st.parts.length} editable parts`)
  const pixels = await S(page, () => { const c = document.querySelector('canvas'); const t = document.createElement('canvas'); t.width = 64; t.height = 40; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 64, 40); const d = g.getImageData(0, 0, 64, 40).data; const v = new Set(); for (let i = 0; i < d.length; i += 4) v.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`); return v.size })
  check(pixels > 25, `3D canvas renders (${pixels} distinct colour bins)`)
  await page.screenshot({ path: join(OUT, '01-start.png') })
  await page.click('[data-testid="onboard-close"]')

  console.log('2. Import a reference image')
  await page.click('[data-testid="tab-import"]')
  await page.setInputFiles('[data-testid="ref-input"]', join(root, 'public/references/view-front.jpg'))
  await page.waitForTimeout(600); st = await state(page)
  check(st.refs === 5, `reference added (${st.refs} references)`)
  check(await page.getByText('A picture is not a 3D model.').isVisible(), 'explains reference image vs. editable 3D model')

  console.log('3. Orbit, zoom, pan')
  const box = await page.locator('canvas').boundingBox()
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 160, cy + 40, { steps: 8 }); await page.mouse.up()
  await page.mouse.wheel(0, -300); await page.waitForTimeout(200)
  await page.mouse.move(cx, cy); await page.mouse.down({ button: 'right' }); await page.mouse.move(cx + 60, cy + 20, { steps: 5 }); await page.mouse.up({ button: 'right' })
  st = await state(page); check(st.guide.explored, 'orbit registered (guide step 1)')
  await page.click('[data-testid="view-front"]'); await page.click('[data-testid="ortho"]'); await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, '02-front-ortho.png') })
  await page.click('[data-testid="view-iso"]'); await page.getByRole('button', { name: 'Persp' }).click()
  st = await state(page); check(st.guide.reviewed, 'camera presets and orthographic view work (guide step 4)')

  console.log('4. Select a component')
  await page.click('[data-testid="tab-objects"]')
  await page.click('[data-testid="node-Right panel"]'); await page.waitForTimeout(200)
  await page.click('[data-testid="node-Snap closure"]'); await page.waitForTimeout(300)
  st = await state(page)
  check(st.sel === partByName(st, 'Snap closure').id && (await page.inputValue('[data-testid="part-name"]')) === 'Snap closure', 'selected “Snap closure” from the scene list')
  // click selection in the viewport
  await page.click('[data-testid="view-top"]'); await page.waitForTimeout(500)
  await page.mouse.click(cx, cy); await page.waitForTimeout(300)
  st = await state(page); check(!!st.sel, `clicking the model selects a part (${st.parts.find((p) => p.id === st.sel)?.name})`)

  console.log('5. Change dimensions')
  await page.click('[data-testid="node-Snap closure"]'); await page.waitForTimeout(300)
  const w0 = +(await page.inputValue('[data-testid="size-W"]'))
  await page.fill('[data-testid="size-W"]', String(+(w0 * 1.25).toFixed(2))); await page.press('[data-testid="size-W"]', 'Enter'); await page.waitForTimeout(400)
  st = await state(page)
  const snap = partByName(st, 'Snap closure'), w1 = +(await page.inputValue('[data-testid="size-W"]'))
  check(Math.abs(snap.scale[0] - 1.25) < 0.01 && Math.abs(w1 / w0 - 1.25) < 0.02, `snap closure resized ${w0} → ${w1} cm (scale ${snap.scale[0]})`)
  check(st.guide.changed && st.past > 0, 'change recorded in undo history (guide step 3)')

  console.log('6. Undo / redo')
  await page.click('[data-testid="undo"]'); st = await state(page); check(partByName(st, 'Snap closure').scale[0] === 1, 'undo restores the original size')
  await page.click('[data-testid="redo"]'); st = await state(page); check(Math.abs(partByName(st, 'Snap closure').scale[0] - 1.25) < 0.01, 'redo re-applies it')

  console.log('7. Colours and materials')
  await page.click('[data-testid="node-Left panel"]'); await page.waitForTimeout(150)
  await page.click('[data-testid="node-Left panel shell"]'); await page.waitForTimeout(200)
  await page.click('[data-testid="preset-leather"]')
  await page.locator('[data-testid="color-input"]').fill('#1f4a46'); await page.waitForTimeout(300)
  st = await state(page); check(partByName(st, 'Left panel shell').material.color === '#1f4a46', 'leather shell recoloured to #1f4a46')
  await page.getByRole('button', { name: 'Apply to all matching parts' }).click(); await page.waitForTimeout(300)
  st = await state(page)
  check(partByName(st, 'Right panel shell').material.color === '#1f4a46' && partByName(st, 'Closure tab').material.color === '#1f4a46', 'applied to all matching leather parts')
  await page.screenshot({ path: join(OUT, '03-recoloured.png') })

  console.log('8. Texture and logo decal')
  await page.setInputFiles('[data-testid="texture-input"]', texPath); await page.waitForTimeout(800)
  st = await state(page); check(!!partByName(st, 'Left panel shell').texture, 'image texture applied to the shell')
  await page.setInputFiles('[data-testid="decal-input"]', logoPath); await page.waitForTimeout(900)
  st = await state(page); const decal = st.parts.find((p) => p.name.startsWith('Logo decal')); check(!!decal && !!decal.texture, 'logo decal added as its own part')
  await page.screenshot({ path: join(OUT, '04-texture-decal.png') })

  console.log('9. Save and reload')
  await page.click('[data-testid="tab-project"]'); await page.click('[data-testid="save-version"]'); await page.waitForTimeout(1500)
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3500)
  st = await state(page)
  check(partByName(st, 'Left panel shell').material.color === '#1f4a46' && !!partByName(st, 'Left panel shell').texture && st.parts.some((p) => p.name.startsWith('Logo decal')) && st.refs === 5, 'all edits, uploaded texture, decal and references survive a reload')

  console.log('10. Export GLB → independent viewer → re-import')
  await page.click('[data-testid="tab-project"]')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="export-glb"]')])
  const glbPath = join(OUT, 'exported.glb'); await dl.saveAs(glbPath)
  const glb = readFileSync(glbPath)
  check(glb.subarray(0, 4).toString() === 'glTF' && glb.length > 50_000, `exported a binary glTF (${(glb.length / 1024).toFixed(0)} KB)`)
  const viewer = await ctx.newPage()
  await viewer.route('http://viewer.test/**', (route) => {
    const p = new URL(route.request().url()).pathname
    if (p === '/') return route.fulfill({ path: join(here, 'viewer.html'), contentType: 'text/html' })
    if (p === '/model.glb') return route.fulfill({ path: glbPath, contentType: 'model/gltf-binary' })
    if (p.startsWith('/three/')) return route.fulfill({ path: join(root, 'node_modules', p), contentType: 'text/javascript' })
    route.fulfill({ status: 404 })
  })
  await viewer.goto('http://viewer.test/'); await viewer.waitForFunction(() => window.result, null, { timeout: 30000 })
  const vr = await viewer.evaluate(() => window.result)
  check(vr.meshes > 80 && vr.textures >= 2, `independent three.js viewer loads it: ${vr.meshes} meshes, ${vr.textures} textured`)
  check(Math.abs(vr.size[0] - 0.27) < 0.05 && Math.abs(vr.size[2] - 0.21) < 0.02, `real-world scale in metres: ${vr.size.map((v) => v.toFixed(3)).join(' × ')} m`)
  await viewer.screenshot({ path: join(OUT, '05-independent-viewer.png') }); await viewer.close()
  const before = (await state(page)).parts.length
  await page.setInputFiles('[data-testid="glb-input"]', glbPath); await page.waitForTimeout(2500)
  st = await state(page); const imported = st.parts.find((p) => p.kind === 'gltf')
  check(st.parts.length === before + 1 && imported, 'GLB re-imported into the studio as a part')
  await S(page, (id) => window.__studio.getState().removePart(id), imported.id)

  console.log('11. Confirm Model → handoff ZIP')
  await page.click('[data-testid="confirm-model"]')
  await page.waitForSelector('[data-testid="confirm-ok"], [data-testid="confirm-error"]', { timeout: 90000 })
  check(await page.locator('[data-testid="confirm-ok"]').isVisible(), `confirmed: ${(await page.locator('.modal').innerText()).split('\n').find((l) => l.includes('confirmed')) ?? ''}`)
  const [zdl] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="download-handoff"]')])
  check(zdl.suggestedFilename() === 'Venture_3D_Confirmed_Handoff.zip', 'download is named Venture_3D_Confirmed_Handoff.zip')
  const zipPath = join(OUT, 'Venture_3D_Confirmed_Handoff.zip'); await zdl.saveAs(zipPath)
  const files = unzipSync(readFileSync(zipPath))
  const need = ['model.glb', 'model-manifest.json', 'project.json', 'preview.png', 'README.txt']
  check(need.every((f) => files[f]), `ZIP contains ${Object.keys(files).join(', ')}`)
  const man = JSON.parse(strFromU8(files['model-manifest.json']))
  const sha = createHash('sha256').update(files['model.glb']).digest('hex')
  check(man.integrity.model.sha256 === sha && man.integrity.model.bytes === files['model.glb'].length, 'manifest SHA-256 matches model.glb')
  check(Object.values(man.files).every((f) => files[f]), 'every file named in the manifest exists')
  check(man.schema === 'venture-3d-handoff' && man.schemaVersion && man.units.model === 'meters' && man.camera.position.length === 3 && man.hotspots.length >= 5, `manifest complete (${man.hotspots.length} hotspots, ${man.dimensions.measured.width}×${man.dimensions.measured.height}×${man.dimensions.measured.depth} cm)`)
  const proj = JSON.parse(strFromU8(files['project.json']))
  check(proj.schema === 'venture-3d-project' && Object.values(proj.assets).every((a) => a.url.startsWith('data:')), 'project.json is portable (assets embedded)')
  check(files['preview.png'][1] === 0x50 && files['preview.png'].length > 20_000, `preview.png is a real image (${(files['preview.png'].length / 1024).toFixed(0)} KB)`)
  writeFileSync(join(OUT, 'preview-from-zip.png'), files['preview.png'])
  st = await state(page); check(st.guide.confirmed, 'guide step 5 complete')
  await page.screenshot({ path: join(OUT, '06-confirmed.png') })

  console.log('12. Templates are editable models')
  const tctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const tp = await tctx.newPage()
  await tp.goto(BASE, { waitUntil: 'networkidle' }); await tp.waitForTimeout(2500)
  for (const id of ['bottle', 'box', 'bag', 'mascot', 'merch', 'room', 'sculpture']) {
    await tp.click('[data-testid="tab-templates"]'); await tp.click(`[data-testid="tpl-${id}"]`); await tp.click(`[data-testid="tpl-confirm-${id}"]`); await tp.waitForTimeout(1200)
    const n = (await state(tp)).parts.length
    await tp.screenshot({ path: join(OUT, `tpl-${id}.png`) })
    check(n >= 5, `template “${id}” loads with ${n} editable parts`)
  }
  await tctx.close()
  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`)
} catch (e) { fails.push(String(e)); console.error(e) }
finally { await browser.close(); server?.kill() }
console.log(`\n${passed} passed, ${fails.length} failed`)
if (fails.length) { console.log(fails.map((f) => ' - ' + f).join('\n')); process.exit(1) }
