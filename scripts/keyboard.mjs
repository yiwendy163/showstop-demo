// Keyboard-only walkthrough of the core task using real key events (Tab, Shift+Tab, Enter, Space, Escape).
// Usage: node scripts/keyboard.mjs <baseUrl> [<width>x<height>]
// At every focus stop it records the element, whether a focus indicator is visible,
// and whether the element is hidden behind a sticky or fixed bar (2.4.11).
// Below 900 px wide the assistant is a bottom sheet, so the walkthrough opens it with "Ask".
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const base = process.argv[2] || 'http://localhost:5173/'
const [w, h] = (process.argv[3] || '1440x900').split('x').map(Number)
const phone = w <= 900
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 9950 + Math.floor(Math.random() * 40)
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'kb-'))}`, 'about:blank'], { stdio: 'ignore' })
let t
for (let i = 0; i < 50 && !t; i++) { try { t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page') } catch { /* starting */ } await sleep(200) }
if (!t) { console.error('Chrome did not start'); process.exit(1) }
const ws = new WebSocket(t.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value
const hash = () => evaluate('location.hash')

const KEYS = { Tab: [9, 'Tab'], Enter: [13, 'Enter'], Space: [32, ' '], Escape: [27, 'Escape'] }
async function press(name, shift = false) {
  const [code, key] = KEYS[name]
  const k = { key, code: name === 'Space' ? 'Space' : name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers: shift ? 8 : 0 }
  const text = name === 'Enter' ? '\r' : name === 'Space' ? ' ' : undefined
  await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...k, ...(text ? { text, unmodifiedText: text } : {}) })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...k })
  await sleep(120)
}

// Describe the focused element. `name` approximates the accessible name (aria-label, else
// text without aria-hidden parts). `visible`: outline/box-shadow on it, or a focus-within ring
// on its wrapper. `hidden`: every sampled point of the element is covered by another element,
// i.e. focus is entirely obscured (2.4.11 fails); `partly`: only some points (2.4.12, AAA).
const describe = `(() => { const e = document.activeElement; if (!e || e === document.body) return null;
  const ring = (n) => { const cs = getComputedStyle(n); return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' };
  const wrap = e.closest('.composer, .trend-card, .prompt, .ai-option');
  const visible = ring(e) || (!!wrap && ring(wrap));
  const r = e.getBoundingClientRect();
  const pts = [[.5,.5],[.1,.2],[.9,.2],[.1,.8],[.9,.8]].map(([x,y]) => [r.left + r.width*x, r.top + r.height*y]).filter(([x,y]) => x>=0 && y>=0 && x<innerWidth && y<innerHeight);
  const covered = pts.map(([x,y]) => { const top = document.elementFromPoint(x,y); return top && !(e.contains(top) || top.contains(e) || (e.labels && [...e.labels].some(l => l.contains(top)))) ? (top.closest('header,nav,.editor-bar,.generate-box,.toast-region,.tabbar') || top) : null });
  const hits = covered.filter(Boolean);
  const hidden = pts.length > 0 && hits.length === pts.length, partly = hits.length > 0 && !hidden;
  let name = e.getAttribute('aria-label');
  if (!name) { const c = e.cloneNode(true); c.querySelectorAll('[aria-hidden=true]').forEach(n => n.remove()); name = e.matches('input,textarea,select') ? (e.labels?.[0]?.textContent || e.placeholder || '') : c.textContent }
  name = (name || e.id || '').trim().replace(/\\s+/g,' ').slice(0,60);
  return { tag: e.tagName.toLowerCase(), id: e.id, type: e.type || '', name, visible, hidden, partly, by: hits[0] ? (hits[0].className.toString().slice(0,24) || hits[0].tagName) : '' } })()`
const focused = () => evaluate(describe)

const issues = []
const notes = []
const steps = []
const note = async (d) => {
  if (!d) return
  const where = (await hash()).split('?')[0]
  if (!d.visible && !['h1', 'main', 'ol', 'section'].includes(d.tag) && !d.id.endsWith('-title')) issues.push(`no visible focus: ${d.tag} "${d.name}" (${where})`)
  if (d.hidden) issues.push(`focus entirely obscured by ${d.by}: ${d.tag} "${d.name}" (${where})`)
  else if (d.partly) notes.push(`focus partly covered by ${d.by}: ${d.tag} "${d.name}" (${where})`)
}
// Tab (or Shift+Tab) until `match(d)` is true. A string matches the exact name or id, or a name prefix.
async function tabTo(match, { max = 80, back = false } = {}) {
  const test = typeof match === 'function' ? match : (d) => d.name === match || d.id === match || d.name.startsWith(match)
  for (let i = 0; i < max; i++) {
    await press('Tab', back)
    const d = await focused()
    await note(d)
    if (d && test(d)) { steps.push(`     ${back ? 'Shift+' : ''}Tab×${i + 1} → ${d.tag} "${d.name}"`); return true }
  }
  issues.push(`could not reach "${typeof match === 'string' ? match : 'target'}" by ${back ? 'Shift+' : ''}Tab on ${await hash()}`); return false
}
const step = async (label, fn) => { let ok; try { ok = await fn() } catch (e) { ok = false; issues.push(`${label}: ${e.message}`) } steps.push(`${ok ? '✓' : '✗'} ${label}`); return ok }
const focusIsHeading = () => evaluate("document.activeElement.tagName === 'H1'")
const inDialog = () => evaluate("!!document.activeElement.closest('[role=dialog]')")
const type = async (text) => { await send('Input.insertText', { text }); await sleep(150) }

await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
await send('Page.navigate', { url: base + '#/' })
await sleep(1200)
await evaluate('localStorage.clear()')
await send('Page.navigate', { url: base + '#/' })
await sleep(1800)

// Landing ------------------------------------------------------------------
await step('Landing: first Tab reaches the skip link, which moves focus to main', async () => (await tabTo('Skip to content', { max: 1 })) && (await press('Enter'), await sleep(200), evaluate("document.activeElement.id === 'main'")))
await step('Landing: type an idea in the prompt and press Enter → sign-up, focus on h1', async () => {
  if (!(await tabTo('hero-prompt', { max: 6 }))) return false
  const isSearch = await evaluate("document.activeElement.closest('form')?.getAttribute('role') === 'search'")
  await type('cheap dinners'); await press('Enter'); await sleep(600)
  return isSearch && (await hash()).startsWith('#/signup') && (await focusIsHeading())
})
// Sign-up ------------------------------------------------------------------
await step('Sign-up: Continue with TikTok → consent, focus on the new h1', async () => (await tabTo('Continue with TikTok')) && (await press('Enter'), await sleep(300), evaluate("document.activeElement.id === 'su-consent'")))
await step('Sign-up: Allow and continue → AI choice, focus on the new h1', async () => (await tabTo('Allow and continue')) && (await press('Enter'), await sleep(300), evaluate("document.activeElement.id === 'su-ai'")))
await step('Sign-up: Continue is disabled until a choice; Space picks a radio, then Continue → profile', async () => {
  const disabled = await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent === 'Continue').disabled")
  if (!(await tabTo((d) => d.type === 'radio', { max: 5 }))) return false
  await press('Space'); await sleep(150)
  const checked = await evaluate("document.activeElement.checked")
  if (!(await tabTo('Continue', { max: 5 }))) return false
  await press('Enter'); await sleep(500)
  return disabled && checked && (await hash()).startsWith('#/start') && (await focusIsHeading())
})
// Profile ------------------------------------------------------------------
await step('Profile: empty form puts focus on the niche field with the error described', async () => {
  if (!(await tabTo('Continue', { max: 20 }))) return false
  await press('Enter'); await sleep(200)
  return evaluate("document.activeElement.id === 'p-niche' && document.activeElement.getAttribute('aria-invalid') === 'true' && document.activeElement.getAttribute('aria-describedby') === 'p-err'")
})
await step('Profile → sample creator Maya → idea matches on Trends, focus on h1', async () => (await tabTo((d) => d.name.includes('Maya ·'), { back: true })) && (await press('Enter'), await sleep(600), (await hash()).startsWith('#/trends?q=') && (await focusIsHeading())))
// Home prompt --------------------------------------------------------------
await step('Nav → Home, focus on h1', async () => {
  const navName = 'Home'
  if (!(await tabTo((d) => d.tag === 'a' && d.name === navName, { max: 60, back: !phone }))) return false
  await press('Enter'); await sleep(500)
  return (await hash()).startsWith('#/home') && (await focusIsHeading())
})
await step('Home: prompt + Enter → idea matches on Trends', async () => {
  if (!(await tabTo((d) => d.tag === 'textarea', { max: 10 }))) return false
  await type('calm video'); await press('Enter'); await sleep(600)
  return (await hash()).startsWith('#/trends?q=')
})
// Trends filters -----------------------------------------------------------
await step('Trends: Clear idea, then a fit filter with Space updates the count', async () => {
  if (!(await tabTo('Clear idea', { max: 10 }))) return false
  await press('Enter'); await sleep(500)
  if (phone) { if (!(await tabTo((d) => d.name.startsWith('Filters'), { max: 10 }))) return false; await press('Enter'); await sleep(200) }
  const before = await evaluate("[...document.querySelectorAll('[aria-live]')].map(n=>n.textContent).join('|')")
  if (!(await tabTo((d) => d.type === 'checkbox', { max: 15 }))) return false
  await press('Space'); await sleep(250)
  const after = await evaluate("[...document.querySelectorAll('[aria-live]')].map(n=>n.textContent).join('|')")
  await press('Space'); await sleep(200) // back to all trends
  return before !== after && evaluate("document.activeElement.type === 'checkbox'")
})
await step('Trends → open "One thing, three ways", focus on h1', async () => (await tabTo((d) => d.tag === 'a' && d.name.startsWith('One thing, three ways'), { max: 40 })) && (await press('Enter'), await sleep(500), (await hash()).startsWith('#/trends/three-ways') && (await focusIsHeading())))
await step('Detail → Generate production plan, focus on the plan heading', async () => (await tabTo('Generate production plan', { max: 40 })) && (await press('Enter'), await sleep(1800), (await hash()).startsWith('#/plan/') && (await evaluate("document.activeElement.id === 'plan-title'"))))
// Editor -------------------------------------------------------------------
await step('Editor: hand-off button says it opens a new tab', async () => evaluate("(() => { const b = document.querySelector('.send-btn'); return !!b && b.textContent.includes('new tab') })()"))
if (phone) {
  await step('Editor (phone) → Ask opens the notes sheet as a modal dialog, focus inside', async () => {
    if (!(await tabTo('Ask ShowStop', { back: true, max: 15 }))) return false
    await press('Enter'); await sleep(500)
    return (await inDialog()) && evaluate("document.querySelector('#assistant').getAttribute('aria-modal') === 'true' && !!document.querySelector('.editor-bar').closest('[inert]')")
  })
  await step('Sheet: Tab stays inside the sheet', async () => {
    for (let i = 0; i < 12; i++) { await press('Tab'); if (!(await inDialog())) { issues.push('focus left the open sheet'); return false } }
    return true
  })
}
await step('Editor → answer the assistant with "Not sure"; focus stays in the conversation; reply announced', async () => {
  if (!(await tabTo('Not sure', { max: 40 }))) return false
  await press('Enter'); await sleep(700)
  const kept = await evaluate("!!document.activeElement.closest('#assistant')")
  const added = await evaluate("document.querySelector('#f-nextSteps').value.includes('Find out')")
  const said = await evaluate("document.querySelector('#assistant [role=status]').textContent.startsWith('ShowStop:')")
  if (!kept) issues.push('focus lost after answering (chips removed)')
  if (!said) issues.push('assistant reply not placed in the status region')
  return kept && added && said
})
if (phone) {
  await step('Sheet: Escape closes it and focus returns to Ask', async () => {
    await press('Escape'); await sleep(450)
    return evaluate("!document.querySelector('.assistant.open') && document.activeElement.classList.contains('ask-btn') && !document.querySelector('.editor-bar').closest('[inert]')")
  })
}
await step('Editor → Improve hook: open, Escape closes, focus back on the button', async () => {
  if (!(await tabTo('Improve hook', { max: 40 }))) return false
  await press('Enter'); await sleep(200)
  const opened = await evaluate("!!document.querySelector('#hook-menu')")
  await press('Escape'); await sleep(150)
  return opened && evaluate("!document.querySelector('#hook-menu') && document.activeElement.textContent.includes('Improve')")
})
await step('Editor → Improve hook: pick the first option with Tab + Enter, focus back on the button', async () => {
  await press('Enter'); await sleep(200)
  await press('Tab'); await press('Enter'); await sleep(250)
  return evaluate("document.querySelector('#f-hook').value.startsWith('\"$1') && document.activeElement.textContent.includes('Improve')")
})
await step('Editor → Tab to the hook field and type; save state says Unsaved', async () => {
  if (!(await tabTo('f-hook', { max: 5 }))) return false
  await type(' (kb)')
  return evaluate("document.querySelector('#f-hook').value.endsWith('(kb)') && document.querySelector('.save-state').textContent.includes('Unsaved')")
})
await step('Editor → Save with keyboard (Shift+Tab back to the editor bar)', async () => (await tabTo('Save', { back: true, max: 60 })) && (await press('Enter'), await sleep(300), await evaluate("document.querySelector('.save-state').textContent === 'Saved'")))
await step('Editor → Shoot day, check the first shot with Space', async () => {
  if (!(await tabTo('Shoot day', { max: 40 }))) return false
  await press('Enter'); await sleep(250)
  if (!(await tabTo((d) => d.type === 'checkbox', { max: 10 }))) return false
  await press('Space'); await sleep(150)
  return evaluate("document.querySelector('.checklist input').checked && document.querySelector('.save-state').textContent.includes('Unsaved')")
})
await step('Unsaved guard (nav link): dialog takes focus, background inert, Escape closes, focus returns', async () => {
  const navName = phone ? 'Saved' : 'Saved plans'
  if (!(await tabTo((d) => d.tag === 'a' && d.name === navName, { max: 160, back: !phone }))) return false
  await press('Enter'); await sleep(300)
  const inside = await inDialog()
  const bgInert = await evaluate("!!document.querySelector('.editor')?.closest('[inert]')")
  await press('Escape'); await sleep(200)
  const closed = await evaluate("!document.querySelector('[role=dialog]')")
  const back = await evaluate(`document.activeElement.tagName === 'A' && document.activeElement.textContent === ${JSON.stringify(navName)}`)
  if (!bgInert) issues.push('background not inert while the guard dialog is open')
  return inside && bgInert && closed && back && (await hash()).startsWith('#/plan/')
})
await step('Unsaved guard (browser Back): dialog opens; Stay keeps the plan', async () => {
  await evaluate('history.back()'); await sleep(600)
  const shown = await inDialog()
  const still = (await hash()).startsWith('#/plan/')
  if (!shown) issues.push('browser Back left the editor without the unsaved-changes dialog')
  if (!(await tabTo('Stay', { max: 5 }))) return false
  await press('Enter'); await sleep(200)
  return shown && still && evaluate("!document.querySelector('[role=dialog]') && !!document.querySelector('#plan-title')")
})
await step('Copy plan gives feedback (toast or copy dialog)', async () => {
  if (!(await tabTo('Copy plan', { max: 160, back: true }))) return false
  await press('Enter'); await sleep(500)
  const ok = await evaluate("!!document.querySelector('[role=dialog]') || document.querySelector('.toast-region').textContent.includes('Copied')")
  if (await inDialog()) { await press('Escape'); await sleep(150) }
  return ok
})
await step('Guard → Save and leave → Saved plans, focus on h1', async () => {
  const navName = phone ? 'Saved' : 'Saved plans'
  if (!(await tabTo((d) => d.tag === 'a' && d.name === navName, { max: 160, back: !phone }))) return false
  await press('Enter'); await sleep(300)
  if (!(await inDialog())) { issues.push('guard dialog did not open on the second leave'); return false }
  if ((await evaluate('document.activeElement.textContent')) !== 'Save and leave' && !(await tabTo('Save and leave', { max: 4 }))) return false
  await press('Enter'); await sleep(600)
  return (await hash()).startsWith('#/saved') && (await focusIsHeading())
})
await step('Saved: Delete opens a dialog with focus on "Keep it"; Escape returns focus to Delete', async () => {
  if (!(await tabTo((d) => d.name.startsWith('Delete'), { max: 30 }))) return false
  await press('Enter'); await sleep(300)
  const safe = await evaluate("document.activeElement.textContent === 'Keep it'")
  await press('Escape'); await sleep(200)
  return safe && evaluate("document.activeElement.textContent === 'Delete' && !document.querySelector('[role=dialog]')")
})

console.log(`Keyboard walkthrough at ${w}x${h}`)
steps.forEach((s) => console.log('  ' + s))
console.log(issues.length ? `ISSUES (${new Set(issues).size}):\n  ` + [...new Set(issues)].join('\n  ') : 'ISSUES: none')
if (notes.length) console.log(`NOTES, not failures (${new Set(notes).size}):\n  ` + [...new Set(notes)].join('\n  '))
const failed = steps.filter((s) => s.startsWith('✗')).length
console.log(`RESULT: ${steps.filter((s) => s.startsWith('✓')).length} passed, ${failed} failed`)
ws.close(); chrome.kill()
process.exit(0)
