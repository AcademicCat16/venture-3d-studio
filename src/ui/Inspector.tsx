import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { ArrowUpLeft, Copy, Eye, EyeOff, ImagePlus, Lock, Move3d, RotateCcw, Rotate3d, Scale3d, Sticker, Trash2, Unlock, X } from 'lucide-react'
import { partById, useStudio } from '../state/store.ts'
import { buildTree } from '../model/build.ts'
import { LIGHTING_PRESETS, MATERIAL_PRESETS, SWATCHES } from '../model/presets.ts'
import type { MaterialDef, Part, Vec3 } from '../model/types.ts'
import { uid } from '../model/kit.ts'
import { Num, Section, Slider, compressImage, readFile, round } from './common.tsx'

const PARAM_LABELS: Record<string, string> = { w: 'Width', h: 'Height', d: 'Depth', r: 'Radius', rt: 'Top radius', rb: 'Bottom radius', R: 'Ring radius', len: 'Length', s: 'Size', depth: 'Thickness', link: 'Link size', arc: 'Arc (°)', step: 'Stitch length' }

export default function Inspector() {
  const project = useStudio((s) => s.project)
  const id = useStudio((s) => s.selectedId)
  const part = partById(project, id)
  return (
    <aside className="right" aria-label="Inspector">
      <div className="panel-body">
        {part ? <PartInspector part={part} /> : (
          <Section title="Nothing selected" hint="Click any part of the model, or pick one from Objects on the left, to change its size, colour or material."><span /></Section>
        )}
        <SceneSection />
      </div>
    </aside>
  )
}

