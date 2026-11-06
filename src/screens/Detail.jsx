import { FitTag, Link, SampleTag, VideoBadge } from '../components/ui.jsx'
import { STAGES, trendById, trendMeta } from '../lib/data.js'
import { navigate } from '../lib/router.js'
import { activeCreator, useStore } from '../lib/store.js'

export default function Detail({ id }) {
  const profile = useStore((s) => s.profile)
  const t = trendById(id)
  const c = activeCreator(profile)
  if (!t) return <div className="stack"><h1>Trend not found</h1><Link to="/trends">Back to trends</Link></div>
  const fit = t.fit[c.id]
  const n = STAGES.indexOf(t.stage)
  const who = c.isCustom ? 'you' : c.name

  return (
    <>
      <header className="page-head">
        <Link to="/trends" className="back">← Trends</Link>
        <div className="row tags"><SampleTag />{t.media === 'video' && <VideoBadge label="Video trend" />}<span className="meta">TikTok · {t.format}</span></div>
        <h1>{t.title}</h1>
        <p className="lede" style={{ maxWidth: '60ch' }}>{t.summary}</p>
      </header>

      <div className="detail">
        <div className="stack">
          <section className="card stack" aria-labelledby="why">
            <h2 id="why" className="t-h3">Why it works</h2>
            <p>{t.whyItWorks}</p>
            <h3 className="label">What to keep if you use it</h3>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{t.keep.map((k) => <li key={k}>{k}</li>)}</ul>
          </section>
          <section className="card stack" aria-labelledby="ex">
            <h2 id="ex" className="t-h3">Examples</h2>
            <p className="small muted">{t.media === 'video' ? 'Described video examples of the format, not real posts.' : 'Described examples of the format, not real posts.'}</p>
            <ul className="examples" style={{ listStyle: 'none', padding: 0, margin: 0 }}>{t.examples.map((e) => <li key={e} className="example">{t.media === 'video' && <VideoBadge />}<span>{e}</span></li>)}</ul>
          </section>
          <section className="card stack" aria-labelledby="sig">
            <h2 id="sig" className="t-h3">Signals and limits</h2>
            <table className="signals">
              <caption className="sr-only">Illustrative signals for {t.title}</caption>
              <tbody>{t.signals.map((s) => <tr key={s.label}><th scope="row">{s.label}</th><td>{s.value}</td></tr>)}</tbody>
            </table>
            <p className="small muted">{t.limits} Signals are illustrative; no observation period was measured.</p>
          </section>
        </div>

        <aside aria-label="Fit and timing">
          <section className="card fit-first" aria-labelledby="fit">
            <div className="row"><h2 id="fit" className="t-h3">Fit for {who}</h2><span className="spacer" /><FitTag level={fit.level} /></div>
            <ul style={{ margin: '10px 0 0', paddingLeft: 20 }}>{fit.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            {fit.unknowns.length > 0 && <>
              <p className="label" style={{ marginTop: 'var(--s-4)' }}>Not known yet</p>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>{fit.unknowns.map((u) => <li key={u}>{u}</li>)}</ul>
            </>}
          </section>
          <section className="card" aria-labelledby="timing">
            <h2 id="timing" className="t-h3">Timing</h2>
            <div className="stage-scale" role="img" aria-label={`Stage ${n + 1} of 4: ${t.stage}`}>
              {STAGES.map((s, i) => <div key={s} className={`${i <= n ? 'on' : ''} ${i === n ? 'current' : ''}`}>{s[0].toUpperCase() + s.slice(1)}</div>)}
            </div>
            <p className="small" style={{ marginTop: 10 }}>{trendMeta.stages[t.stage]}</p>
          </section>
          <section className="card accent generate-box" aria-labelledby="gen">
            <h2 id="gen" className="sr-only">Generate a production plan</h2>
            {fit.level === 'weak' && <p className="notice" style={{ marginBottom: 10 }}>Weak fit: {fit.reasons[0]}. You can still make a plan.</p>}
            <p className="small muted">Plan will use: {c.niche} · {c.audience.toLowerCase()} · {c.goal.toLowerCase()} · <Link to="/start?edit=1">Edit</Link></p>
            <button type="button" className="btn primary block" style={{ marginTop: 10 }} onClick={() => navigate(`/plan/new/${t.id}`)}>Generate production plan</button>
          </section>
        </aside>
      </div>
    </>
  )
}
