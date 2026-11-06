import { useEffect, useState } from 'react'

// Minimal hash router: works on GitHub Pages without server rewrites.
export function currentPath() {
  const h = window.location.hash.replace(/^#/, '')
  return h.startsWith('/') ? h : '/'
}

let guard = null // (to) => boolean; return false to block navigation
export function setNavigationGuard(fn) { guard = fn }

// Last path the app accepted. The browser Back/Forward buttons change the hash
// before we hear about it, so a blocked change is undone by restoring this path.
let accepted = currentPath()

export function navigate(to) {
  if (guard && guard(to) === false) return
  if (currentPath() === to) return
  window.location.hash = to
}

// Change the URL without a route change (e.g. a new plan gets its saved id).
export function replacePath(to) {
  accepted = to
  try { window.history.replaceState(null, '', `#${to}`) } catch { /* ignore */ }
}

export function useRoute() {
  const [path, setPath] = useState(currentPath())
  useEffect(() => {
    const on = () => {
      const next = currentPath()
      if (next !== accepted && guard && guard(next) === false) {
        // Put the editor's URL back; the guard has opened its unsaved-changes dialog.
        try { window.history.pushState(null, '', `#${accepted}`) } catch { /* ignore */ }
        return
      }
      accepted = next
      setPath(next)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return path
}

// Match "/trends/:id" style patterns.
export function match(pattern, path) {
  const p = pattern.split('/'), a = path.split('?')[0].split('/')
  if (p.length !== a.length) return null
  const params = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i])
    else if (p[i] !== a[i]) return null
  }
  return params
}

export function query(path = currentPath()) {
  const q = path.split('?')[1] || ''
  return new URLSearchParams(q)
}
