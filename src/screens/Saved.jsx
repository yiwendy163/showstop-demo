import { useState } from 'react'
import { Dialog, Link, StageTag, useToast } from '../components/ui.jsx'
import { trendById } from '../lib/data.js'
import { toPlainText } from '../lib/plan.js'
import { deletePlan, isStorageOk, useStore } from '../lib/store.js'

export default function Saved() {
  const saved = useStore((s) => s.saved)
  const toast = useToast()
  const [confirm, setConfirm] = useState(null)

  const copy = async (p) => {
    try { await navigator.clipboard.writeText(toPlainText(p)); toast('Copied as text.') }
    catch { toast('Copy was blocked. Open the plan and use Copy plan there.') }
  }

  return (
    <>
      <header className="page-head">
        <h1>Saved plans</h1>
        <p className="sub">Saved in this browser only. Clearing browser data removes them.</p>
      </header>
      {!isStorageOk() && <p className="notice" style={{ marginBottom: 'var(--s-5)' }}>This browser is blocking storage, so plans can't be kept after you close the tab. Use Copy plan to keep them.</p>}
      {saved.length === 0 ? (
        <div className="card stack">
          <p>No saved plans yet. Pick a trend to make your first one.</p>
          <div><Link to="/trends" className="btn primary sm">Browse trends</Link></div>
        </div>
      ) : (
        <ul className="saved-list" style={{ listStyle: 'none', padding: 0 }}>
          {saved.map((p) => {
            const t = trendById(p.trendId)
            const done = Object.values(p.done || {}).filter(Boolean).length
            return (
              <li key={p.id} className="card saved-item">
                <div style={{ flex: '1 1 260px' }}>
                  <h2 className="t-h3"><Link to={`/plan/${p.id}`}>{p.title}</Link></h2>
                  <div className="meta" style={{ marginTop: 'var(--s-1)' }}><StageTag stage={t.stage} /><span>{t.title}</span><span>Updated {new Date(p.updatedAt).toLocaleString()}</span>{done > 0 && <span>{done} items done</span>}</div>
                </div>
                <div className="row">
                  <Link to={`/plan/${p.id}`} className="btn primary sm">Open</Link>
                  <button type="button" className="btn sm" onClick={() => copy(p)} aria-label={`Copy ${p.title}`}>Copy</button>
                  <button type="button" className="btn sm quiet" onClick={() => setConfirm(p)} aria-label={`Delete ${p.title}`}>Delete</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {confirm && (
        <Dialog title="Delete this plan?" onClose={() => setConfirm(null)}>
          <p className="muted">“{confirm.title}” will be removed from this browser. This can't be undone.</p>
          <div className="row" style={{ marginTop: 16 }}>
            <button type="button" className="btn primary" onClick={() => { deletePlan(confirm.id); setConfirm(null); toast('Plan deleted.') }}>Delete</button>
            <button type="button" className="btn" data-autofocus onClick={() => setConfirm(null)}>Keep it</button>
          </div>
        </Dialog>
      )}
    </>
  )
}
