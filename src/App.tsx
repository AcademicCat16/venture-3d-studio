import { useEffect, useState } from 'react'
import { useStudio } from './state/store.ts'
import { KEYS, idbGet, idbSet, isProject } from './state/persist.ts'
import type { ConfirmedRecord, SavedVersion } from './state/persist.ts'
import { organizerProject } from './model/organizer.ts'
import type { Project } from './model/types.ts'
import Viewport from './ui/Viewport.tsx'
import LeftPanel from './ui/LeftPanel.tsx'
import Inspector from './ui/Inspector.tsx'
import ConfirmDialog from './ui/ConfirmDialog.tsx'
import { Onboarding, ReferenceStrip, Toasts, TopBar, ViewToolbar } from './ui/Chrome.tsx'

export default function App() {
  const ready = useStudio((s) => !!s.project)
  const [confirming, setConfirming] = useState(false)

  // exposed for automated tests and debugging (read-only use)
  useEffect(() => { (window as unknown as { __studio: typeof useStudio }).__studio = useStudio }, [])

  // restore the most recent work, or start from the Codex-built model
  useEffect(() => {
    ;(async () => {
      const st = useStudio.getState()
      try {
        const [cur, saved, conf] = await Promise.all([idbGet<Project>(KEYS.current), idbGet<SavedVersion>(KEYS.saved), idbGet<ConfirmedRecord>(KEYS.confirmed)])
        if (isProject(cur)) { st.load(cur); st.set({ saveStatus: 'saved' }); st.toast('Restored your most recent work.') } else st.load(organizerProject())
        st.set({ savedAt: saved?.savedAt ?? null, confirmed: conf ? { version: conf.version, at: conf.confirmedAt } : null })
      } catch { st.load(organizerProject()); st.toast('Browser storage is unavailable: download a project file to keep your work.', 'warn') }
    })()
  }, [])

  // autosave (debounced) to IndexedDB
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    return useStudio.subscribe((s, prev) => {
      if (s.project === prev.project || !s.project) return
      clearTimeout(t)
      t = setTimeout(async () => {
        useStudio.setState({ saveStatus: 'saving' })
        try { await idbSet(KEYS.current, useStudio.getState().project); useStudio.setState({ saveStatus: 'saved' }) } catch { useStudio.setState({ saveStatus: 'error' }) }
      }, 700)
    })
  }, [])

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      const s = useStudio.getState(), mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo() }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo() }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); if (s.selectedId) s.duplicatePart(s.selectedId) }
      else if (mod) return
      else if (e.key === 'w') s.setMode('translate')
      else if (e.key === 'e') s.setMode('rotate')
      else if (e.key === 'r') s.setMode('scale')
      else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId) s.removePart(s.selectedId)
      else if (e.key === 'Escape') s.select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!ready) return <div className="loading">Loading your studio…</div>
  return (
    <div className="app">
      <TopBar onConfirm={() => setConfirming(true)} />
      <LeftPanel />
      <main className="stage">
        <Viewport />
        <ViewToolbar />
        <ReferenceStrip />
        <Onboarding />
      </main>
      <Inspector />
      <Toasts />
      {confirming && <ConfirmDialog onClose={() => setConfirming(false)} />}
    </div>
  )
}
