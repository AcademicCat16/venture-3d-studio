/**
 * Turns a Project into real Three.js objects. Used by BOTH the editor viewport and the GLB exporter,
 * so the confirmed model is exactly what the student saw. Geometry and materials are cached by parameters.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { MaterialDef, Part, Project, TextureDef } from './types.ts'

const D2R = Math.PI / 180
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

// ---------------- geometry ----------------
const geoCache = new Map<string, THREE.BufferGeometry>()

function chainGeometry(points: [number, number, number][], link: number) {
  if (points.length < 2) return new THREE.TorusGeometry(link, link * 0.27, 6, 14)
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
  const n = Math.max(2, Math.floor(curve.getLength() / (link * 1.75)))
  const base = new THREE.TorusGeometry(link, link * 0.27, 4, 10); base.deleteAttribute('uv') // tiny links: low-poly is invisible and keeps GLBs small
  const o = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), p = curve.getPointAt(t), tan = curve.getTangentAt(t)
    let axis = i % 2 ? up.clone() : new THREE.Vector3().crossVectors(tan, up)
    if (axis.lengthSq() < 1e-6) axis = new THREE.Vector3(1, 0, 0)
    o.position.copy(p); o.lookAt(p.clone().add(axis.normalize())); o.updateMatrix()
    parts.push(base.clone().applyMatrix4(o.matrix))
  }
  return mergeGeometries(parts)!
}

function stitchGeometry(w: number, d: number, r: number, step: number, plane: string) {
  const pts: [number, number, number][] = []
  const segs = [[-w / 2 + r, -d / 2, w / 2 - r, -d / 2], [w / 2, -d / 2 + r, w / 2, d / 2 - r], [w / 2 - r, d / 2, -w / 2 + r, d / 2], [-w / 2, d / 2 - r, -w / 2, -d / 2 + r]]
  const corners = [[w / 2 - r, -d / 2 + r, -Math.PI / 2], [w / 2 - r, d / 2 - r, 0], [-w / 2 + r, d / 2 - r, Math.PI / 2], [-w / 2 + r, -d / 2 + r, Math.PI]]
  segs.forEach(([x1, z1, x2, z2], i) => {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.floor(len / step))
    for (let k = 0; k < n; k++) pts.push([x1 + ((x2 - x1) * k) / n, z1 + ((z2 - z1) * k) / n, Math.atan2(z2 - z1, x2 - x1)])
    const [cx, cz, a0] = corners[i], arcN = Math.max(2, Math.round((r * Math.PI) / 2 / step))
    for (let k = 0; k < arcN; k++) { const a = a0 + (k / arcN) * (Math.PI / 2); pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a), a + Math.PI / 2]) }
  })
  const base = new THREE.BoxGeometry(step * 0.55, 0.05, 0.06), o = new THREE.Object3D(); base.deleteAttribute('uv')
  const parts = pts.map(([x, z, a]) => {
    if (plane === 'xy') { o.position.set(x, z, 0); o.rotation.set(0, 0, a) } else { o.position.set(x, 0, z); o.rotation.set(0, -a, 0) }
    o.updateMatrix(); return base.clone().applyMatrix4(o.matrix)
  })
  return mergeGeometries(parts)!
}

function zipperGeometry(len: number) {
  const n = Math.max(2, Math.round(len / 0.06)), base = new THREE.BoxGeometry(0.07, 0.06, 0.16), parts: THREE.BufferGeometry[] = []; base.deleteAttribute('uv')
  for (let k = 0; k < n; k++) parts.push(base.clone().translate(-len / 2 + k * 0.06, 0, k % 2 ? 0.05 : -0.05))
  return mergeGeometries(parts)!
}

function emblemGeometry(s: number, depth: number) {
  const outline = (k: number) => [[-s * k, s * 0.35 * k], [-s * 0.55 * k, s * k], [s * 0.55 * k, s * k], [s * k, s * 0.35 * k], [0, -s * 1.1 * k]] as const
  const sh = new THREE.Shape(); outline(1).forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath()
  const hole = new THREE.Path(); outline(0.72).forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y))); hole.closePath(); sh.holes.push(hole)
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 })
}

export function geometryFor(kind: Part['kind'], p: Record<string, unknown>): THREE.BufferGeometry | null {
  const key = kind + JSON.stringify(p)
  const hit = geoCache.get(key); if (hit) return hit
  let g: THREE.BufferGeometry | null = null
  switch (kind) {
    case 'box': g = new THREE.BoxGeometry(num(p.w, 1), num(p.h, 1), num(p.d, 1)); break
    case 'roundedBox': { const w = num(p.w, 1), h = num(p.h, 1), d = num(p.d, 1); const r = Math.min(num(p.r, 0.1), w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3); g = new RoundedBoxGeometry(w, h, d, r < 0.15 ? 2 : r < 0.5 ? 3 : 4, r); break }
    case 'cylinder': g = new THREE.CylinderGeometry(num(p.rt, 1), num(p.rb, num(p.rt, 1)), num(p.h, 1), num(p.seg, 40)); break
    case 'sphere': { const r = num(p.r, 1), small = r < 1; g = new THREE.SphereGeometry(r, small ? 22 : 40, small ? 14 : 24, 0, Math.PI * 2, 0, Math.PI * num(p.thetaFrac, 1)); break }
    case 'capsule': g = new THREE.CapsuleGeometry(num(p.r, 0.5), num(p.len, 1), 8, 32); break
    case 'torus': { const small = num(p.R, 1) < 1; g = new THREE.TorusGeometry(num(p.R, 1), num(p.r, 0.2), small ? 10 : 20, small ? 36 : 64, num(p.arc, 360) * D2R); break }
    case 'cone': g = new THREE.ConeGeometry(num(p.r, 1), num(p.h, 2), 40); break
    case 'gem': g = new THREE.OctahedronGeometry(num(p.r, 0.5), 0); g.scale(1, 0.75, 1); break
    case 'plane': g = new THREE.PlaneGeometry(num(p.w, 2), num(p.h, 2)); break
    case 'chain': g = chainGeometry((p.points as [number, number, number][]) ?? [], num(p.link, 0.085)); break
    case 'stitches': g = stitchGeometry(num(p.w, 10), num(p.d, 10), num(p.r, 0.5), num(p.step, 0.42), String(p.plane ?? 'xz')); break
    case 'zipper': g = zipperGeometry(num(p.len, 10)); break
    case 'emblem': g = emblemGeometry(num(p.s, 1), num(p.depth, 0.12)); break
    case 'lathe': { const pts = ((p.points as [number, number][]) ?? []).map(([r, y]) => new THREE.Vector2(r, y)); g = new THREE.LatheGeometry(pts, 64); break }
    default: g = null
  }
  if (g) { g.computeBoundingBox(); geoCache.set(key, g) }
  return g
}

// ---------------- textures & materials ----------------
const texCache = new Map<string, THREE.Texture>()
const texReady = new Map<string, Promise<THREE.Texture>>()
export function loadTexture(url: string) {
  const hit = texReady.get(url); if (hit) return hit
  const pr = new Promise<THREE.Texture>((res, rej) => new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; texCache.set(url, t); res(t) }, undefined, rej))
  texReady.set(url, pr); return pr
}

const matCache = new Map<string, THREE.MeshPhysicalMaterial>()
export function materialFor(m: MaterialDef, tex: TextureDef | undefined, project: Project, onAsync?: () => void) {
  const url = tex ? project.assets[tex.assetId]?.url : undefined
  const loaded = url ? texCache.get(url) : undefined
  const key = JSON.stringify([m, tex, !!loaded])
  const hit = matCache.get(key); if (hit) return hit
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(m.color), roughness: m.roughness, metalness: m.metalness,
    transparent: m.opacity < 1, opacity: m.opacity, depthWrite: m.opacity >= 0.98,
    transmission: m.transmission ?? 0, thickness: m.transmission ? 0.4 : 0, ior: m.transmission ? 1.7 : 1.5,
    sheen: m.sheen ?? 0, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.6, clearcoat: m.clearcoat ?? 0, clearcoatRoughness: 0.3,
    emissive: new THREE.Color(m.emissive ?? '#000000'), side: THREE.FrontSide,
  })
  if (url) {
    if (loaded) {
      const t = loaded.clone(); t.needsUpdate = true
      t.repeat.set(tex!.repeat[0], tex!.repeat[1]); t.offset.set(tex!.offset[0], tex!.offset[1]); t.center.set(0.5, 0.5); t.rotation = tex!.rotation * D2R
      mat.map = t
      if (m.opacity >= 1) { mat.transparent = true; mat.alphaTest = 0.02 } // logos with transparent backgrounds
    } else loadTexture(url).then(() => onAsync?.()).catch(() => undefined)
  }
  matCache.set(key, mat)
  return mat
}

// ---------------- imported GLB parts ----------------
const gltfCache = new Map<string, THREE.Object3D>()
const gltfLoading = new Map<string, Promise<THREE.Object3D>>()
export function loadGltf(url: string) {
  const hit = gltfLoading.get(url); if (hit) return hit
  const pr = new GLTFLoader().loadAsync(url).then((g) => { gltfCache.set(url, g.scene); return g.scene })
  gltfLoading.set(url, pr); return pr
}

// ---------------- tree ----------------
export interface Built { root: THREE.Group; objects: Map<string, THREE.Object3D> }

export function buildTree(project: Project, opts: { onAsync?: () => void; forExport?: boolean } = {}): Built {
  const root = new THREE.Group(); root.name = project.modelName || 'Model'; root.userData.isModelRoot = true
  const objects = new Map<string, THREE.Object3D>()
  const byParent = new Map<string | null, Part[]>()
  for (const p of project.parts) { const k = p.parentId && project.parts.some((x) => x.id === p.parentId) ? p.parentId : null; byParent.set(k, [...(byParent.get(k) ?? []), p]) }

  const make = (p: Part): THREE.Object3D => {
    let o: THREE.Object3D
    if (p.kind === 'group') o = new THREE.Group()
    else if (p.kind === 'gltf') {
      const url = project.assets[String(p.params.assetId)]?.url
      const src = url ? gltfCache.get(url) : undefined
      o = new THREE.Group()
      if (src) o.add(src.clone(true))
      else if (url) loadGltf(url).then(() => opts.onAsync?.()).catch(() => undefined)
    } else {
      const g = geometryFor(p.kind, p.params)
      const mesh = new THREE.Mesh(g ?? new THREE.BoxGeometry(1, 1, 1), materialFor(p.material, p.texture, project, opts.onAsync))
      mesh.castShadow = p.material.opacity > 0.5; mesh.receiveShadow = true
      o = mesh
    }
    o.name = p.name
    o.userData.partId = p.id
    o.position.set(...p.position)
    o.rotation.set(p.rotation[0] * D2R, p.rotation[1] * D2R, p.rotation[2] * D2R)
    o.scale.set(...p.scale)
    o.visible = p.visible
    objects.set(p.id, o)
    for (const c of byParent.get(p.id) ?? []) { if (opts.forExport && !c.visible) continue; o.add(make(c)) }
    return o
  }
  for (const p of byParent.get(null) ?? []) { if (opts.forExport && !p.visible) continue; root.add(make(p)) }
  return { root, objects }
}

/** Waits for every texture and imported model referenced by the project (needed before export). */
export async function preloadAssets(project: Project) {
  const jobs: Promise<unknown>[] = []
  for (const p of project.parts) {
    if (p.texture) { const u = project.assets[p.texture.assetId]?.url; if (u) jobs.push(loadTexture(u)) }
    if (p.kind === 'gltf') { const u = project.assets[String(p.params.assetId)]?.url; if (u) jobs.push(loadGltf(u)) }
  }
  await Promise.all(jobs)
}
