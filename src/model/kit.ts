/** Small helpers for writing models and templates as editable part lists. */
import type { MaterialDef, Part, PartKind, Project, SceneSettings, Vec3 } from './types.ts'

let counter = 0
export const uid = (prefix = 'p') => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`

export class Kit {
  parts: Part[] = []
  constructor(private prefix: string) {}
  private n = 0
  add(name: string, kind: PartKind, params: Record<string, unknown>, opts: { at?: Vec3; rot?: Vec3; scale?: Vec3; mat?: MaterialDef; parent?: string | null; note?: string; visible?: boolean } = {}) {
    const id = `${this.prefix}${(this.n++).toString(36)}`
    this.parts.push({
      id, name, kind, params, parentId: opts.parent ?? null,
      position: opts.at ?? [0, 0, 0], rotation: opts.rot ?? [0, 0, 0], scale: opts.scale ?? [1, 1, 1],
      material: opts.mat ?? { color: '#cccccc', roughness: 0.6, metalness: 0, opacity: 1 }, visible: opts.visible ?? true, note: opts.note,
    })
    return id
  }
  group(name: string, opts: { at?: Vec3; rot?: Vec3; parent?: string | null; note?: string } = {}) { return this.add(name, 'group', {}, opts) }
}

export const defaultScene = (over: Partial<SceneSettings> = {}): SceneSettings => ({ background: '#e6dfd5', lighting: 'studio', envIntensity: 0.45, shadows: true, grid: false, axes: false, cameraPreset: 'iso', ...over })

export function newProject(p: Pick<Project, 'name' | 'modelName' | 'modelType' | 'description' | 'origin' | 'parts'> & Partial<Project>): Project {
  return {
    schema: 'venture-3d-project', schemaVersion: 1, id: uid('proj'),
    dimensions: { width: 0, height: 0, depth: 0, units: 'cm' }, references: [], assets: {}, scene: defaultScene(), updatedAt: new Date().toISOString(),
    ...p,
  }
}
