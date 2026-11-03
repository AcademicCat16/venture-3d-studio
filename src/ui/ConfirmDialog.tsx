import { useEffect, useState } from 'react'
import { BadgeCheck, CircleAlert, Download, Loader2, X } from 'lucide-react'
import { useStudio } from '../state/store.ts'
import { HANDOFF_NAME, buildHandoff, download } from '../export/exporter.ts'
import { KEYS, idbGet, idbSet } from '../state/persist.ts'
import type { ConfirmedRecord } from '../state/persist.ts'

type Manifest = Awaited<ReturnType<typeof buildHandoff>>['manifest']
const STAGES = ['Check the scene', 'Export the 3D model (GLB)', 'Re-load and verify the GLB', 'Capture a preview image', 'Package the handoff ZIP']

export default function ConfirmDialog({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ zip: Uint8Array; manifest: Manifest } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const st = useStudio.getState()
      try {
        if (!st.capture) throw new Error('The 3D view is not ready yet. Wait a moment and try again.')
        const prev = await idbGet<ConfirmedRecord>(KEYS.confirmed).catch(() => undefined)
        const version = (prev?.version ?? 0) + 1
        const out = await buildHandoff(st.project, st.capture, version, (i) => alive && setStage(i))
        if (!alive) return
        await idbSet(KEYS.confirmed, { project: st.project, version, confirmedAt: out.manifest.confirmedAt, sha256: out.glbHash } satisfies ConfirmedRecord)
        st.set({ confirmed: { version, at: out.manifest.confirmedAt } }); st.mark('confirmed')
        setStage(5); setResult(out)
      } catch (e) { if (alive) setError((e as Error).message) }
    })()
    return () => { alive = false }
  }, [])

  const m = result?.manifest
  return (
    <div className="modal-bg" role="dialog" aria-label="Confirm model">
      <div className="modal">
        <button className="icon close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <h2><BadgeCheck size={20} /> Confirm Model</h2>
        <ol className="stages">
          {STAGES.map((s, i) => (
            <li key={s} className={error && i === Math.min(stage, 4) ? 'err' : stage > i ? 'done' : stage === i ? 'run' : ''}>
              {error && i === Math.min(stage, 4) ? <CircleAlert size={15} /> : stage > i ? <BadgeCheck size={15} /> : stage === i ? <Loader2 size={15} className="spin" /> : <span className="pending" />}{s}
            </li>
          ))}
        </ol>
        {error && <div className="callout err" data-testid="confirm-error"><CircleAlert size={16} /><div><b>Not confirmed.</b> {error}</div></div>}
        {result && m && (
          <>
            <div className="callout ok" data-testid="confirm-ok">
              <BadgeCheck size={16} />
              <div><b>Model confirmed (version {m.confirmationVersion}).</b> {m.stats.validatedMeshes} meshes · {m.dimensions.measured.width} × {m.dimensions.measured.height} × {m.dimensions.measured.depth} cm · {m.hotspots.length} feature notes · model {(m.integrity.model.bytes / 1024).toFixed(0)} KB</div>
            </div>
            <button className="btn primary big" onClick={() => download(result.zip as Uint8Array<ArrayBuffer>, HANDOFF_NAME, 'application/zip')} data-testid="download-handoff"><Download size={17} />Download {HANDOFF_NAME}</button>
            <p className="hint">Keep the ZIP intact for Mission 3. It contains model.glb, model-manifest.json, project.json, preview.png and README.txt. Your website was not changed.</p>
            <p className="hint mono">model.glb SHA-256: {m.integrity.model.sha256}</p>
          </>
        )}
      </div>
    </div>
  )
}
