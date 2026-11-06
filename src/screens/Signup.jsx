import { useEffect, useRef, useState } from 'react'
import { Logo } from '../components/ui.jsx'
import { navigate, query } from '../lib/router.js'
import { AI_MODELS, setAiModel, signIn, useStore } from '../lib/store.js'

// Sign-up (D17): choose TikTok or Instagram, see what ShowStop would access, then pick
// the AI assistant for hand-offs. Sign-in is simulated — no data leaves the browser.
const PROVIDERS = {
  tiktok: { name: 'TikTok', scope: ['Your display name and profile photo', 'The public videos you choose to save'] },
  instagram: { name: 'Instagram', scope: ['Your username and profile photo', 'The public posts and reels you choose to save'] },
}

const keepQuery = (to) => { const q = query().get('q'); return q ? `${to}?q=${encodeURIComponent(q)}` : to }

export default function Signup() {
  const account = useStore((s) => s.account)
  const [step, setStep] = useState(account?.provider ? 'ai' : 'provider') // provider | consent | ai
  const [provider, setProvider] = useState(account?.provider || null)
  const [ai, setAi] = useState(account?.ai || null)
  const head = useRef()
  useEffect(() => { head.current?.focus() }, [step])

  const p = provider && PROVIDERS[provider]
  return (
    <>
      <header className="appbar"><div className="wrap"><Logo /><span className="spacer" /><span className="small muted">Step {step === 'provider' ? 1 : step === 'consent' ? 2 : 3} of 4</span></div></header>
      <main id="main" tabIndex={-1}>
        <div className="wrap signup">
          <p className="notice info">Demo: sign-in is simulated. Nothing is sent to TikTok, Instagram, OpenAI or Anthropic.</p>

          {step === 'provider' && (
            <section className="card signup-card" aria-labelledby="su-title">
              <h1 id="su-title" ref={head} tabIndex={-1}>Create your ShowStop account</h1>
              <p className="sub">Sign up with the account you post from. ShowStop uses it to know who you create for.</p>
              <div className="signup-options">
                {Object.entries(PROVIDERS).map(([id, v]) => (
                  <button key={id} type="button" className={`btn provider-btn ${id}`} onClick={() => { setProvider(id); setStep('consent') }}>
                    Continue with {v.name}
                  </button>
                ))}
              </div>
              <p className="tiny muted">Portfolio visitors can skip this: <a href="#/home?as=maya">open the demo as Maya</a>.</p>
            </section>
          )}

          {step === 'consent' && p && (
            <section className="card signup-card" aria-labelledby="su-consent">
              <h1 id="su-consent" ref={head} tabIndex={-1}>ShowStop wants to access your {p.name} account</h1>
              <p className="sub">On a real sign-in, {p.name} would show this screen. ShowStop asks only for:</p>
              <ul className="consent-list">{p.scope.map((x) => <li key={x}>{x}</li>)}</ul>
              <p className="small muted">It never posts for you, and never reads private messages or your full feed.</p>
              <div className="row" style={{ marginTop: 'var(--s-5)' }}>
                <button type="button" className="btn primary" onClick={() => { signIn(provider); setStep('ai') }}>Allow and continue</button>
                <button type="button" className="btn quiet" onClick={() => setStep('provider')}>Back</button>
              </div>
            </section>
          )}

          {step === 'ai' && (
            <section className="card signup-card" aria-labelledby="su-ai">
              <h1 id="su-ai" ref={head} tabIndex={-1}>Which AI assistant do you use?</h1>
              <p className="sub">When a plan is ready, ShowStop can hand it to your assistant as a ready prompt. You'll stay signed in to it in its own app.</p>
              <fieldset className="ai-options">
                <legend className="sr-only">AI assistant</legend>
                {Object.entries(AI_MODELS).map(([id, m]) => (
                  <label key={id} className={`ai-option ${ai === id ? 'on' : ''}`}>
                    <input type="radio" name="ai" value={id} checked={ai === id} onChange={() => setAi(id)} />
                    <span><strong>{m.name}</strong><span className="small muted">{id === 'claude' ? 'Opens claude.ai' : 'Opens chatgpt.com'}</span></span>
                  </label>
                ))}
              </fieldset>
              <div className="row" style={{ marginTop: 'var(--s-5)' }}>
                <button type="button" className="btn primary" disabled={!ai} aria-describedby={!ai ? 'ai-hint' : undefined} onClick={() => { setAiModel(ai); navigate(keepQuery('/start')) }}>Continue</button>
                <button type="button" className="btn quiet" onClick={() => navigate(keepQuery('/start'))}>Skip for now</button>
              </div>
              {!ai && <p id="ai-hint" className="tiny muted" style={{ marginTop: 'var(--s-2)' }}>Choose one, or skip. You can change it later in your profile.</p>}
            </section>
          )}
        </div>
      </main>
    </>
  )
}
