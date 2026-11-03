/**
 * GLB export, independent validation, and the Mission 3 handoff package.
 * The editor works in centimetres; glTF uses metres, so the exported root is scaled by 0.01.
 */
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { zipSync, strToU8 } from 'fflate'
import { buildTree, preloadAssets } from '../model/build.ts'
import type { Project } from '../model/types.ts'

export const HANDOFF_NAME = 'Venture_3D_Confirmed_Handoff.zip'
export const MANIFEST_SCHEMA = 'venture-3d-handoff'
export const MANIFEST_VERSION = '1.0.0'
const D2R = Math.PI / 180

export interface GlbResult { glb: ArrayBuffer; sizeCm: [number, number, number]; centerCm: [number, number, number]; stats: { meshes: number; triangles: number; materials: number; textures: number } }

export async function exportGLB(project: Project): Promise<GlbResult> {
  const meshParts = project.parts.filter((p) => p.visible && p.kind !== 'group')
  if (!meshParts.length) throw new Error('There is nothing to export: the scene has no visible objects.')
  await preloadAssets(project)
  const { root } = buildTree(project, { forExport: true })
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  if (box.isEmpty()) throw new Error('The model has no measurable geometry.')
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3())
  const wrapper = new THREE.Group(); wrapper.name = project.modelName || 'Model'
  root.scale.multiplyScalar(0.01) // centimetres → metres
  wrapper.add(root)
  wrapper.updateMatrixWorld(true)
  const stats = { meshes: 0, triangles: 0, materials: 0, textures: 0 }
  const mats = new Set<THREE.Material>(), texs = new Set<THREE.Texture>()
  wrapper.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    stats.meshes++
    const g = m.geometry; stats.triangles += (g.index ? g.index.count : g.attributes.position.count) / 3
    const mm = m.material as THREE.MeshPhysicalMaterial; mats.add(mm); if (mm.map) texs.add(mm.map)
  })
  stats.materials = mats.size; stats.textures = texs.size; stats.triangles = Math.round(stats.triangles)
  const glb = (await new GLTFExporter().parseAsync(wrapper, { binary: true, onlyVisible: true, maxTextureSize: 2048 })) as ArrayBuffer
  return { glb, sizeCm: [size.x, size.y, size.z], centerCm: [center.x, center.y, center.z], stats }
}

/** Loads the GLB back with a fresh GLTFLoader (separate from the editor scene) and checks it. */
export async function validateGLB(glb: ArrayBuffer, expectedSizeCm?: [number, number, number]) {
  const gltf = await new GLTFLoader().parseAsync(glb.slice(0), '')
  let meshes = 0, textures = 0
  gltf.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { meshes++; if ((m.material as THREE.MeshStandardMaterial).map) textures++ } })
  gltf.scene.updateMatrixWorld(true)
  const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3())
  const problems: string[] = []
  if (!meshes) problems.push('The exported file contains no meshes.')
  if (expectedSizeCm) {
    const exp = expectedSizeCm.map((v) => v / 100), got = [size.x, size.y, size.z]
    exp.forEach((e, i) => { if (e > 0 && Math.abs(got[i] - e) / e > 0.02) problems.push(`Exported size ${'XYZ'[i]} is ${got[i].toFixed(3)} m, expected ${e.toFixed(3)} m.`) })
  }
  return { ok: problems.length === 0, problems, meshes, textures, sizeM: [size.x, size.y, size.z] as [number, number, number], scene: gltf.scene }
}

export async function sha256(data: ArrayBuffer | Uint8Array) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data)
  const h = await crypto.subtle.digest('SHA-256', buf as BufferSource)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const toDataUrl = async (url: string) => {
  if (url.startsWith('data:')) return url
  const blob = await (await fetch(url)).blob()
  return new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob) })
}
/** Portable copy of a project: every asset embedded as a data URL so it works anywhere. */
export async function portableProject(p: Project): Promise<Project> {
  const assets = Object.fromEntries(await Promise.all(Object.values(p.assets).map(async (a) => [a.id, { ...a, url: await toDataUrl(a.url) }] as const)))
  return { ...p, assets }
}

const dataUrlBytes = (u: string) => { const b = atob(u.split(',')[1]); const out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out }

