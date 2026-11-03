/**
 * Editable project format ("venture-3d-project", schema 1).
 * Units: 1 scene unit = 1 centimetre. Rotations are stored in degrees. Exported GLB files are converted to metres.
 */
export type Vec3 = [number, number, number]

export type PartKind =
  | 'group' | 'box' | 'roundedBox' | 'cylinder' | 'sphere' | 'capsule' | 'torus' | 'cone' | 'gem' | 'plane'
  | 'chain' | 'stitches' | 'zipper' | 'emblem' | 'lathe' | 'gltf'

export interface MaterialDef {
  preset?: string
  color: string
  roughness: number
  metalness: number
  opacity: number
  transmission?: number
  sheen?: number
  clearcoat?: number
  emissive?: string
}

export interface TextureDef {
  assetId: string
  repeat: [number, number]
  offset: [number, number]
  rotation: number // degrees
}

export interface Part {
  id: string
  name: string
  parentId: string | null
  kind: PartKind
  params: Record<string, unknown>
  position: Vec3
  rotation: Vec3
  scale: Vec3
  material: MaterialDef
  texture?: TextureDef
  visible: boolean
  note?: string // feature description, exported as a hotspot
}

export interface Asset { id: string; name: string; mime: string; url: string } // url = data: URL or bundled relative path
export type RefLabel = 'front' | 'side' | 'back' | 'top' | 'concept' | 'other'
export interface ReferenceImage { id: string; assetId: string; label: RefLabel }

export type ModelType = 'Physical product' | 'Brand mascot / character' | 'Merchandise' | 'Service environment' | 'Symbolic object'

export interface SceneSettings {
  background: string
  lighting: string // lighting preset id
  envIntensity: number
  shadows: boolean
  grid: boolean
  axes: boolean
  cameraPreset: 'iso' | 'front' | 'side' | 'top' | 'back'
}

export interface Project {
  schema: 'venture-3d-project'
  schemaVersion: 1
  id: string
  name: string
  modelName: string
  modelType: ModelType
  description: string
  origin: string // how the starting model was created (shown to the student)
  dimensions: { width: number; height: number; depth: number; units: 'cm' }
  references: ReferenceImage[]
  assets: Record<string, Asset>
  parts: Part[]
  scene: SceneSettings
  updatedAt: string
}

export const MODEL_TYPES: ModelType[] = ['Physical product', 'Brand mascot / character', 'Merchandise', 'Service environment', 'Symbolic object']
