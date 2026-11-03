import type { MaterialDef } from './types.ts'

/** Friendly material presets. Values map directly onto glTF PBR properties so they survive export. */
export const MATERIAL_PRESETS: Record<string, { label: string; m: MaterialDef }> = {
  leather: { label: 'Leather', m: { preset: 'leather', color: '#5e3a26', roughness: 0.55, metalness: 0, opacity: 1, sheen: 0.35, clearcoat: 0.15 } },
  fabric: { label: 'Fabric', m: { preset: 'fabric', color: '#eee2cf', roughness: 0.95, metalness: 0, opacity: 1, sheen: 0.4 } },
  velvet: { label: 'Velvet', m: { preset: 'velvet', color: '#9a7a62', roughness: 0.9, metalness: 0, opacity: 1, sheen: 1 } },
  gold: { label: 'Gold', m: { preset: 'gold', color: '#e0b45e', roughness: 0.22, metalness: 1, opacity: 1, clearcoat: 0.3 } },
  silver: { label: 'Silver', m: { preset: 'silver', color: '#d7dbe0', roughness: 0.2, metalness: 1, opacity: 1 } },
  plastic: { label: 'Matte plastic', m: { preset: 'plastic', color: '#3d7cf2', roughness: 0.6, metalness: 0, opacity: 1 } },
  glossy: { label: 'Glossy plastic', m: { preset: 'glossy', color: '#e8473c', roughness: 0.15, metalness: 0, opacity: 1, clearcoat: 1 } },
  glass: { label: 'Glass', m: { preset: 'glass', color: '#ffffff', roughness: 0.05, metalness: 0, opacity: 0.25, clearcoat: 1 } },
  gem: { label: 'Gemstone', m: { preset: 'gem', color: '#8fd6d1', roughness: 0.04, metalness: 0, opacity: 1, transmission: 0.75, clearcoat: 1 } },
  pearl: { label: 'Pearl', m: { preset: 'pearl', color: '#f6efe6', roughness: 0.22, metalness: 0, opacity: 1, sheen: 1, clearcoat: 1 } },
  wood: { label: 'Wood', m: { preset: 'wood', color: '#9b6b43', roughness: 0.7, metalness: 0, opacity: 1 } },
  ceramic: { label: 'Ceramic', m: { preset: 'ceramic', color: '#f4f1ea', roughness: 0.25, metalness: 0, opacity: 1, clearcoat: 0.6 } },
  rubber: { label: 'Rubber', m: { preset: 'rubber', color: '#2a2a2e', roughness: 0.95, metalness: 0, opacity: 1 } },
}

export const mat = (preset: keyof typeof MATERIAL_PRESETS, color?: string, extra: Partial<MaterialDef> = {}): MaterialDef => ({ ...MATERIAL_PRESETS[preset].m, ...(color ? { color } : {}), ...extra })

export const SWATCHES = ['#5e3a26', '#7a4b32', '#2f3a4a', '#1f4a46', '#8a2f3b', '#c9a27e', '#eee2cf', '#f6efe6', '#e0b45e', '#d7dbe0', '#2a2a2e', '#3d7cf2', '#e8473c', '#7fbf8f', '#f2b2b8', '#8fd6d1']

export interface LightingPreset { id: string; label: string; background: string; env: number; key: { color: string; intensity: number; pos: [number, number, number] }; fill: number; rim: number }
export const LIGHTING_PRESETS: LightingPreset[] = [
  { id: 'studio', label: 'Studio', background: '#e6dfd5', env: 0.45, key: { color: '#fff1de', intensity: 3.2, pos: [-30, 30, 18] }, fill: 0.35, rim: 0.9 },
  { id: 'warm', label: 'Warm showroom', background: '#2b211b', env: 0.35, key: { color: '#ffd9a8', intensity: 3.6, pos: [-24, 34, 22] }, fill: 0.25, rim: 1.4 },
  { id: 'daylight', label: 'Cool daylight', background: '#e8eef4', env: 0.7, key: { color: '#f2f6ff', intensity: 2.6, pos: [20, 40, 30] }, fill: 0.5, rim: 0.5 },
  { id: 'dramatic', label: 'Dramatic', background: '#111317', env: 0.15, key: { color: '#ffffff', intensity: 5, pos: [-40, 18, 6] }, fill: 0.05, rim: 2.2 },
  { id: 'soft', label: 'Soft & even', background: '#f3f1ee', env: 1.1, key: { color: '#ffffff', intensity: 1.2, pos: [0, 50, 20] }, fill: 0.6, rim: 0.3 },
]
