import { Link, FitTag, StageTag } from '../components/ui.jsx'
import { PromptBox } from '../components/PromptBox.jsx'
import { FIT_ORDER, trendById, trends } from '../lib/data.js'
import { activeCreator, useStore } from '../lib/store.js'

export default function Home() {
  const profile = useStore((s) => s.profile)
  const saved = useStore((s) => s.saved)
  const c = activeCreator(profile)
  const best = [...trends].sort((a, b) => FIT_ORDER[a.fit[c.id].level] - FIT_ORDER[b.fit[c.id].level]).slice(0, 3)
  const latest = saved[0]
  return (
    <>
      <header className="page-head home-prompt">
        <h1>{c.isCustom ? 'What are you filming next?' : `Hi ${c.name}. What are you filming next?`}</h1>
        <p className="sub">{c.niche} · for {c.audience.toLowerCase()}</p>
        <PromptBox id="home-prompt" label="Describe your next video idea" />
      </header>
      <div className="home-grid">
        <section className="card" aria-labelledby="best">
          <div className="row"><h2 id="best" className="t-h3">Best fits for you</h2><span className="spacer" /><Link to="/trends" className="small">All trends</Link></div>
          <div style={{ marginTop: 'var(--s-2)' }}>
            {best.map((t) => (
              <Link key={t.id} to={`/trends/${t.id}`} className="fit-row">
                <div>
                  <h3 className="t-item">{t.title}</h3>
                  <div className="row small" style={{ marginTop: 4 }}><StageTag stage={t.stage} /><span className="muted">{t.format}</span></div>
                </div>
                <FitTag level={t.fit[c.id].level} />
              </Link>
            ))}
          </div>
        </section>
        <section className="card accent" aria-labelledby="cont">
          <h2 id="cont" className="t-h3">Continue a plan</h2>
          {latest ? (
            <div className="stack" style={{ marginTop: 10 }}>
              <div><strong>{latest.title}</strong><p className="small muted">{trendById(latest.trendId)?.title} · saved {new Date(latest.updatedAt).toLocaleDateString()}</p></div>
              <div className="row"><Link to={`/plan/${latest.id}`} className="btn primary sm">Open plan</Link>{saved.length > 1 && <Link to="/saved" className="small">All {saved.length} plans</Link>}</div>
            </div>
          ) : (
            <div className="stack" style={{ marginTop: 10 }}>
              <p className="muted">No saved plans yet. Pick a trend to make your first one.</p>
              <Link to="/trends" className="btn sm">Browse trends</Link>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
