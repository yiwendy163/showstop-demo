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

// Describe the focused element. `visible`: outline/box-shadow on it, or a focus-within
// ring on its wrapper (composer, trend card). `obscured`: the element's centre is covered
// by something that is neither it nor inside it (sticky header, tab bar, fixed panel).
const describe = `(() => { const e = document.activeElement; if (!e || e === document.body) return null;
  const ring = (n) => { const cs = getComputedStyle(n); return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' };
  const wrap = e.closest('.composer, .trend-card');
  const visible = ring(e) || (!!wrap && ring(wrap));
  const r = e.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + Math.min(r.height / 2, 20);
  const top = (cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight) ? document.elementFromPoint(cx, cy) : null;
  const obscured = !!top && !(e.contains(top) || top.contains(e) || (e.labels && [...e.labels].some(l => l.contains(top))));
  const name = (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || e.id || '').trim().replace(/\\s+/g,' ').slice(0,50);
  return { tag: e.tagName.toLowerCase(), id: e.id, name, visible, obscured, by: obscured ? top.className.toString().slice(0,30) || top.tagName : '' } })()`
const focused = () => evaluate(describe)

const issues = []
const steps = []
const note = async (d) => {
  if (!d) return
  const where = await hash()
  if (!d.visible && d.tag !== 'h1' && d.tag !== 'main' && d.tag !== 'ol' && !d.id.endsWith('-title')) issues.push(`no visible focus: ${d.tag} "${d.name}" (${where})`)
  if (d.obscured) issues.push(`focus obscured by ${d.by}: ${d.tag} "${d.name}" (${where})`)
}
// Tab (or Shift+Tab) until `match(d)` is true. `match` may be a string: exact name, id, or name prefix.
async function tabTo(match, { max = 80, back = false } = {}) {
  const test = typeof match === 'function' ? match : (d) => d.name === match || d.id === match || d.name.startsWith(match + ' ')
  for (let i = 0; i < max; i++) {
    await press('Tab', back)
    const d = await focused()
    await note(d)
    if (d && test(d)) { steps.push(`   ${back ? 'Shift+' : ''}Tab×${i + 1} → ${d.tag} "${d.name}"`); return true }
  }
  issues.push(`could not reach "${match}" by ${back ? 'Shift+' : ''}Tab on ${await hash()}`); return false
}
const step = async (label, fn) => { let ok; try { ok = await fn() } catch (e) { ok = false; issues.push(`${label}: ${e.message}`) } steps.push(`${ok ? '✓' : '✗'} ${label}`); return ok }
const focusIsHeading = async () => evaluate("document.activeElement.tagName === 'H1'")
const inDialog = () => evaluate("!!document.activeElement.closest('[role=dialog]')")

await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
await send('Page.navigate', { url: base + '#/' })
await sleep(1500)
await evaluate('localStorage.clear()')
await send('Page.navigate', { url: base + '#/' })
await sleep(1500)

await step('Landing: first Tab reaches the skip link', async () => (await tabTo('Skip to content', { max: 1 })))
await step('Landing: skip link moves focus to main', async () => { await press('Enter'); await sleep(200); return evaluate("document.activeElement.id === 'main'") })
await step('Landing → Try the demo → Profile, focus on h1', async () => (await tabTo('Try the demo')) && (await press('Enter'), await sleep(500), (await hash()) === '#/start' && (await focusIsHeading())))
await step('Profile: empty form shows the error on the niche field', async () => {
  if (!(await tabTo('Continue'))) return false
  await press('Enter'); await sleep(200)
  return evaluate("document.activeElement.id === 'p-niche' && document.activeElement.getAttribute('aria-invalid') === 'true' && document.activeElement.getAttribute('aria-describedby') === 'p-err'")
})
await step('Profile → sample creator Maya → Home, focus on h1', async () => (await tabTo((d) => d.name.startsWith('Sample creator Maya'), { back: true })) && (await press('Enter'), await sleep(500), (await hash()) === '#/home' && (await focusIsHeading())))
await step('Home → open a best-fit trend', async () => (await tabTo((d) => d.name.startsWith('One thing, three ways'))) && (await press('Enter'), await sleep(500), (await hash()).startsWith('#/trends/') && (await focusIsHeading())))
await step('Detail → Generate production plan, focus on the plan heading', async () => (await tabTo('Generate production plan')) && (await press('Enter'), await sleep(1700), (await hash()).startsWith('#/plan/') && (await evaluate("document.activeElement.id === 'plan-title'"))))