function PartInspector({ part }: { part: Part }) {
  const project = useStudio((s) => s.project)
  const mode = useStudio((s) => s.mode)
  const { updatePart, removePart, duplicatePart, resetPart, select, setMode, commit, addAsset, addParts, toast } = useStudio.getState()
  const [uniform, setUniform] = useState(true)
  const texIn = useRef<HTMLInputElement>(null), decalIn = useRef<HTMLInputElement>(null)

  // world-space size of the selected part (in cm), measured from real geometry
  const measured = useMemo(() => {
    const { root, objects } = buildTree(project); root.updateMatrixWorld(true)
    const o = objects.get(part.id); if (!o) return null
    const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) return null
    const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3())
    // topmost / frontmost surface of the whole model over this part's centre (so decals are not hidden under other parts)
    let topY = b.max.y, frontZ = b.max.z
    root.traverse((x) => {
      if (!(x as THREE.Mesh).isMesh) return
      const mb = new THREE.Box3().setFromObject(x)
      if (c.x >= mb.min.x && c.x <= mb.max.x && c.z >= mb.min.z && c.z <= mb.max.z) topY = Math.max(topY, mb.max.y)
      if (c.x >= mb.min.x && c.x <= mb.max.x && c.y >= mb.min.y && c.y <= mb.max.y) frontZ = Math.max(frontZ, mb.max.z)
    })
    return { size: [s.x, s.y, s.z] as Vec3, center: [c.x, c.y, c.z] as Vec3, max: [b.max.x, topY, frontZ] as Vec3 }
  }, [project, part.id])

  const set = (patch: Partial<Part>) => updatePart(part.id, patch)
  const setVec = (key: 'position' | 'rotation' | 'scale', i: number, v: number) => {
    const next = [...part[key]] as Vec3
    if (key === 'scale' && uniform) { const f = v / (part.scale[i] || 1); next.forEach((x, j) => (next[j] = round(x * f, 4))) } else next[i] = v
    set({ [key]: next })
  }
  const setSize = (i: number, cm: number) => {
    if (!measured || cm <= 0) return
    const f = cm / measured.size[i]
    set({ scale: (uniform ? part.scale.map((s) => round(s * f, 4)) : part.scale.map((s, j) => (j === i ? round(s * f, 4) : s))) as Vec3 })
  }
  const setMat = (patch: Partial<MaterialDef>) => set({ material: { ...part.material, ...patch } })
  const applyToMatching = () => {
    const original = useStudio.getState().baseline[part.id]?.material.color ?? part.material.color
    const n = project.parts.filter((p) => p.id !== part.id && p.material.color.toLowerCase() === original.toLowerCase()).length
    commit((p) => ({ ...p, parts: p.parts.map((x) => (x.material.color.toLowerCase() === original.toLowerCase() || x.id === part.id ? { ...x, material: { ...part.material } } : x)) }))
    toast(`Applied this material to ${n} matching part${n === 1 ? '' : 's'}.`)
  }
  const uploadTexture = async (f: File) => {
    const url = await compressImage(await readFile(f), 2048)
    const assetId = addAsset({ name: f.name, mime: f.type, url })
    set({ texture: { assetId, repeat: [1, 1], offset: [0, 0], rotation: 0 } }); toast('Texture applied. Adjust its size and position below.')
  }
  const addDecal = async (f: File) => {
    if (!measured) return
    const url = await compressImage(await readFile(f), 1600)
    const assetId = addAsset({ name: f.name, mime: f.type, url })
    const img = new Image(); img.src = url; await img.decode()
    const flat = measured.size[1] < Math.min(measured.size[0], measured.size[2]) * 0.5
    const w = Math.max(1, Math.min(measured.size[0], flat ? measured.size[2] : measured.size[1]) * 0.4), h = (w * img.height) / img.width
    const decal: Part = {
      id: uid('decal'), name: `Logo decal (${f.name})`, parentId: null, kind: 'plane', params: { w, h },
      position: flat ? [measured.center[0], measured.max[1] + 0.03, measured.center[2]] : [measured.center[0], measured.center[1], measured.max[2] + 0.03],
      rotation: flat ? [-90, 0, 0] : [0, 0, 0], scale: [1, 1, 1],
      material: { color: '#ffffff', roughness: 0.5, metalness: 0, opacity: 1 }, texture: { assetId, repeat: [1, 1], offset: [0, 0], rotation: 0 }, visible: true,
    }
    addParts([decal], decal.id); toast('Logo decal placed on the selected part. Move or resize it with the tools.')
  }
  const numericParams = Object.entries(part.params).filter(([, v]) => typeof v === 'number') as [string, number][]
  const tex = part.texture

  return (
    <>
      <Section title="Selected part" right={<span className="kind">{part.kind === 'roundedBox' ? 'rounded box' : part.kind}</span>}>
        <input className="name-in" value={part.name} onChange={(e) => set({ name: e.target.value })} aria-label="Part name" data-testid="part-name" />
        <div className="btns tight" style={{ marginTop: 8 }}>
          <button className="icon" title="Select parent group" disabled={!part.parentId} onClick={() => select(part.parentId)}><ArrowUpLeft size={14} /></button>
          <button className="icon" title={part.visible ? 'Hide' : 'Show'} onClick={() => set({ visible: !part.visible })}>{part.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
          <button className="icon" title="Duplicate (Ctrl+D)" onClick={() => duplicatePart(part.id)}><Copy size={14} /></button>
          <button className="icon" title="Reset this part to how it started" onClick={() => resetPart(part.id)} data-testid="reset-part"><RotateCcw size={14} /></button>
          <button className="icon danger" title="Delete (Del)" onClick={() => removePart(part.id)}><Trash2 size={14} /></button>
        </div>
      </Section>

      <Section title="Move, rotate, resize" right={
        <div className="seg">
          {([['translate', Move3d, 'Move (W)'], ['rotate', Rotate3d, 'Rotate (E)'], ['scale', Scale3d, 'Resize (R)']] as const).map(([m, I, t]) => <button key={m} className={mode === m ? 'on' : ''} title={t} onClick={() => setMode(m)} data-testid={`mode-${m}`}><I size={14} /></button>)}
        </div>}>
        <div className="vec"><span>Position <i>cm</i></span>{[0, 1, 2].map((i) => <Num key={i} label={'XYZ'[i]} value={part.position[i]} onChange={(v) => setVec('position', i, v)} />)}</div>
        <div className="vec"><span>Rotation <i>°</i></span>{[0, 1, 2].map((i) => <Num key={i} label={'XYZ'[i]} step={5} value={part.rotation[i]} onChange={(v) => setVec('rotation', i, v)} />)}</div>
        <div className="vec"><span>Scale <button className="icon inline" title={uniform ? 'Uniform scaling on' : 'Uniform scaling off'} onClick={() => setUniform(!uniform)}>{uniform ? <Lock size={11} /> : <Unlock size={11} />}</button></span>{[0, 1, 2].map((i) => <Num key={i} label={'XYZ'[i]} step={0.05} value={part.scale[i]} onChange={(v) => setVec('scale', i, v)} testId={`scale-${i}`} />)}</div>
      </Section>

      {measured && (
        <Section title="Real size" hint="Measured from the 3D geometry. Type a new size to resize.">
          <div className="row3">{(['W', 'H', 'D'] as const).map((l, i) => <Num key={l} label={l} unit="cm" value={round(measured.size[i], 2)} onChange={(v) => setSize(i, v)} testId={`size-${l}`} />)}</div>
        </Section>
      )}

      {numericParams.length > 0 && (
        <Section title="Shape">
          <div className="params">{numericParams.map(([k, v]) => <Num key={k} label={PARAM_LABELS[k] ?? k} value={v} step={k === 'arc' ? 5 : 0.1} min={k === 'arc' ? 1 : 0.01} onChange={(nv) => set({ params: { ...part.params, [k]: nv } })} />)}</div>
        </Section>
      )}

      {part.kind !== 'group' && part.kind !== 'gltf' && (
        <>
          <Section title="Material & colour">
            <div className="chips">{Object.entries(MATERIAL_PRESETS).map(([k, p]) => <button key={k} className={`chip ${part.material.preset === k ? 'on' : ''}`} onClick={() => setMat({ ...p.m, color: k === 'glass' || k === 'gold' || k === 'silver' || k === 'pearl' ? p.m.color : part.material.color, preset: k })} data-testid={`preset-${k}`}>{p.label}</button>)}</div>
            <div className="color-row">
              <input type="color" value={part.material.color} onChange={(e) => setMat({ color: e.target.value })} aria-label="Colour" data-testid="color-input" />
              <div className="swatches">{SWATCHES.map((c) => <button key={c} className="sw" style={{ background: c }} onClick={() => setMat({ color: c })} aria-label={`Colour ${c}`} />)}</div>
            </div>
            <Slider label="Roughness" value={part.material.roughness} onChange={(v) => setMat({ roughness: v })} />
            <Slider label="Metallic" value={part.material.metalness} onChange={(v) => setMat({ metalness: v })} />
            <Slider label="Opacity" value={part.material.opacity} min={0.05} onChange={(v) => setMat({ opacity: v })} />
            <button className="btn sm" style={{ marginTop: 8 }} onClick={applyToMatching} title="Apply to every part that started with the same colour">Apply to all matching parts</button>
          </Section>

          <Section title="Texture & logo" hint="Use an image as a surface pattern, or place your logo as a decal.">
            <div className="btns">
              <button className="btn sm" onClick={() => texIn.current?.click()} data-testid="texture-btn"><ImagePlus size={13} />Apply image texture</button>
              <button className="btn sm" onClick={() => decalIn.current?.click()} data-testid="decal-btn"><Sticker size={13} />Add logo decal</button>
            </div>
            <input ref={texIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTexture(f); e.target.value = '' }} data-testid="texture-input" />
            <input ref={decalIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addDecal(f); e.target.value = '' }} data-testid="decal-input" />
            {tex && (
              <div className="tex">
                <div className="tex-head"><img src={project.assets[tex.assetId]?.url} alt="" /><span>{project.assets[tex.assetId]?.name}</span><button className="icon" onClick={() => set({ texture: undefined })} aria-label="Remove texture"><X size={13} /></button></div>
                <Slider label="Repeat X" min={0.2} max={8} step={0.1} value={tex.repeat[0]} onChange={(v) => set({ texture: { ...tex, repeat: [v, tex.repeat[1]] } })} />
                <Slider label="Repeat Y" min={0.2} max={8} step={0.1} value={tex.repeat[1]} onChange={(v) => set({ texture: { ...tex, repeat: [tex.repeat[0], v] } })} />
                <Slider label="Offset X" min={-1} max={1} value={tex.offset[0]} onChange={(v) => set({ texture: { ...tex, offset: [v, tex.offset[1]] } })} />
                <Slider label="Offset Y" min={-1} max={1} value={tex.offset[1]} onChange={(v) => set({ texture: { ...tex, offset: [tex.offset[0], v] } })} />
                <Slider label="Rotate" min={-180} max={180} step={1} value={tex.rotation} onChange={(v) => set({ texture: { ...tex, rotation: v } })} />
              </div>
            )}
          </Section>
        </>
      )}

      <Section title="Feature note" hint="Optional. Explain why this part matters; it becomes a hotspot on your Mission 3 website.">
        <textarea rows={3} value={part.note ?? ''} placeholder="e.g. Reinforced snap tested for repeated use" onChange={(e) => set({ note: e.target.value || undefined })} />
      </Section>
    </>
  )
}

function SceneSection() {
  const scene = useStudio((s) => s.project.scene)
  const { setScene } = useStudio.getState()
  return (
    <Section title="Lighting & background">
      <div className="chips">{LIGHTING_PRESETS.map((l) => <button key={l.id} className={`chip ${scene.lighting === l.id ? 'on' : ''}`} onClick={() => setScene({ lighting: l.id })} data-testid={`light-${l.id}`}>{l.label}</button>)}</div>
      <div className="color-row"><span className="lbl">Background</span><input type="color" value={scene.background} onChange={(e) => setScene({ background: e.target.value })} aria-label="Background colour" /></div>
      <Slider label="Ambient light" min={0} max={2} value={scene.envIntensity} onChange={(v) => setScene({ envIntensity: v })} />
      <label className="check"><input type="checkbox" checked={scene.shadows} onChange={(e) => setScene({ shadows: e.target.checked })} />Shadows</label>
    </Section>
  )
}
