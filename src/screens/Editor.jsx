import { useCallback, useEffect, useRef, useState } from 'react'
import { AutoTextarea, Dialog, FitTag, Link, StageTag, useMedia, useModal, useToast } from '../components/ui.jsx'
import { creatorById, planMeta, trendById } from '../lib/data.js'
import { SECTIONS, draftFrom, toPlainText } from '../lib/plan.js'
import { navigate, query, replacePath, setNavigationGuard } from '../lib/router.js'
import { AI_MODELS, activeCreator, savePlan, savedById, useStore } from '../lib/store.js'

const LIST_KINDS = ['list', 'check']
const lines = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean)

export default function Editor({ isNew, trendId, id }) {
  const profile = useStore((s) => s.profile)
  const creator = activeCreator(profile)
  const toast = useToast()
  const [plan, setPlan] = useState(null)
  const [status, setStatus] = useState(isNew ? 'loading' : 'ready') // loading | ready | failed | missing
  const [dirty, setDirty] = useState(false)
  const [mode, setMode] = useState('edit')
  const [thread, setThread] = useState([])
  const [sheet, setSheet] = useState(false)
  const [menu, setMenu] = useState(false)
  const [leaveTo, setLeaveTo] = useState(null)
  const [copyText, setCopyText] = useState(null)
  const [isSaved, setIsSaved] = useState(!isNew)
  const [attempt, setAttempt] = useState(0)
  const [announce, setAnnounce] = useState('') // polite status for new assistant replies
  const headingRef = useRef()
  const stateHeading = useRef()
  const improveBtn = useRef()
  const askBtn = useRef()
  const composerRef = useRef()
  const threadRef = useRef()
  const sheetRef = useRef()
  // On phones the assistant is a bottom sheet and behaves as a modal dialog.
  const narrow = useMedia('(max-width: 900px)')
  const sheetModal = narrow && sheet
  useModal(sheetRef, sheetModal, () => setSheet(false), askBtn)

  // Load: a saved plan, or a sample plan "generated" with a short honest wait.
  useEffect(() => {
    if (!isNew) {
      const p = savedById(id)
      if (!p) { setStatus('missing'); return }
      setPlan(p); setStatus('ready'); return
    }
    setStatus('loading')
    const fail = query().get('fail') === '1' && attempt === 0
    const t = setTimeout(() => {
      if (fail) { setStatus('failed'); return }
      const d = draftFrom(trendId, creator.id)
      if (!d) { setStatus('missing'); return }
      setPlan(d); setStatus('ready')
    }, 900)
    return () => clearTimeout(t)
  }, [isNew, id, trendId, creator.id, attempt])

  // Loading and failure replace the page, so move focus to their heading.
  useEffect(() => {
    if (status === 'loading' || status === 'failed') stateHeading.current?.focus()
  }, [status])

  // When a plan becomes ready, open the assistant thread and move focus to the plan.
  useEffect(() => {
    if (status !== 'ready' || !plan) return
    const trend = trendById(plan.trendId)
    const sampleName = creatorById(plan.creatorId).name
    const intro = [{ from: 'ai', text: <>I made a plan for <b>{creator.isCustom ? `you (closest sample: ${sampleName})` : `${sampleName} · ${creator.niche}`}</b> from <b>{trend.title}</b>. It keeps {trend.keep[0].toLowerCase()} and adds your twist: {plan.twist.charAt(0).toLowerCase() + plan.twist.slice(1)}</> }]
    if (creator.isCustom) intro.push({ from: 'ai', text: planMeta.customProfileNote })
    const open = (plan.unknowns || []).filter((u) => !(plan.answered || []).includes(u))
    if (open.length) intro.push({ from: 'ai', ask: open[0], text: <>One thing the trend data doesn't know: <b>{open[0].replace(/^Whether /, 'whether ')}</b>. Is that true for you?</> })
    else intro.push({ from: 'ai', text: 'Nothing open on this plan. Try ✦ Improve on the hook, or switch to Shoot day when you film.' })
    setThread(intro)
    setTimeout(() => headingRef.current?.focus(), 0)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Unsaved-changes guard for in-app navigation and tab close.
  useEffect(() => {
    setNavigationGuard((to) => { if (dirty) { setLeaveTo(to); return false } return true })
    const onUnload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', onUnload)
    return () => { setNavigationGuard(null); window.removeEventListener('beforeunload', onUnload) }
  }, [dirty])

  // Phones: tuck the editor bar while scrolling down, bring it back on scroll up.
  const [tucked, setTucked] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (window.innerWidth > 900) { setTucked(false); last = y; return }
      if (y > 140 && y > last + 6) setTucked(true)
      else if (y < last - 6 || y < 140) setTucked(false)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const update = useCallback((patch) => { setPlan((p) => ({ ...p, ...patch })); setDirty(true) }, [])

  const save = () => {
    const ok = savePlan(plan)
    if (!ok) { toast("Couldn't save in this browser. Copy the plan so you don't lose it.", { label: 'Copy plan', run: copy }); return false }
    setDirty(false); setIsSaved(true)
    if (isNew) replacePath(`/plan/${plan.id}`)
    toast('Plan saved', { label: 'View saved plans', run: () => navigate('/saved') })
    return true
  }

  // Hand-off to the creator's own AI assistant (D17): copy a ready prompt, then open the
  // assistant in a new tab. Nothing goes in the URL; the user pastes it themselves.
  const account = useStore((s) => s.account)
  const handoff = async () => {
    const m = account?.ai && AI_MODELS[account.ai]
    if (!m) { toast('Choose your AI assistant first.', { label: 'Choose', run: () => navigate('/signup') }); return }
    const t = trendById(plan.trendId)
    const text = `I'm an independent creator (${creator.niche}, for ${creator.audience.toLowerCase()}). I'm planning a 30-second TikTok based on the trend "${t.title}": ${t.summary}\n\nHere is my draft production plan from ShowStop:\n\n${toPlainText(plan)}\n\nPlease help me tighten the hook, suggest one stronger twist for my audience, and point out anything that would be hard to film with: ${creator.resources.join(', ')}.`
    let copied = true
    try { await navigator.clipboard.writeText(text) } catch { copied = false }
    window.open(m.url, '_blank', 'noopener')
    if (copied) toast(`Prompt copied. Paste it into ${m.name}.`)
    else setCopyText(text)
  }

  const copy = async () => {
    const text = toPlainText(plan)
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied as text. Paste it into notes or a message.')
    } catch {
      setCopyText(text)
    }
  }

  // Only new assistant replies are announced; `speak` is their plain-text form.
  const say = (msg) => {
    setThread((t) => [...t, msg])
    if (msg.from === 'ai') setAnnounce(`ShowStop: ${msg.speak || msg.text}`)
  }
  const answer = (unknown, choice) => {
    setThread((t) => t.map((m) => (m.ask === unknown ? { ...m, answeredWith: choice } : m)))
    threadRef.current?.focus() // the chips are removed; keep focus in the conversation
    say({ from: 'me', text: choice })
    const note = choice === 'Not sure' ? `Find out: ${unknown.replace(/^Whether /, 'whether ')}` : `Checked: ${unknown.replace(/^Whether /, 'whether ')} (${choice.toLowerCase()})`
    const answered = [...(plan.answered || []), unknown]
    update({ nextSteps: [...plan.nextSteps, note], answered })
    setTimeout(() => {
      say({ from: 'ai', text: choice === 'Not sure' ? 'No problem. I added it to your next steps so it travels with the plan.' : 'Noted. I added it to your next steps so whoever films knows.' })
      const next = (plan.unknowns || []).find((u) => !answered.includes(u))
      if (next) say({ from: 'ai', ask: next, speak: `One more: ${next.replace(/^Whether /, 'whether ')}? Answer with Yes, No or Not sure.`, text: <>One more: <b>{next.replace(/^Whether /, 'whether ')}</b>?</> })
    }, 350)
  }
  const applyHook = (alt, fromMenu) => {
    update({ hook: alt.text })
    setMenu(false)
    if (fromMenu) improveBtn.current?.focus()
    say({ from: 'ai', speak: `Hook updated (${alt.label.toLowerCase()}). The previous version is still in your history if you don't save.`, text: <>Hook updated ({alt.label.toLowerCase()}). The previous version is still in your history if you don't save.</> })
  }
  const ask = (text) => {
    if (!text.trim()) return
    say({ from: 'me', text })
    setTimeout(() => {
      if (/hook|short|open|first/i.test(text) && plan.hookAlternatives.length) {
        say({ from: 'ai', text: 'Here are two prepared hook options:', speak: `Here are ${plan.hookAlternatives.length} prepared hook options, shown as buttons below this message.`, options: plan.hookAlternatives })
      } else {
        say({ from: 'ai', text: 'This demo only has prepared suggestions, so I can’t rewrite freely. Try asking about the hook, or edit any section directly.' })
      }
    }, 350)
  }

  useEffect(() => {
    if (!menu) return
    const onKey = (e) => { if (e.key === 'Escape') { setMenu(false); improveBtn.current?.focus() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menu])

  // ---- States ---------------------------------------------------------
  if (status === 'loading') {
    const t = trendById(trendId)
    return (
      <div className="generating card">
        <h1 className="eyebrow" ref={stateHeading} tabIndex={-1}>Preparing your plan</h1>
        <p style={{ margin: '8px 0 14px' }}>Matching “{t?.title}” to {creator.niche.toLowerCase()}…</p>
        <div className="loader" aria-hidden="true" />
        <p className="tiny muted" style={{ marginTop: 12 }}>Sample plan: written in advance for this demo.</p>
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="generating card stack" role="alert">
        <h1 className="t-h2" ref={stateHeading} tabIndex={-1}>The plan didn't load</h1>
        <p className="muted">Your trend and profile are kept. Nothing was lost.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn primary" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
          <Link to={`/trends/${trendId}`} className="btn">Back to trend</Link>
        </div>
      </div>
    )
  }
  if (status === 'missing' || !plan) {
    return <div className="stack"><h1>Plan not found</h1><p className="muted">It may have been deleted, or saved in a different browser.</p><Link to="/saved">Saved plans</Link></div>
  }

  const trend = trendById(plan.trendId)
  const fit = trend.fit[plan.creatorId]
  const sectionValue = (s) => (LIST_KINDS.includes(s.kind) ? plan[s.key].join('\n') : plan[s.key])
  const setSection = (s) => (v) => update({ [s.key]: LIST_KINDS.includes(s.kind) ? v.split('\n') : v })
  const toggleDone = (k) => update({ done: { ...plan.done, [k]: !plan.done?.[k] } })
  const cleanLists = () => setPlan((p) => {
    const next = { ...p }
    SECTIONS.filter((s) => LIST_KINDS.includes(s.kind)).forEach((s) => { next[s.key] = lines(p[s.key].join('\n')) })
    return next
  })

  const field = (s) => (
    <div key={s.key} className={`tl-sec ${s.key === 'twist' ? 'twist-sec' : ''}`}>
      <div className="tl-head">
        <label className="label" htmlFor={`f-${s.key}`}>{s.label}</label>
        {s.kind !== 'text' && mode === 'edit' && <span className="hint" id={`h-${s.key}`}>One per line</span>}
      </div>
      <AutoTextarea id={`f-${s.key}`} value={sectionValue(s)} onChange={setSection(s)} onBlur={cleanLists} aria-describedby={s.kind !== 'text' ? `h-${s.key}` : undefined} />
    </div>
  )

  const readonly = (s) => {
    const v = plan[s.key]
    if (s.kind === 'check') {
      return (
        <div key={s.key} className="tl-sec">
          <div className="tl-head"><h2 className="label">{s.label}</h2><span className="hint">{v.filter((_, i) => plan.done?.[`${s.key}:${i}`]).length} of {v.length} done</span></div>
          <ul className="checklist">
            {v.map((item, i) => {
              const k = `${s.key}:${i}`
              return <li key={k} className={plan.done?.[k] ? 'done' : ''}><label className="check"><input type="checkbox" checked={!!plan.done?.[k]} onChange={() => toggleDone(k)} /><span>{item}</span></label></li>
            })}
          </ul>
        </div>
      )
    }
    return (
      <div key={s.key} className={`tl-sec ${s.key === 'twist' ? 'twist-sec' : ''}`}>
        <h2 className="label">{s.label}</h2>
        {Array.isArray(v) ? (s.key === 'structure' ? <ol className="readonly">{v.map((x) => <li key={x}>{x}</li>)}</ol> : <ul className="readonly">{v.map((x) => <li key={x}>{x}</li>)}</ul>) : <p className="readonly-text">{v}</p>}
      </div>
    )
  }

  const render = mode === 'edit' ? field : readonly
  const [angle, hook, keep, twist, ...rest] = SECTIONS
  const shootOrder = mode === 'shoot' ? [rest[1], rest[3], hook, keep, twist, rest[0], rest[2], angle] : null

  return (
    <>
      <div className={`editor-bar ${tucked ? 'tucked' : ''}`} onFocus={() => setTucked(false)}>
        <Link to={`/trends/${plan.trendId}`} className="small">← {trend.title}</Link>
        <span className="spacer" />
        <span className={`save-state ${dirty ? 'dirty' : ''}`}>{dirty ? 'Unsaved changes' : isSaved ? 'Saved' : 'Not saved yet'}</span>
        <button type="button" ref={askBtn} className="btn sm ask-btn" aria-haspopup="dialog" aria-expanded={sheet} aria-controls="assistant" onClick={() => setSheet(true)}><span aria-hidden="true">✦</span> Ask<span className="sr-only"> ShowStop</span></button>
        <button type="button" className="btn sm send-btn" onClick={handoff}>{account?.ai ? `Send to ${AI_MODELS[account.ai].name}` : 'Send to AI'}<span aria-hidden="true"> ↗</span><span className="sr-only">{account?.ai ? '' : ' (ChatGPT or Claude'}{account?.ai ? ' (opens in a new tab)' : ', opens in a new tab)'}</span></button>
        <button type="button" className="btn sm" onClick={copy}>Copy plan</button>
        <button type="button" className="btn primary sm" onClick={save}>Save</button>
      </div>

      <div className="editor">
        <div id="assistant" ref={sheetRef} className={`assistant ${sheet ? 'open' : ''}`} {...(sheetModal ? { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'assistant-title' } : { role: 'complementary', 'aria-labelledby': 'assistant-title' })}>
          <div className="assistant-head"><i aria-hidden="true" /><span id="assistant-title" tabIndex={-1} data-autofocus>ShowStop notes</span><button type="button" className="btn sm quiet sheet-close" onClick={() => setSheet(false)}>Close<span className="sr-only"> notes</span></button></div>
          <p className="tiny muted" style={{ padding: '0 16px 8px' }}>Prepared replies for the demo. No live AI.</p>
          <ol className="thread" ref={threadRef} tabIndex={-1} aria-label="Conversation">
            {thread.map((m, i) => (
              <li key={i} className={`msg ${m.from === 'me' ? 'me' : ''} enter`}>
                <span className="sr-only">{m.from === 'me' ? 'You: ' : 'ShowStop: '}</span>{m.text}
                {m.ask && !m.answeredWith && (
                  <div className="chips">{['Yes', 'No', 'Not sure'].map((c) => <button key={c} type="button" className="chip" onClick={() => answer(m.ask, c)}>{c}</button>)}</div>
                )}
                {m.options && (
                  <div className="chips">{m.options.map((o) => <button key={o.text} type="button" className="chip" onClick={() => applyHook(o, false)}>Use: {o.text}</button>)}</div>
                )}
              </li>
            ))}
          </ol>
          <p className="sr-only" role="status">{announce}</p>
          <form className="composer" onSubmit={(e) => { e.preventDefault(); const v = composerRef.current.value; composerRef.current.value = ''; ask(v) }}>
            <label htmlFor="composer" className="sr-only">Ask ShowStop about this plan</label>
            <textarea id="composer" ref={composerRef} rows={1} placeholder="Ask about this plan" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit() } }} />
            <button type="submit" aria-label="Send question"><span aria-hidden="true">↑</span></button>
          </form>
        </div>

        <article className="doc" aria-labelledby="plan-title">
          <div className="doc-head">
            <FitTag level={fit.level} who={creator.isCustom ? 'closest sample' : creatorById(plan.creatorId).name} />
            <p className="meta doc-meta"><span>Sample plan</span><StageTag stage={trend.stage} /></p>
            <span className="spacer" />
            <div className="mode-switch" role="group" aria-label="View">
              <button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>Edit</button>
              <button type="button" aria-pressed={mode === 'shoot'} onClick={() => setMode('shoot')}>Shoot day</button>
            </div>
          </div>
          <h1 id="plan-title" ref={headingRef} tabIndex={-1} className="sr-only">{plan.title}</h1>
          <label htmlFor="f-title" className="sr-only">Plan title</label>
          <input id="f-title" className="title-input" value={plan.title} onChange={(e) => update({ title: e.target.value })} readOnly={mode === 'shoot'} />
          <p className="doc-sub">For {creator.isCustom ? 'you' : creatorById(plan.creatorId).name} · {creator.niche} · 30s · TikTok</p>

          <div className="timeline">
            {mode === 'shoot' ? shootOrder.map(readonly) : <>
              {render(angle)}
              <div className="tl-sec">
                <div className="tl-head">
                  <label className="label" htmlFor="f-hook">Hook</label>
                  {plan.hookAlternatives.length > 0 && (
                    <div className="improve">
                      <button type="button" ref={improveBtn} className="btn sm" aria-expanded={menu} aria-controls="hook-menu" onClick={() => setMenu(!menu)}><span aria-hidden="true">✦</span> Improve<span className="sr-only"> hook</span></button>
                      {menu && (
                        <div className="menu" id="hook-menu" role="group" aria-label="Hook suggestions">
                          {plan.hookAlternatives.map((o) => <button key={o.text} type="button" onClick={() => applyHook(o, true)}><b>{o.label}</b> · {o.text}</button>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <AutoTextarea id="f-hook" value={plan.hook} onChange={(v) => update({ hook: v })} />
              </div>
              <div className="tl-sec">
                <div className="keep-twist">
                  <div className="keep-box">
                    <label className="label" htmlFor="f-keep">{keep.label}</label>
                    <AutoTextarea id="f-keep" value={plan.keep.join('\n')} onChange={setSection(keep)} onBlur={cleanLists} />
                  </div>
                  <div className="twist-box">
                    <label className="label" htmlFor="f-twist">{twist.label}</label>
                    <AutoTextarea id="f-twist" value={plan.twist} onChange={(v) => update({ twist: v })} />
                  </div>
                </div>
              </div>
              {rest.map(render)}
            </>}
          </div>
        </article>
      </div>


      {leaveTo && (
        <Dialog title="You have unsaved changes" onClose={() => setLeaveTo(null)}>
          <p className="muted">Save this plan before you leave?</p>
          <div className="row" style={{ marginTop: 16 }}>
            <button type="button" className="btn primary" onClick={() => { const to = leaveTo; if (save()) { setLeaveTo(null); setNavigationGuard(null); navigate(to) } }}>Save and leave</button>
            <button type="button" className="btn" onClick={() => setLeaveTo(null)}>Stay</button>
            <button type="button" className="btn quiet" onClick={() => { const to = leaveTo; setDirty(false); setLeaveTo(null); setNavigationGuard(null); navigate(to) }}>Discard</button>
          </div>
        </Dialog>
      )}
      {copyText && (
        <Dialog title="Copy your plan" onClose={() => setCopyText(null)}>
          <p className="muted small">Your browser blocked automatic copying. The text is selected below; press Ctrl+C or ⌘C.</p>
          <label htmlFor="copy-box" className="sr-only">Plan text</label>
          <textarea id="copy-box" readOnly value={copyText} rows={10} style={{ width: '100%', marginTop: 10 }} onFocus={(e) => e.target.select()} />
          <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn" onClick={() => setCopyText(null)}>Done</button></div>
        </Dialog>
      )}
    </>
  )
}

