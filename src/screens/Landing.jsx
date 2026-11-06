import { useEffect, useRef, useState } from 'react'
import { Link, Logo, StageTag, FitTag, SampleTag, VideoBadge } from '../components/ui.jsx'
import { samplePlan, trendById } from '../lib/data.js'
import { PromptBox } from '../components/PromptBox.jsx'
import { useStore } from '../lib/store.js'

// In-page links: scroll (smoothly unless reduced motion is set) and move focus to the
// target, so the next Tab continues from there (2.4.1, 2.4.3).
const scrollTo = (id) => (e) => {
  e.preventDefault()
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Looping product demo: describe → match → plan. Auto-plays, can be paused (2.2.2);
// shows the finished frame when reduced motion is on.
const STEPS = ['Describe your idea', 'Pick a trend that fits', 'Get a plan to film']
const CAPTIONS = [
  'Say what you want to film. Your profile (niche, who watches, what you can film with) shapes the match.',
  'See where each trend is in its life, and why it does or doesn’t fit you.',
  'Angle, hook, structure, shots and next steps. Edit it, then check items off on shoot day.',
]
function DemoReel() {
  const trend = trendById('three-ways')
  const plan = samplePlan('three-ways', 'maya')
  const [step, setStep] = useState(reduceMotion() ? 2 : 0)
  const [playing, setPlaying] = useState(!reduceMotion())
  const timer = useRef()
  useEffect(() => {
    if (!playing) return
    timer.current = setInterval(() => setStep((s) => (s + 1) % 3), 3400)
    return () => clearInterval(timer.current)
  }, [playing])
  return (
    <div className="reel" role="group" aria-label="Animated walkthrough">
      <div className="reel-top">
        <ol className="reel-steps">
          {STEPS.map((s, i) => (
            <li key={s}><button type="button" aria-current={i === step ? 'step' : undefined} onClick={() => { setPlaying(false); setStep(i) }}><span className="reel-n" aria-hidden="true">{i + 1}</span><span className="sr-only">Step {i + 1}: </span>{s}</button></li>
          ))}
        </ol>
        <button type="button" className="btn sm quiet" onClick={() => setPlaying((p) => !p)} aria-pressed={!playing}>{playing ? 'Pause' : 'Play'}</button>
      </div>
      <p className="reel-caption">{CAPTIONS[step]}</p>
      <div className="reel-stage" aria-live="off">
        <div className={`reel-frame ${step === 0 ? 'on' : ''}`} aria-hidden={step !== 0}>
          <div className="reel-prompt"><span className="reel-typing">cheap dinners my roommates would actually eat</span></div>
          <p className="meta"><span>Maya · Budget cooking</span><span>College students</span></p>
        </div>
        <div className={`reel-frame ${step === 1 ? 'on' : ''}`} aria-hidden={step !== 1}>
          <div className="loader" aria-hidden="true" />
          <ul className="reel-matches">
            {['three-ways', 'stopped-buying', 'silent-process'].map((id, i) => {
              const t = trendById(id)
              return (
                <li key={id} style={{ animationDelay: `${i * 0.15}s` }}>
                  <VideoBadge />
                  <strong>{t.title}</strong>
                  <span className="meta"><StageTag stage={t.stage} /></span>
                  <FitTag level={t.fit.maya.level} />
                </li>
              )
            })}
          </ul>
        </div>
        <div className={`reel-frame ${step === 2 ? 'on' : ''}`} aria-hidden={step !== 2}>
          <div className="row" style={{ gap: 'var(--s-2)' }}><SampleTag>Sample plan</SampleTag><span className="meta"><span>From {trend.title}</span></span></div>
          <p className="reel-title">Three dinners from one can</p>
          <dl className="reel-plan">
            <div><dt>Hook</dt><dd>{plan.hook}</dd></div>
            <div><dt>Your twist</dt><dd>{plan.twist}</dd></div>
            <div><dt>First shots</dt><dd>{plan.shots.slice(0, 2).join(' · ')}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const profile = useStore((s) => s.profile)
  const account = useStore((s) => s.account)
  const start = profile ? '/home' : account ? '/start' : '/signup'
  const trend = trendById('three-ways')
  const plan = samplePlan('three-ways', 'maya')
  return (
    <div className="landing">
      <a className="skip" href="#main" onClick={scrollTo('main')}>Skip to content</a>
      <header className="appbar">
        <div className="wrap">
          <Logo />
          <span className="spacer" />
          <nav aria-label="Page" className="row">
            <Link to={start} className="btn soft sm">Log in</Link>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <div className="hero-wrap">
          <div className="wrap">
            <section className="hero" aria-labelledby="hero-title">
              <p className="eyebrow">For independent creators</p>
              <h1 id="hero-title" className="t-display">What do you want to film this week?</h1>
              <p className="lede">Describe an idea. ShowStop finds trends that fit you and turns one into a plan with the angle, hook, shots and next steps.</p>
              <PromptBox target={start === '/home' ? 'trends' : start.slice(1)} />
              <p className="hero-note small muted">Sign up with TikTok or Instagram · Demo: sign-in is simulated, trends and plans are samples</p>
            </section>
          </div>
          <a className="hero-scroll small" href="#how" onClick={scrollTo('how')}>See how it works <span aria-hidden="true">↓</span></a>
        </div>

        <div className="wrap">
          <section className="section" id="how" aria-labelledby="how-title">
            <div className="section-head">
              <p className="eyebrow">How it works</p>
              <h2 id="how-title" className="t-h1">From “that's trending” to “I know what to film”</h2>
            </div>
            <DemoReel />
          </section>

          <section className="section sample-section" id="sample" aria-labelledby="sample-title">
            <div className="section-head">
              <p className="eyebrow">Sample plan</p>
              <h2 id="sample-title" className="t-h1">Three dinners from one can</h2>
              <p className="lede">Maya cooks on a student budget. ShowStop kept the trend's count-to-three format and gave her a twist that fits her audience.</p>
              <div className="row" style={{ marginTop: 'var(--s-5)' }}><Link to={start} className="btn primary">Make your own plan</Link></div>
            </div>
            <div className="card">
              <div className="row" style={{ gap: 'var(--s-2)' }}><SampleTag>Sample plan</SampleTag><span className="meta">{trend.title}</span></div>
              <dl className="plan-preview">
                <div><dt className="label">Angle</dt><dd>{plan.angle}</dd></div>
                <div><dt className="label">Hook</dt><dd>{plan.hook}</dd></div>
                <div><dt className="label">Your twist</dt><dd>{plan.twist}</dd></div>
                <div><dt className="label">Shot list</dt><dd><ul className="readonly">{plan.shots.map((s) => <li key={s}>{s}</li>)}</ul></dd></div>
              </dl>
            </div>
          </section>

          <section className="section next-section" id="next" aria-labelledby="next-title">
            <div className="section-head">
              <p className="eyebrow">Coming next · concept</p>
              <h2 id="next-title" className="t-h1">Spot trends where you scroll</h2>
              <p className="lede">A Trend Spotter browser extension saves the TikTok or Instagram post you're watching to ShowStop in one click. Then you can take the trend and your plan into Claude or ChatGPT to keep working.</p>
            </div>
            <ol className="steps">
              <li className="card"><span className="step-n" aria-hidden="true">1</span><h3>Save while you scroll</h3><p className="muted">Click “Save to ShowStop” on a post. It keeps the link, caption and the public counts you can see. Nothing runs in the background.</p></li>
              <li className="card"><span className="step-n" aria-hidden="true">2</span><h3>See if it fits you</h3><p className="muted">Saved posts appear next to the trends, with the same fit check against your profile.</p></li>
              <li className="card"><span className="step-n" aria-hidden="true">3</span><h3>Keep working in your AI tool</h3><p className="muted">Send the trend and plan to Claude or ChatGPT as a ready prompt, or connect ShowStop to the assistant directly.</p></li>
            </ol>
            <p className="notice info" style={{ marginTop: 'var(--s-5)' }}>This is a design concept. The extension and the AI connections are not built in this demo.</p>
          </section>
        </div>
      </main>
      <footer className="footer">
        <div className="wrap">
          <p><strong>About this demo.</strong> A portfolio redesign of ShowStop by Yi Wang. Trends and plans are illustrative samples written for the demo, not live data, real posts or live AI. Your profile and plans stay in this browser.</p>
        </div>
      </footer>
    </div>
  )
}
