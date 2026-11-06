import { useSyncExternalStore } from 'react'
import { creatorById, nearestCreatorId } from './data.js'

// Browser-only storage (D12). Every access is guarded: private windows and
// blocked storage must not break the demo.
const KEY = 'showstop-demo-v1'
let storageOk = true
function read() {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { storageOk = false; return {} }
}
function write(state) {
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; return true }
  catch { storageOk = false; return false }
}

let state = { profile: null, saved: [], filters: null, account: null, ...read() }
const listeners = new Set()
function emit() { listeners.forEach((l) => l()) }
function set(patch, persist = true) {
  state = { ...state, ...patch }
  const ok = persist ? write({ profile: state.profile, saved: state.saved, account: state.account }) : true
  emit()
  return ok
}

export function useStore(selector) {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l) },
    () => selector(state),
  )
}
export const getState = () => state
export const isStorageOk = () => storageOk

// Profile -------------------------------------------------------------
export function chooseSampleCreator(id) {
  return set({ profile: { kind: 'sample', creatorId: id } })
}
export function saveCustomProfile(fields) {
  const creatorId = nearestCreatorId(fields)
  return set({ profile: { kind: 'custom', creatorId, ...fields } })
}
// Effective creator data: custom fields override the sample persona's labels.
export function activeCreator(profile = state.profile) {
  if (!profile) return null
  const base = creatorById(profile.creatorId)
  if (profile.kind !== 'custom') return { ...base, isCustom: false }
  return {
    ...base,
    isCustom: true,
    name: 'You',
    niche: profile.niche || base.niche,
    audience: profile.audience || base.audience,
    goal: profile.goal || base.goal,
    resources: profile.resources ? profile.resources.split(/\n|,/).map((s) => s.trim()).filter(Boolean) : base.resources,
  }
}

// Filters (kept in memory so "back to trends" restores them) ------------
export function setFilters(filters) { set({ filters }, false) }

// Saved plans ----------------------------------------------------------
export function savePlan(plan) {
  const now = new Date().toISOString()
  const exists = state.saved.find((p) => p.id === plan.id)
  const next = exists
    ? state.saved.map((p) => (p.id === plan.id ? { ...plan, updatedAt: now } : p))
    : [{ ...plan, savedAt: now, updatedAt: now }, ...state.saved]
  return set({ saved: next })
}
export function deletePlan(id) {
  return set({ saved: state.saved.filter((p) => p.id !== id) })
}
export const savedById = (id) => state.saved.find((p) => p.id === id)

// Account (D17). Sign-in is simulated in the demo: no data leaves the browser.
export const AI_MODELS = { chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/' }, claude: { name: 'Claude', url: 'https://claude.ai/new' } }
export function signIn(provider) { return set({ account: { provider, ai: state.account?.ai || null, at: new Date().toISOString() } }) }
export function setAiModel(ai) { return set({ account: { ...(state.account || { provider: null }), ai } }) }
export function signOut() { return set({ account: null }) }
