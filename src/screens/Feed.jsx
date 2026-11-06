import { useState } from 'react'
import { FitTag, Link, SampleTag, StageTag, VideoBadge } from '../components/ui.jsx'
import { FIT_LABEL, FIT_ORDER, STAGES, formats, trends, trendMeta } from '../lib/data.js'
import { activeCreator, setFilters, useStore } from '../lib/store.js'
import { navigate, query, useRoute } from '../lib/router.js'

// Idea match from the landing prompt (D4.11): count query words found in a trend's keywords and text.
const words = (s) => s.toLowerCase().match(/[a-z']{3,}/g) || []
const score = (t, q) => { const hay = `${t.keywords || ''} ${t.title} ${t.summary}`.toLowerCase(); return words(q).filter((w) => hay.includes(w.replace(/'s$/, ''))).length }

const EMPTY = { fit: [], stage: [], format: [] }

export default function Feed() {
  const profile = useStore((s) => s.profile)
  const stored = useStore((s) => s.filters)
  const f = stored || EMPTY
  const [open, setOpen] = useState(false)
  const c = activeCreator(profile)

  const toggle = (group, value) => {
    const cur = f[group]
    setFilters({ ...f, [group]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] })
  }
  const clear = () => setFilters(EMPTY)
  const count = f.fit.length + f.stage.length + f.format.length

  const path = useRoute()
  const q = query(path).get('q') || ''
  const list = trends
    .filter((t) => (!f.fit.length || f.fit.includes(t.fit[c.id].level)) && (!f.stage.length || f.stage.includes(t.stage)) && (!f.format.length || f.format.includes(t.format)))
    .sort((a, b) => (q ? score(b, q) - score(a, q) : 0) || FIT_ORDER[a.fit[c.id].level] - FIT_ORDER[b.fit[c.id].level])

  const group = (name, legend, options, labels) => (
    <fieldset>
      <legend className="label">{legend}</legend>
      {options.map((o) => (
        <label key={o} className="check">
          <input type="checkbox" checked={f[name].includes(o)} onChange={() => toggle(name, o)} />
          {labels ? labels[o] : o[0].toUpperCase() + o.slice(1)}
        </label>
      ))}
    </fieldset>
  )

  return (
    <>
      <header className="page-head">
        <h1>Trends</h1>
        <p className="sub">{trends.length} illustrative sample trends for TikTok, sorted by fit for {c.isCustom ? 'you' : c.name}.</p>
      </header>
      {q && (
        <p className="notice info idea-banner" role="status">Sample matches for “{q}”, best first. Matching uses keywords on the sample trends, not live AI. <button type="button" className="btn sm quiet" onClick={() => navigate('/trends')}>Clear idea</button></p>
      )}
      <div className="row">
        <button type="button" className="btn sm filters-toggle" aria-expanded={open} aria-controls="filters" onClick={() => setOpen(!open)}>Filters{count ? ` (${count})` : ''}</button>
        {count > 0 && <button type="button" className="btn sm quiet" onClick={clear}>Clear filters</button>}
        <span className="small muted" aria-live="polite">{list.length} of {trends.length} shown</span>
      </div>
      <div className="feed">
        <aside id="filters" className={`card filters ${open ? 'open' : ''}`} aria-label="Filters">
          {group('fit', `Fit for ${c.isCustom ? 'you' : c.name}`, ['strong', 'possible', 'weak'], FIT_LABEL)}
          {group('stage', 'Stage', STAGES)}
          {group('format', 'Format', formats)}
        </aside>
        <div>
          {list.length === 0 ? (
            <div className="card stack" role="status">
              <h2>No trends match these filters</h2>
              <p className="muted">Try removing a filter. There are {trends.length} sample trends in total.</p>
              <div><button type="button" className="btn primary sm" onClick={clear}>Clear filters</button></div>
            </div>
          ) : (
            <ul className="trend-grid" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {list.map((t, i) => (
                <li key={t.id} className="card trend-card enter" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="format-art">{t.media === 'video' && <VideoBadge />}<span aria-hidden="true">{t.format}</span></div>
                  <div className="row"><SampleTag id={`s-${t.id}`} /><span className="spacer" /><FitTag id={`f-${t.id}`} level={t.fit[c.id].level} /></div>
                  <h2 className="t-h3"><Link to={`/trends/${t.id}`} aria-describedby={`s-${t.id} f-${t.id}`}>{t.title}</Link></h2>
                  <p className="small muted">{t.summary}</p>
                  <div className="card-foot"><StageTag stage={t.stage} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
