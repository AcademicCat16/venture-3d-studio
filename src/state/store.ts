import { create } from 'zustand'
import type { Asset, Part, Project, RefLabel, SceneSettings } from '../model/types.ts'
import { uid } from '../model/kit.ts'
import { LIGHTING_PRESETS } from '../model/presets.ts'

export type ToolMode = 'translate' | 'rotate' | 'scale'
export type GuideStep = 'explored' | 'selected' | 'changed' | 'reviewed' | 'confirmed'
export type Toast = { id: number; text: string; tone: 'ok' | 'warn' | 'error' }

interface State {
  project: Project
  baseline: Record<string, Part>
  past: Project[]
  future: Project[]
  selectedId: string | null
  mode: ToolMode
  ortho: boolean
  viewRequest: { preset: SceneSettings['cameraPreset'] | 'reset'; n: number }
  showRefs: boolean
  showNotes: boolean
  guide: Record<GuideStep, boolean>
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error'
  savedAt: string | null
  confirmed: { version: number; at: string } | null
  toasts: Toast[]
  capture: ((w: number, h: number) => Promise<string>) | null

  load: (p: Project, opts?: { keepHistory?: boolean }) => void
  commit: (fn: (p: Project) => Project) => void
  undo: () => void
  redo: () => void
  select: (id: string | null) => void
  setMode: (m: ToolMode) => void
  setOrtho: (o: boolean) => void
  requestView: (preset: SceneSettings['cameraPreset'] | 'reset') => void
  updatePart: (id: string, patch: Partial<Part>) => void
  addParts: (parts: Part[], select?: string) => void
  removePart: (id: string) => void
  duplicatePart: (id: string) => void
  resetPart: (id: string) => void
  setScene: (patch: Partial<SceneSettings>) => void
  addAsset: (a: Omit<Asset, 'id'>) => string
  addReference: (assetId: string, label: RefLabel) => void
  removeReference: (id: string) => void
  setReferenceLabel: (id: string, label: RefLabel) => void
  setMeta: (patch: Partial<Pick<Project, 'name' | 'modelName' | 'modelType' | 'description' | 'dimensions'>>) => void
  mark: (s: GuideStep) => void
  toast: (text: string, tone?: Toast['tone']) => void
  set: (patch: Partial<State>) => void
}

const touch = (p: Project): Project => ({ ...p, updatedAt: new Date().toISOString() })
const descendants = (parts: Part[], id: string): Set<string> => {
  const out = new Set([id]); let grew = true
  while (grew) { grew = false; for (const p of parts) if (p.parentId && out.has(p.parentId) && !out.has(p.id)) { out.add(p.id); grew = true } }
  return out
}
const HISTORY = 80
const GUIDE_KEY = 'v3d-guide'
function loadGuide(): Record<GuideStep, boolean> {
  const base = { explored: false, selected: false, changed: false, reviewed: false, confirmed: false }
  try { return { ...base, ...JSON.parse(localStorage.getItem(GUIDE_KEY) ?? '{}') } } catch { return base }
}
let toastN = 0