export function download(data: BlobPart, name: string, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

/** Camera framing used for the preview and recommended to Mission 3 (isometric 3/4 view). */
export function isoFraming(sizeCm: [number, number, number], centerCm: [number, number, number], fov = 35) {
  const r = Math.hypot(...sizeCm) / 2
  const dist = (r / Math.sin((fov / 2) * D2R)) * 0.86
  const dir = new THREE.Vector3(1, 0.85, 1.25).normalize()
  const pos = new THREE.Vector3(...centerCm).addScaledVector(dir, dist)
  return { fov, positionCm: pos.toArray() as [number, number, number], targetCm: centerCm }
}

export async function buildHandoff(project: Project, capture: (w: number, h: number) => Promise<string>, version: number, onStage: (i: number) => void = () => undefined) {
  // 1. validate the scene
  onStage(0)
  if (!project.parts.some((p) => p.visible && p.kind !== 'group')) throw new Error('There is nothing to confirm: the scene has no visible objects.')
  // 2. export
  onStage(1)
  const res = await exportGLB(project)
  // 3. independent re-load check
  onStage(2)
  const check = await validateGLB(res.glb, res.sizeCm)
  if (!check.ok) throw new Error(`The model could not be confirmed: ${check.problems.join(' ')}`)
  const texturedParts = project.parts.filter((p) => p.visible && p.texture).length
  if (texturedParts && check.textures === 0) throw new Error('Textures were applied in the studio but none survived export.')
  // 4. preview
  onStage(3)
  const previewUrl = await capture(1600, 1000)
  if (!previewUrl.startsWith('data:image/png')) throw new Error('Could not capture a preview image.')
  const preview = dataUrlBytes(previewUrl)
  const confirmedAt = new Date().toISOString()
  const glbBytes = new Uint8Array(res.glb)
  const [glbHash, previewHash] = await Promise.all([sha256(glbBytes), sha256(preview)])
  const framing = isoFraming(res.sizeCm, res.centerCm)
  const m = (v: number[]) => v.map((x) => +(x / 100).toFixed(5))

  // hotspots from parts that carry a feature note (world-space centre of each part, in metres)
  const { objects, root } = buildTree(project, { forExport: true }); root.updateMatrixWorld(true)
  const hotspots = project.parts.filter((p) => p.note && p.visible).map((p) => {
    const o = objects.get(p.id); const c = o ? new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()) : new THREE.Vector3()
    return { id: p.id, name: p.name, description: p.note!, position: m(c.toArray()) }
  })

  const manifest = {
    schema: MANIFEST_SCHEMA, schemaVersion: MANIFEST_VERSION, generator: 'Venture 3D Studio 1.0.0',
    projectName: project.name, modelName: project.modelName, modelType: project.modelType, description: project.description,
    origin: project.origin, confirmedAt, confirmationVersion: version,
    units: { model: 'meters', display: 'centimeters', upAxis: 'Y', forwardAxis: '+Z' },
    dimensions: { measured: { width: +res.sizeCm[0].toFixed(2), height: +res.sizeCm[1].toFixed(2), depth: +res.sizeCm[2].toFixed(2), units: 'cm' }, studentEstimate: project.dimensions },
    camera: { preset: 'isometric', type: 'perspective', fov: framing.fov, position: m(framing.positionCm), target: m(framing.targetCm) },
    scene: { background: project.scene.background, lighting: project.scene.lighting, environmentIntensity: project.scene.envIntensity, shadows: project.scene.shadows },
    hotspots,
    files: { model: 'model.glb', project: 'project.json', preview: 'preview.png', readme: 'README.txt' },
    integrity: { model: { sha256: glbHash, bytes: glbBytes.byteLength }, preview: { sha256: previewHash, bytes: preview.byteLength } },
    stats: { ...res.stats, validatedMeshes: check.meshes, validatedTextures: check.textures },
  }
  onStage(4)
  const portable = await portableProject(project)
  const readme = [
    'VENTURE 3D STUDIO: CONFIRMED HANDOFF',
    `Model: ${project.modelName} (${project.modelType})`,
    `Confirmed: ${confirmedAt} (version ${version})`,
    '',
    'Files',
    '  model.glb            The confirmed 3D model (glTF binary, metres, Y-up). Load it with three.js GLTFLoader or <model-viewer>.',
    '  model-manifest.json  Machine-readable details: dimensions, camera framing, lighting, feature hotspots, SHA-256 checksums.',
    '  project.json         Editable project. Import it back into Venture 3D Studio (Project > Import project) to keep editing.',
    '  preview.png          Representative product image.',
    '',
    'For Mission 3',
    '  Keep this ZIP intact and attach it when you start Mission 3. Use model.glb as the 3D model on your website,',
    '  frame it with manifest.camera, and use manifest.hotspots for feature callouts.',
    `  Check the model was not changed: its SHA-256 must equal ${glbHash}.`,
    '',
  ].join('\n')
  const zip = zipSync({
    'model.glb': glbBytes,
    'model-manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'project.json': strToU8(JSON.stringify(portable)),
    'preview.png': preview,
    'README.txt': strToU8(readme),
  }, { level: 6 })
  return { zip, manifest, glbHash }
}
