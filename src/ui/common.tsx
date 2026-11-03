import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export const Section = ({ title, children, right, hint }: { title: string; children: ReactNode; right?: ReactNode; hint?: string }) => (
  <section className="sec">
    <div className="sec-head"><h3>{title}</h3>{right}</div>
    {hint && <p className="hint">{hint}</p>}
    {children}
  </section>
)

/** Number input that commits on blur/Enter (so typing doesn't create dozens of undo steps). */
export function Num({ value, onChange, step = 0.1, label, unit, min, max, testId }: { value: number; onChange: (v: number) => void; step?: number; label?: string; unit?: string; min?: number; max?: number; testId?: string }) {
  const [v, setV] = useState(String(round(value)))
  useEffect(() => setV(String(round(value))), [value])
  const commit = () => { const n = parseFloat(v); if (Number.isFinite(n) && n !== value) onChange(clamp(n, min, max)); else setV(String(round(value))) }
  return (
    <label className="num">
      {label && <span className="num-l">{label}</span>}
      <input type="number" step={step} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} data-testid={testId} />
      {unit && <span className="num-u">{unit}</span>}
    </label>
  )
}

export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, testId }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; testId?: string }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => setV(+e.target.value)} onPointerUp={() => v !== value && onChange(v)} onKeyUp={() => v !== value && onChange(v)} onBlur={() => v !== value && onChange(v)} data-testid={testId} />
      <span className="slider-v">{(+v).toFixed(2)}</span>
    </label>
  )
}

export const round = (x: number, d = 3) => +x.toFixed(d)
const clamp = (x: number, min?: number, max?: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, x))

export function readFile(file: File, as: 'dataUrl' | 'text' = 'dataUrl') {
  return new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); if (as === 'text') r.readAsText(file); else r.readAsDataURL(file) })
}

/** Downscale large uploads so projects stay small enough for browser storage and GitHub Pages. */
export async function compressImage(dataUrl: string, max = 2048): Promise<string> {
  const img = new Image(); img.src = dataUrl; await img.decode()
  const s = Math.min(1, max / Math.max(img.width, img.height))
  if (s === 1 && dataUrl.length < 1_500_000) return dataUrl
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return dataUrl.startsWith('data:image/png') ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88)
}
