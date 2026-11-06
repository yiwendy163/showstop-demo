import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { navigate } from '../lib/router.js'
import { FIT_LABEL, STAGES } from '../lib/data.js'

export function Link({ to, children, ...rest }) {
  return (
    <a href={`#${to}`} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); navigate(to) }} {...rest}>
      {children}
    </a>
  )
}

export function Logo() {
  // Original ShowStop logo: stacked "SHOW —" / "— STOP" on the violet-to-orange badge (D4.17).
  return (
    <Link to="/" className="logo" aria-label="ShowStop home">
      <span className="logo-badge" aria-hidden="true">
        <span className="logo-line">SHOW<i /></span>
        <span className="logo-line"><i />STOP</span>
      </span>
    </Link>
  )
}

export function StageTag({ stage }) {
  const n = STAGES.indexOf(stage)
  return (
    <span className="stage">
      <span className="stagebar" aria-hidden="true">{STAGES.map((s, i) => <span key={s} className={i <= n ? 'on' : ''} />)}</span>
      <span className="sr-only">Stage {n + 1} of {STAGES.length}: </span>{stage[0].toUpperCase() + stage.slice(1)}
    </span>
  )
}

export function FitTag({ level, who, id }) {
  return <span id={id} className={`fit ${level}`}>{FIT_LABEL[level]}{who ? ` · ${who}` : ''}</span>
}

// Marks content that is a video. A label, not a player: the demo has no media files.
export function VideoBadge({ label = 'Video' }) {
  return (
    <span className="video-badge">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M2 1.2v7.6L8.6 5z" fill="currentColor" /></svg>
      {label}
    </span>
  )
}

export function SampleTag({ children = 'Sample trend', id }) {
  return <span id={id} className="sample">{children}</span>
}

// Toasts: announced through a polite live region.
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef()
  const show = useCallback((message, action) => {
    clearTimeout(timer.current)
    setToast({ message, action, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), 5000)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast enter" key={toast.key}>
            <span>{toast.message}</span>
            {toast.action && <button type="button" onClick={() => { toast.action.run(); setToast(null) }}>{toast.action.label}</button>}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  )
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Make everything outside `el` inert (no focus, hidden from screen readers) and
// return a function that restores it. Walks from `el` up to <body>. The toast
// region stays live so "Plan saved" is still announced from inside a dialog.
function inertOutside(el) {
  const changed = []
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    for (const sib of node.parentElement?.children || []) {
      if (sib !== node && !sib.inert && sib.tagName !== 'SCRIPT' && !sib.matches('.toast-region')) { sib.inert = true; changed.push(sib) }
    }
  }
  return () => changed.forEach((n) => { n.inert = false })
}

// Shared modal behaviour for dialogs and the phone bottom sheet:
// focus moves in, Tab stays inside, Escape closes, the background is inert,
// and focus returns to the opener (or `returnTo`) on close.
export function useModal(ref, active, onClose, returnTo) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!active || !ref.current) return
    const el = ref.current
    const prev = returnTo?.current || document.activeElement
    const restore = inertOutside(el)
    const first = el.querySelector('[data-autofocus]') || el.querySelector(FOCUSABLE)
    first?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current() }
      if (e.key === 'Tab') {
        const f = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement)
        if (!f.length) return
        const a = f[0], z = f[f.length - 1]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    el.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('keydown', onKey)
      restore()
      if (prev?.isConnected) prev.focus?.()
    }
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
}

// Accessible modal dialog: see useModal. Mark the safest button with data-autofocus.
export function Dialog({ title, children, onClose, labelledBy = 'dlg-title' }) {
  const ref = useRef()
  useModal(ref, true, onClose)
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={ref}>
        <h2 id={labelledBy}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

// True while the media query matches (e.g. the phone layout).
export function useMedia(q) {
  const get = () => typeof window !== 'undefined' && window.matchMedia(q).matches
  const [m, setM] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on); on()
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

// Textarea that grows with its content.
export function AutoTextarea({ value, onChange, className = 'auto', ...rest }) {
  const ref = useRef()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return <textarea ref={ref} rows={1} className={className} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
}