export const useStudio = create<State>((set, get) => ({
  project: null as unknown as Project,
  baseline: {},
  past: [], future: [],
  selectedId: null,
  mode: 'translate',
  ortho: false,
  viewRequest: { preset: 'iso', n: 0 },
  showRefs: true,
  showNotes: false,
  guide: loadGuide(),
  saveStatus: 'saved', savedAt: null,
  confirmed: null,
  toasts: [],
  capture: null,

  load: (p, opts) => set((s) => ({
    project: p, baseline: Object.fromEntries(p.parts.map((x) => [x.id, x])), selectedId: null,
    past: opts?.keepHistory ? [...s.past, s.project].slice(-HISTORY) : [], future: [],
    viewRequest: { preset: p.scene.cameraPreset ?? 'iso', n: s.viewRequest.n + 1 }, saveStatus: 'unsaved',
  })),
  commit: (fn) => set((s) => {
    const next = touch(fn(s.project))
    if (next === s.project) return {}
    return { project: next, past: [...s.past, s.project].slice(-HISTORY), future: [], saveStatus: 'unsaved', guide: { ...s.guide, changed: true } }
  }),
  undo: () => set((s) => s.past.length ? { project: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.project, ...s.future], saveStatus: 'unsaved' } : {}),
  redo: () => set((s) => s.future.length ? { project: s.future[0], future: s.future.slice(1), past: [...s.past, s.project], saveStatus: 'unsaved' } : {}),
  select: (id) => set((s) => ({ selectedId: id, guide: id ? { ...s.guide, selected: true } : s.guide })),
  setMode: (mode) => set({ mode }),
  setOrtho: (ortho) => set((s) => ({ ortho, guide: { ...s.guide, reviewed: true }, viewRequest: { preset: s.project.scene.cameraPreset, n: s.viewRequest.n + 1 } })),
  requestView: (preset) => set((s) => ({ viewRequest: { preset, n: s.viewRequest.n + 1 }, guide: preset === 'reset' ? s.guide : { ...s.guide, reviewed: true } })),

  updatePart: (id, patch) => get().commit((p) => ({ ...p, parts: p.parts.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  addParts: (parts, sel) => { get().commit((p) => ({ ...p, parts: [...p.parts, ...parts] })); set((s) => ({ baseline: { ...s.baseline, ...Object.fromEntries(parts.map((x) => [x.id, x])) }, selectedId: sel ?? s.selectedId })) },
  removePart: (id) => { const ids = descendants(get().project.parts, id); get().commit((p) => ({ ...p, parts: p.parts.filter((x) => !ids.has(x.id)) })); set({ selectedId: null }) },
  duplicatePart: (id) => {
    const { project } = get()
    const ids = descendants(project.parts, id), map = new Map<string, string>()
    ids.forEach((x) => map.set(x, uid('d')))
    const copies = project.parts.filter((x) => ids.has(x.id)).map((x) => ({
      ...structuredClone(x), id: map.get(x.id)!, parentId: x.id === id ? x.parentId : map.get(x.parentId!)!,
      name: x.id === id ? `${x.name} copy` : x.name,
      position: (x.id === id ? [x.position[0] + 2, x.position[1], x.position[2] + 2] : x.position) as Part['position'],
    }))
    get().addParts(copies, map.get(id))
  },
  resetPart: (id) => { const b = get().baseline[id]; if (b) get().updatePart(id, { ...b }) },
  setScene: (patch) => get().commit((p) => {
    let scene = { ...p.scene, ...patch }
    if (patch.lighting) { const lp = LIGHTING_PRESETS.find((l) => l.id === patch.lighting); if (lp) scene = { ...scene, background: lp.background, envIntensity: lp.env } }
    return { ...p, scene }
  }),
  addAsset: (a) => { const id = uid('a'); get().commit((p) => ({ ...p, assets: { ...p.assets, [id]: { ...a, id } } })); return id },
  addReference: (assetId, label) => get().commit((p) => ({ ...p, references: [...p.references, { id: uid('r'), assetId, label }] })),
  removeReference: (id) => get().commit((p) => ({ ...p, references: p.references.filter((r) => r.id !== id) })),
  setReferenceLabel: (id, label) => get().commit((p) => ({ ...p, references: p.references.map((r) => (r.id === id ? { ...r, label } : r)) })),
  setMeta: (patch) => get().commit((p) => ({ ...p, ...patch })),
  mark: (s) => set((st) => (st.guide[s] ? {} : { guide: { ...st.guide, [s]: true } })),
  toast: (text, tone = 'ok') => { const id = ++toastN; set((s) => ({ toasts: [...s.toasts, { id, text, tone }] })); setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === 'error' ? 8000 : 4000) },
  set: (patch) => set(patch),
}))

export const partById = (p: Project, id: string | null) => (id ? p.parts.find((x) => x.id === id) ?? null : null)

// remember guided-workflow progress across reloads (per browser)
useStudio.subscribe((s, prev) => { if (s.guide !== prev.guide) { try { localStorage.setItem(GUIDE_KEY, JSON.stringify(s.guide)) } catch { /* storage blocked */ } } })
