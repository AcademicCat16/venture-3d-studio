/** IndexedDB key-value storage for projects (large image assets fit here, unlike localStorage). */
import type { Project } from '../model/types.ts'

const DB = 'venture-3d-studio', STORE = 'kv'
let dbp: Promise<IDBDatabase> | null = null
const open = () => (dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(STORE)
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
}))

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await open()
  return new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(key); q.onsuccess = () => res(q.result as T); q.onerror = () => rej(q.error) })
}
export async function idbSet(key: string, value: unknown) {
  const db = await open()
  return new Promise<void>((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(value, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
}

export interface SavedVersion { project: Project; savedAt: string; label: string }
export interface ConfirmedRecord { project: Project; version: number; confirmedAt: string; sha256: string }

export const KEYS = { current: 'current', saved: 'saved', confirmed: 'confirmed' } as const

export function isProject(x: unknown): x is Project {
  const p = x as Project
  return !!p && p.schema === 'venture-3d-project' && Array.isArray(p.parts) && typeof p.scene === 'object'
}
