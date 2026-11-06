import { useState } from 'react'
import { Logo } from '../components/ui.jsx'
import { creators, creatorById, nearestCreatorId } from '../lib/data.js'
import { navigate, query } from '../lib/router.js'
import { AI_MODELS, chooseSampleCreator, saveCustomProfile, useStore } from '../lib/store.js'

const GOALS = ['Get saves', 'Get comments', 'Get followers']

// An idea typed on the landing prompt carries through setup to the matching trends.
const nextPath = () => { const q = query().get('q'); return q ? `/trends?q=${encodeURIComponent(q)}` : '/home' }

export default function Profile() {
  const profile = useStore((s) => s.profile)
  const account = useStore((s) => s.account)
  const custom = profile?.kind === 'custom' ? profile : {}
  const [f, setF] = useState({ niche: custom.niche || '', audience: custom.audience || '', goal: custom.goal || GOALS[0], resources: custom.resources || '' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    if (!f.niche.trim()) { setError('Add your niche, or pick a sample creator above.'); document.getElementById('p-niche').focus(); return }
    saveCustomProfile(f)
    navigate(nextPath())
  }

  return (
    <>
      <header className="appbar"><div className="wrap"><Logo /><span className="spacer" /><span className="small muted">Set up · 1 step</span></div></header>
      <div className="signal-rule" aria-hidden="true" />
      <main id="main" tabIndex={-1}>
        <div className="wrap" style={{ maxWidth: 720 }}>
          <header className="page-head" style={{ marginTop: 'var(--s-6)' }}>
            <h1>Who are you making videos for?</h1>
            <p className="sub">Four quick answers shape which trends fit and what your plan says. You can change them later.</p>
          </header>

          <section className="card" aria-labelledby="fast">
            <h2 id="fast" className="t-h3">Fastest: start as a sample creator</h2>
            <div className="creator-cards" style={{ marginTop: 14 }}>
              {creators.map((c) => (
                <button key={c.id} type="button" className="creator-card" onClick={() => { chooseSampleCreator(c.id); navigate(nextPath()) }}>
                  <span className="sample">Sample creator</span>
                  <strong className="t-h3">{c.name} · {c.niche}</strong>
                  <span className="small muted">{c.audience}</span>
                  <span className="small">Goal: {c.goal}</span>
                </button>
              ))}
            </div>
          </section>

          <form onSubmit={submit} className="card stack" style={{ marginTop: 'var(--s-4)' }} noValidate aria-labelledby="own">
            <h2 id="own" className="t-h3">Or describe yourself</h2>
            <div className="field">
              <label htmlFor="p-niche">Your niche <span className="hint">(required)</span></label>
              <input id="p-niche" value={f.niche} onChange={(e) => { set('niche')(e); if (error && e.target.value.trim()) setError('') }} placeholder="e.g. budget cooking" aria-required="true" aria-describedby={error ? 'p-err' : undefined} aria-invalid={error ? 'true' : undefined} />
              {error && <p id="p-err" className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
            </div>
            <div className="field">
              <label htmlFor="p-aud">Who watches</label>
              <input id="p-aud" value={f.audience} onChange={set('audience')} placeholder="e.g. college students" />
            </div>
            <div className="field">
              <label htmlFor="p-goal">Goal for your next video</label>
              <select id="p-goal" value={f.goal} onChange={set('goal')}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select>
            </div>
            <div className="field">
              <label htmlFor="p-res">What you can film with</label>
              <textarea id="p-res" rows={2} value={f.resources} onChange={set('resources')} placeholder="Phone, one pan, about an hour a day" aria-describedby="p-res-hint" />
              <p className="hint" id="p-res-hint">Separate items with commas.</p>
            </div>
            <p className="small muted">{account?.provider ? `Signed in with ${account.provider === 'tiktok' ? 'TikTok' : 'Instagram'} (simulated)` : 'Not signed in'} · AI assistant: {account?.ai ? AI_MODELS[account.ai].name : 'not chosen'} · <a href="#/signup">{account?.provider ? 'Change AI assistant' : 'Sign up'}</a></p>
            <p className="notice info">In this demo, plans are pre-written for two sample creators. Your answers pick the closest one ({f.niche ? creatorById(nearestCreatorId(f)).name : 'Maya or Jordan'}), and the plan will say so.</p>
            <div className="row"><button className="btn primary" type="submit">Continue</button></div>
          </form>
        </div>
      </main>
    </>
  )
}
