import { useState } from 'react'
import { Axis3d, BadgeCheck, Box, Check, CircleHelp, Grid3x3, Image, MapPin, Maximize, Redo2, Undo2, X } from 'lucide-react'
import { useStudio } from '../state/store.ts'
import type { GuideStep } from '../state/store.ts'

const STEPS: [GuideStep, string, string][] = [
  ['explored', 'Explore', 'Drag to orbit, scroll to zoom, right-drag to pan.'],
  ['selected', 'Select a part', 'Click any part of the model.'],
  ['changed', 'Make a change', 'Change a size, colour or material on the right.'],
  ['reviewed', 'Review', 'Check it from the front, side and top views.'],
  ['confirmed', 'Confirm', 'Click Confirm Model and download the ZIP.'],
]

export function TopBar({ onConfirm }: { onConfirm: () => void }) {
  const name = useStudio((s) => s.project.name)
  const guide = useStudio((s) => s.guide)
  const status = useStudio((s) => s.saveStatus)
  const canUndo = useStudio((s) => s.past.length > 0), canRedo = useStudio((s) => s.future.length > 0)
  const { undo, redo } = useStudio.getState()
  return (
    <header className="top">
      <div className="brand"><div className="logo"><Box size={17} /></div><div><b>Venture 3D Studio</b><span>{name}</span></div></div>
      <ol className="guide" aria-label="Guided workflow">
        {STEPS.map(([k, label, tip], i) => <li key={k} className={guide[k] ? 'done' : ''} title={tip}><span className="g-dot">{guide[k] ? <Check size={11} /> : i + 1}</span>{label}</li>)}
      </ol>
      <div className="top-actions">
        <button className="icon" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" data-testid="undo"><Undo2 size={16} /></button>
        <button className="icon" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" data-testid="redo"><Redo2 size={16} /></button>
        <span className={`save-state ${status}`} data-testid="save-state">{status === 'saved' ? 'All changes saved' : status === 'saving' ? 'Saving…' : status === 'error' ? 'Save failed' : 'Unsaved changes'}</span>
        <button className="btn primary" onClick={onConfirm} data-testid="confirm-model"><BadgeCheck size={16} />Confirm Model</button>
      </div>
    </header>
  )
}

export function ViewToolbar() {
  const scene = useStudio((s) => s.project.scene)
  const ortho = useStudio((s) => s.ortho)
  const showRefs = useStudio((s) => s.showRefs), showNotes = useStudio((s) => s.showNotes)
  const { requestView, setOrtho, setScene, set } = useStudio.getState()
  const views = [['iso', 'Isometric'], ['front', 'Front'], ['side', 'Side'], ['top', 'Top'], ['back', 'Back']] as const
  return (
    <div className="vt" role="toolbar" aria-label="View">
      <div className="seg">{views.map(([v, l]) => <button key={v} onClick={() => requestView(v)} data-testid={`view-${v}`}>{l}</button>)}</div>
      <div className="seg">
        <button className={!ortho ? 'on' : ''} onClick={() => setOrtho(false)} title="Perspective view">Persp</button>
        <button className={ortho ? 'on' : ''} onClick={() => setOrtho(true)} title="Orthographic (flat, measured) view" data-testid="ortho">Ortho</button>
      </div>
      <div className="seg">
        <button className={scene.grid ? 'on' : ''} onClick={() => setScene({ grid: !scene.grid })} title="Floor grid (1 cm squares)"><Grid3x3 size={14} /></button>
        <button className={scene.axes ? 'on' : ''} onClick={() => setScene({ axes: !scene.axes })} title="Axes (red X, green Y, blue Z)"><Axis3d size={14} /></button>
        <button className={showNotes ? 'on' : ''} onClick={() => set({ showNotes: !showNotes })} title="Show feature notes" data-testid="toggle-notes"><MapPin size={14} /></button>
        <button className={showRefs ? 'on' : ''} onClick={() => set({ showRefs: !showRefs })} title="Show reference images"><Image size={14} /></button>
        <button onClick={() => requestView('reset')} title="Reset view"><Maximize size={14} /></button>
      </div>
    </div>
  )
}

export function ReferenceStrip() {
  const show = useStudio((s) => s.showRefs)
  const p = useStudio((s) => s.project)
  const [big, setBig] = useState<string | null>(null)
  if (!show || !p.references.length) return null
  return (
    <>
      <div className="ref-strip" aria-label="Reference images">
        <span className="ref-title">Reference</span>
        {p.references.map((r) => <button key={r.id} className="ref-thumb" onClick={() => setBig(r.id)} title="Enlarge"><img src={p.assets[r.assetId]?.url} alt={`${r.label} reference`} /><span>{r.label}</span></button>)}
      </div>
      {big && (() => { const r = p.references.find((x) => x.id === big); return r ? (
        <div className="ref-big" onClick={() => setBig(null)}><img src={p.assets[r.assetId]?.url} alt="" /><span>{r.label} reference image (not part of the 3D model)</span><button className="icon"><X size={16} /></button></div>
      ) : null })()}
    </>
  )
}

export function Onboarding() {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('v3d-onboarded') !== '1' } catch { return true } })
  if (!open) return <button className="help-btn" onClick={() => setOpen(true)} title="How to use the studio"><CircleHelp size={18} /></button>
  const close = () => { setOpen(false); try { localStorage.setItem('v3d-onboarded', '1') } catch { /* ignore */ } }
  return (
    <div className="onboard" role="dialog" aria-label="Welcome">
      <button className="icon close" onClick={close} aria-label="Close" data-testid="onboard-close"><X size={15} /></button>
      <h2>Welcome to your 3D studio</h2>
      <p>Your product is already here as an <b>editable 3D model</b>. Follow the five steps at the top:</p>
      <ol>{STEPS.map(([k, l, t]) => <li key={k}><b>{l}.</b> {t}</li>)}</ol>
      <p className="hint">Shortcuts: W move · E rotate · R resize · Ctrl+Z undo · Del delete · Esc deselect</p>
      <button className="btn primary" onClick={close}>Start exploring</button>
    </div>
  )
}

export function Toasts() {
  const toasts = useStudio((s) => s.toasts)
  return <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}</div>
}
