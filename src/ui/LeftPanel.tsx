import { useRef, useState } from 'react'
import { Box, ChevronDown, ChevronRight, Copy, Eye, EyeOff, FileDown, FileUp, FolderOpen, ImagePlus, Info, Layers, LayoutTemplate, Plus, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
import { useStudio } from '../state/store.ts'
import { TEMPLATES } from '../model/templates.ts'
import { MODEL_TYPES } from '../model/types.ts'
import type { ModelType, Part, PartKind, RefLabel } from '../model/types.ts'
import { mat } from '../model/presets.ts'
import { uid } from '../model/kit.ts'
import { Num, Section, compressImage, readFile } from './common.tsx'
import { download, exportGLB, portableProject, validateGLB } from '../export/exporter.ts'
import { KEYS, idbGet, idbSet, isProject } from '../state/persist.ts'
import type { SavedVersion } from '../state/persist.ts'

type Tab = 'project' | 'import' | 'templates' | 'objects'

export default function LeftPanel() {
  const [tab, setTab] = useState<Tab>('objects')
  const tabs: [Tab, string, typeof Box][] = [['project', 'Project', FolderOpen], ['import', 'Import', ImagePlus], ['templates', 'Templates', LayoutTemplate], ['objects', 'Objects', Layers]]
  return (
    <aside className="left">
      <nav className="tabs" role="tablist">
        {tabs.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} data-testid={`tab-${id}`}><Icon size={15} />{label}</button>)}
      </nav>
      <div className="panel-body">
        {tab === 'project' && <ProjectPanel />}
        {tab === 'import' && <ImportPanel />}
        {tab === 'templates' && <TemplatesPanel onDone={() => setTab('objects')} />}
        {tab === 'objects' && <ObjectsPanel />}
      </div>
    </aside>
  )
}

// ---------------- Project ----------------
function ProjectPanel() {
  const p = useStudio((s) => s.project)
  const { setMeta, load, toast, set, addAsset, addParts } = useStudio.getState()
  const savedAt = useStudio((s) => s.savedAt)
  const confirmed = useStudio((s) => s.confirmed)
  const projIn = useRef<HTMLInputElement>(null), glbIn = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const saveVersion = async () => {
    const rec: SavedVersion = { project: p, savedAt: new Date().toISOString(), label: 'Saved version' }
    await idbSet(KEYS.saved, rec); await idbSet(KEYS.current, p)
    set({ saveStatus: 'saved', savedAt: rec.savedAt }); toast('Saved. You can restore this version any time.')
  }
  const restore = async () => {
    const rec = await idbGet<SavedVersion>(KEYS.saved)
    if (!rec) return toast('No saved version yet. Click Save first.', 'warn')
    load(rec.project, { keepHistory: true }); toast(`Restored the version saved ${new Date(rec.savedAt).toLocaleString()}.`)
  }
  const exportProject = async () => { const portable = await portableProject(p); download(JSON.stringify(portable), `${slug(p.name)}.venture3d.json`, 'application/json'); toast('Project file downloaded. Keep it as a backup.') }
  const importProject = async (f: File) => {
    try { const data = JSON.parse(await readFile(f, 'text')); if (!isProject(data)) throw new Error('This file is not a Venture 3D Studio project.'); load(data); toast(`Opened “${data.name}”.`) }
    catch (e) { toast((e as Error).message, 'error') }
  }
  const exportModel = async () => {
    setBusy(true)
    try { const r = await exportGLB(p); const v = await validateGLB(r.glb, r.sizeCm); if (!v.ok) throw new Error(v.problems.join(' ')); download(r.glb, `${slug(p.modelName)}.glb`, 'model/gltf-binary'); toast(`GLB exported and verified: ${v.meshes} meshes, ${(r.glb.byteLength / 1024).toFixed(0)} KB.`) }
    catch (e) { toast(`Export failed: ${(e as Error).message}`, 'error') } finally { setBusy(false) }
  }
  const importModel = async (f: File) => {
    try {
      const url = await readFile(f); const buf = await (await fetch(url)).arrayBuffer()
      const v = await validateGLB(buf); if (!v.meshes) throw new Error('No meshes found in this GLB.')
      const assetId = addAsset({ name: f.name, mime: 'model/gltf-binary', url })
      const part: Part = { id: uid('g'), name: f.name.replace(/\.glb$/i, ''), parentId: null, kind: 'gltf', params: { assetId }, position: [0, 0, 0], rotation: [0, 0, 0], scale: [100, 100, 100], material: mat('plastic'), visible: true }
      addParts([part], part.id); toast(`Imported ${f.name} (${v.meshes} meshes, converted from metres to centimetres).`)
    } catch (e) { toast(`Could not import: ${(e as Error).message}`, 'error') }
  }

  return (
    <>
      <Section title="Project">
        <label className="field"><span>Project name</span><input value={p.name} onChange={(e) => setMeta({ name: e.target.value })} /></label>
        <label className="field"><span>Model name</span><input value={p.modelName} onChange={(e) => setMeta({ modelName: e.target.value })} /></label>
        <label className="field"><span>What are you designing?</span>
          <select value={p.modelType} onChange={(e) => setMeta({ modelType: e.target.value as ModelType })}>{MODEL_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="field"><span>Short description</span><textarea rows={3} value={p.description} onChange={(e) => setMeta({ description: e.target.value })} /></label>
        <div className="field"><span>Approximate real size</span>
          <div className="row3">
            <Num label="W" unit="cm" value={p.dimensions.width} onChange={(v) => setMeta({ dimensions: { ...p.dimensions, width: v } })} />
            <Num label="H" unit="cm" value={p.dimensions.height} onChange={(v) => setMeta({ dimensions: { ...p.dimensions, height: v } })} />
            <Num label="D" unit="cm" value={p.dimensions.depth} onChange={(v) => setMeta({ dimensions: { ...p.dimensions, depth: v } })} />
          </div>
        </div>
      </Section>
      <Section title="Save & restore" hint="Your work autosaves in this browser. Browser storage can be cleared, so download a project file as a backup.">
        <div className="btns">
          <button className="btn" onClick={saveVersion} data-testid="save-version"><Save size={14} />Save version</button>
          <button className="btn" onClick={restore}><RotateCcw size={14} />Restore saved</button>
          <button className="btn" onClick={exportProject} data-testid="export-project"><FileDown size={14} />Download project file</button>
          <button className="btn" onClick={() => projIn.current?.click()}><FileUp size={14} />Open project file</button>
        </div>
        <input ref={projIn} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importProject(f); e.target.value = '' }} data-testid="project-input" />
        {savedAt && <p className="hint">Last saved version: {new Date(savedAt).toLocaleString()}</p>}
      </Section>
      <Section title="3D model files" hint="GLB is the standard 3D format websites use. Exports are checked by re-loading them.">
        <div className="btns">
          <button className="btn" onClick={exportModel} disabled={busy} data-testid="export-glb"><FileDown size={14} />Export GLB</button>
          <button className="btn" onClick={() => glbIn.current?.click()}><Upload size={14} />Import GLB</button>
        </div>
        <input ref={glbIn} type="file" accept=".glb,model/gltf-binary" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importModel(f); e.target.value = '' }} data-testid="glb-input" />
      </Section>
      {confirmed && <Section title="Last confirmed model"><p className="hint">Version {confirmed.version}, confirmed {new Date(confirmed.at).toLocaleString()}.</p></Section>}
    </>
  )
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'