if (phone) {
  await step('Editor (phone) → Ask opens the notes sheet as a dialog, focus inside', async () => {
    if (!(await tabTo('Ask ShowStop', { back: true }))) return false
    await press('Enter'); await sleep(500)
    return (await inDialog()) && evaluate("document.querySelector('.assistant').getAttribute('aria-modal') === 'true'")
  })
  await step('Sheet: Tab stays inside the sheet', async () => {
    for (let i = 0; i < 12; i++) { await press('Tab'); if (!(await inDialog())) { issues.push('focus left the open sheet'); return false } }
    return true
  })
}
await step('Editor → answer the assistant with "Not sure", focus kept in the conversation', async () => {
  if (!(await tabTo('Not sure', { max: 40 }))) return false
  await press('Enter'); await sleep(700)
  const kept = await evaluate("!!document.activeElement.closest('.assistant')")
  const added = await evaluate("document.querySelector('#f-nextSteps').value.includes('Find out')")
  const said = await evaluate("document.querySelector('.assistant [role=status]').textContent.startsWith('ShowStop:')")
  if (!kept) issues.push('focus lost after answering (chips removed)')
  if (!said) issues.push('assistant reply not placed in the status region')
  return kept && added && said
})
if (phone) {
  await step('Sheet: Escape closes it and focus returns to Ask', async () => {
    await press('Escape'); await sleep(450)
    return evaluate("!document.querySelector('.assistant.open') && document.activeElement.classList.contains('ask-btn')")
  })
}
await step('Editor → Improve hook: open, Escape closes, focus back on the button', async () => {
  if (!(await tabTo('Improve hook'))) return false
  await press('Enter'); await sleep(200)
  const opened = await evaluate("!!document.querySelector('#hook-menu')")
  await press('Escape'); await sleep(150)
  return opened && evaluate("!document.querySelector('#hook-menu') && document.activeElement.textContent.includes('Improve')")
})
await step('Editor → Improve hook: pick the first option with Tab + Enter', async () => {
  await press('Enter'); await sleep(200)
  await press('Tab'); await press('Enter'); await sleep(250)
  return evaluate("document.querySelector('#f-hook').value.startsWith('\"$1') && document.activeElement.textContent.includes('Improve')")
})
await step('Editor → Tab to the hook field and type', async () => {
  if (!(await tabTo('f-hook', { max: 5 }))) return false
  await send('Input.insertText', { text: ' (kb)' }); await sleep(150)
  return evaluate("document.querySelector('#f-hook').value.endsWith('(kb)') && document.querySelector('.save-state').textContent.includes('Unsaved')")
})
await step('Editor → Save with keyboard (Shift+Tab back to the editor bar)', async () => (await tabTo('Save', { back: true, max: 60 })) && (await press('Enter'), await sleep(300), await evaluate("document.querySelector('.save-state').textContent === 'Saved'")))
await step('Editor → Shoot day, check the first shot with Space', async () => {
  if (!(await tabTo('Shoot day', { max: 40 }))) return false
  await press('Enter'); await sleep(250)
  if (!(await tabTo((d) => d.tag === 'input' && d.id === '', { max: 10 }))) return false
  await press('Space'); await sleep(150)
  return evaluate("document.querySelector('.checklist input').checked")
})
await step('Unsaved guard (in-app link): dialog takes focus, Escape closes, focus returns', async () => {
  const navName = phone ? 'Saved' : 'Saved plans'
  if (!(await tabTo((d) => d.tag === 'a' && d.name === navName, { max: 160 }))) return false
  await press('Enter'); await sleep(300)
  const inside = await inDialog()
  const bgInert = await evaluate("!!document.querySelector('.editor')?.closest('[inert]')")
  await press('Escape'); await sleep(200)
  const closed = await evaluate("!document.querySelector('[role=dialog]')")
  const back = await evaluate(`document.activeElement.tagName === 'A' && document.activeElement.textContent === ${JSON.stringify(navName)}`)
  if (!bgInert) issues.push('background not inert while the guard dialog is open')
  return inside && bgInert && closed && back && (await hash()).startsWith('#/plan/')
})
await step('Unsaved guard (browser Back): dialog opens, Stay keeps the plan', async () => {
  await evaluate('history.back()'); await sleep(600)
  const shown = await inDialog()
  const still = (await hash()).startsWith('#/plan/')
  if (!shown) issues.push('browser Back left the editor without the unsaved-changes dialog')
  if (!(await tabTo('Stay', { max: 5 }))) return false
  await press('Enter'); await sleep(200)
  return shown && still && evaluate("!document.querySelector('[role=dialog]') && !!document.querySelector('#plan-title')")
})
await step('Copy plan reachable and gives feedback (toast or copy dialog)', async () => {
  if (!(await tabTo('Copy plan', { max: 160, back: true }))) return false
  await press('Enter'); await sleep(500)
  const ok = await evaluate("!!document.querySelector('[role=dialog]') || document.querySelector('.toast-region').textContent.includes('Copied')")
  if (await inDialog()) { await press('Escape'); await sleep(150) }
  return ok
})

console.log(`Keyboard walkthrough at ${w}x${h}`)
steps.forEach((s) => console.log('  ' + s))
console.log(issues.length ? `ISSUES (${new Set(issues).size}):\n  ` + [...new Set(issues)].join('\n  ') : 'ISSUES: none')
ws.close(); chrome.kill()
process.exit(0)