// ---------------- Import ----------------
const LABELS: RefLabel[] = ['concept', 'front', 'side', 'back', 'top', 'other']
function ImportPanel() {
  const p = useStudio((s) => s.project)
  const showRefs = useStudio((s) => s.showRefs)
  const { addAsset, addReference, removeReference, setReferenceLabel, set, toast } = useStudio.getState()
  const inp = useRef<HTMLInputElement>(null)
  const upload = async (files: FileList) => {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) { toast(`${f.name} is not an image.`, 'warn'); continue }
      const url = await compressImage(await readFile(f), 1600)
      const id = addAsset({ name: f.name, mime: f.type, url })
      const guess: RefLabel = /front/i.test(f.name) ? 'front' : /side/i.test(f.name) ? 'side' : /back/i.test(f.name) ? 'back' : /top/i.test(f.name) ? 'top' : 'concept'
      addReference(id, guess)
    }
    set({ showRefs: true }); toast('Reference image added. Label it front, side or back.')
  }
  return (
    <>
      <Section title="Concept references" hint="Upload your Mission 1 concept image(s). They stay visible beside the 3D model while you work.">
        <div className="drop" onClick={() => inp.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files) }}>
          <ImagePlus size={22} /><span>Drop images or <b>browse</b></span>
        </div>
        <input ref={inp} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = '' }} data-testid="ref-input" />
        <label className="check"><input type="checkbox" checked={showRefs} onChange={(e) => set({ showRefs: e.target.checked })} />Show references in the workspace</label>
        <div className="refs">
          {p.references.map((r) => (
            <div key={r.id} className="ref">
              <img src={p.assets[r.assetId]?.url} alt={r.label} />
              <select value={r.label} onChange={(e) => setReferenceLabel(r.id, e.target.value as RefLabel)} aria-label="View label">{LABELS.map((l) => <option key={l}>{l}</option>)}</select>
              <button className="icon" onClick={() => removeReference(r.id)} aria-label="Remove reference"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Reference image vs. 3D model">
        <div className="callout"><Info size={15} /><div>
          <p><b>A picture is not a 3D model.</b> This studio does not turn a 2D image into 3D automatically. Your editable model is made of real 3D parts you can select and change.</p>
          <p className="hint" style={{ marginTop: 6 }}><b>How this model was made:</b> {p.origin}</p>
        </div></div>
      </Section>
    </>
  )
}

// ---------------- Templates ----------------
function TemplatesPanel({ onDone }: { onDone: () => void }) {
  const { load, toast } = useStudio.getState()
  const [pending, setPending] = useState<string | null>(null)
  return (
    <Section title="Start from a template" hint="Every template is made of editable parts. Starting one replaces the current project, so save or download your work first.">
      <div className="tpl-grid">
        {TEMPLATES.map((t) => (
          <div key={t.id} className={`tpl ${t.id === 'organizer' ? 'tpl-main' : ''}`}>
            <b>{t.label}</b><span>{t.blurb}</span>
            {pending === t.id
              ? <div className="btns"><button className="btn primary sm" onClick={() => { load(t.make()); setPending(null); toast(`Started “${t.label}”.`); onDone() }} data-testid={`tpl-confirm-${t.id}`}>Replace current</button><button className="btn sm" onClick={() => setPending(null)}>Cancel</button></div>
              : <button className="btn sm" onClick={() => setPending(t.id)} data-testid={`tpl-${t.id}`}>Use template</button>}
          </div>
        ))}
      </div>
    </Section>
  )
}

// ---------------- Objects (scene hierarchy) ----------------
const ADDABLE: [PartKind, string, Record<string, unknown>][] = [
  ['roundedBox', 'Rounded box', { w: 4, h: 4, d: 4, r: 0.4 }], ['box', 'Box', { w: 4, h: 4, d: 4 }], ['cylinder', 'Cylinder', { rt: 2, rb: 2, h: 4 }],
  ['sphere', 'Sphere', { r: 2 }], ['torus', 'Ring', { R: 2, r: 0.4 }], ['cone', 'Cone', { r: 2, h: 4 }], ['capsule', 'Capsule', { r: 1, len: 3 }], ['gem', 'Gem', { r: 1.5 }],
]
function ObjectsPanel() {
  const parts = useStudio((s) => s.project.parts)
  const selected = useStudio((s) => s.selectedId)
  const { select, updatePart, removePart, duplicatePart, addParts } = useStudio.getState()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState(false)
  const children = (pid: string | null) => parts.filter((p) => (p.parentId ?? null) === pid || (pid === null && p.parentId && !parts.some((x) => x.id === p.parentId)))
  const isOpen = (id: string, depth: number) => (open[id] ?? (depth < 1 || id === selected)) || ancestorsOf(parts, selected).has(id)

  const row = (p: Part, depth: number): React.ReactNode => {
    const kids = children(p.id)
    return (
      <li key={p.id}>
        <div className={`node ${selected === p.id ? 'sel' : ''} ${p.visible ? '' : 'hidden'}`} style={{ paddingLeft: 6 + depth * 14 }} onClick={() => select(p.id)} data-testid={`node-${p.name}`}>
          {kids.length ? <button className="icon tw" onClick={(e) => { e.stopPropagation(); setOpen({ ...open, [p.id]: !isOpen(p.id, depth) }) }} aria-label="Expand">{isOpen(p.id, depth) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button> : <span className="tw" />}
          <span className="nm">{p.name}</span>
          {p.note && <span className="dot" title="Has a feature note" />}
          <button className="icon vis" onClick={(e) => { e.stopPropagation(); updatePart(p.id, { visible: !p.visible }) }} aria-label={p.visible ? 'Hide' : 'Show'}>{p.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
        </div>
        {kids.length > 0 && isOpen(p.id, depth) && <ul>{kids.map((k) => row(k, depth + 1))}</ul>}
      </li>
    )
  }
  const add = (kind: PartKind, label: string, params: Record<string, unknown>) => {
    const part: Part = { id: uid('n'), name: label, parentId: null, kind, params, position: [0, 6, 0], rotation: [0, 0, 0], scale: [1, 1, 1], material: mat('plastic'), visible: true }
    addParts([part], part.id); setAdding(false)
  }
  return (
    <Section title={`Scene objects (${parts.length})`} hint="Click a part to select it. Groups (▸) move together." right={
      <div className="btns tight">
        <button className="icon" title="Add a shape" onClick={() => setAdding(!adding)} data-testid="add-shape"><Plus size={15} /></button>
        <button className="icon" title="Duplicate (Ctrl+D)" disabled={!selected} onClick={() => selected && duplicatePart(selected)}><Copy size={14} /></button>
        <button className="icon" title="Delete (Del)" disabled={!selected} onClick={() => selected && removePart(selected)}><Trash2 size={14} /></button>
      </div>}>
      {adding && <div className="add-grid">{ADDABLE.map(([k, l, pr]) => <button key={l} className="btn sm" onClick={() => add(k, l, pr)} data-testid={`add-${k}`}><Box size={12} />{l}</button>)}</div>}
      <ul className="tree">{children(null).map((p) => row(p, 0))}</ul>
    </Section>
  )
}
function ancestorsOf(parts: Part[], id: string | null) {
  const out = new Set<string>(); let cur = id ? parts.find((p) => p.id === id) : undefined
  while (cur?.parentId) { out.add(cur.parentId); cur = parts.find((p) => p.id === cur!.parentId) }
  return out
}
