// Automated accessibility scan (axe-core, WCAG 2.0/2.1/2.2 A and AA rules).
// Usage: node scripts/a11y.mjs <baseUrl> [<width>x<height>]
// Scans each route, plus interactive states (open menu, dialog, phone sheet).
// Automated rules catch only part of WCAG; manual checks are still needed.
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const AXE = readFileSync(join(dirname(require.resolve('axe-core')), 'axe.min.js'), 'utf8')
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const base = process.argv[2] || 'http://localhost:5173/'
const [w, h] = (process.argv[3] || '1440x900').split('x').map(Number)

const ROUTES = [
  ['landing', '#/', null],
  ['profile', '#/start', null],
  ['signup', '#/signup', null],
  ['signup-consent', '#/signup', "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('TikTok')).click()"],
  ['home', '#/home?as=maya', null],
  ['feed', '#/trends?as=maya', null],
  ['feed-no-match', '#/trends?as=maya', "document.querySelectorAll('.filters input')[2].click(); document.querySelectorAll('.filters input')[6].click()"],
  ['detail', '#/trends/three-ways?as=maya', null],
  ['detail-weak', '#/trends/rate-it-honestly?as=jordan', null],
  ['editor', '#/plan/new/three-ways?as=maya', null],
  ['editor-improve-open', '#/plan/new/three-ways?as=maya', "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Improve')).click()"],
  ['editor-shoot', '#/plan/new/three-ways?as=maya', "[...document.querySelectorAll('.mode-switch button')][1].click()"],
  ['editor-sheet', '#/plan/new/three-ways?as=maya', "document.querySelector('.ask-btn')?.click()"],
  ['editor-failed', '#/plan/new/three-ways?as=maya&fail=1', null],
  ['saved-empty', '#/saved?as=maya', null],
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 9800 + Math.floor(Math.random() * 150)
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'a11y-'))}`, 'about:blank'], { stdio: 'ignore' })
let t
for (let i = 0; i < 50 && !t; i++) { try { t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page') } catch { /* starting */ } await sleep(200) }
const ws = new WebSocket(t.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value

await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
let total = 0
for (const [name, hash, action] of ROUTES) {
  await send('Page.navigate', { url: base + hash })
  await sleep(1800)
  if (action) { await evaluate(action); await sleep(500) }
  const res = await evaluate(`(async () => { ${AXE}; const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] } }); return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0,4).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary||'').split('\\n').slice(1,2).join('')) })) })()`)
  total += res.length
  console.log(`\n[${name}] ${w}x${h}: ${res.length ? res.length + ' violation type(s)' : 'no violations'}`)
  for (const v of res) { console.log(`  - ${v.impact} ${v.id}: ${v.help}`); v.nodes.forEach((n) => console.log(`      ${n}`)) }
}
console.log(`\nTOTAL violation types across routes: ${total}`)
ws.close(); chrome.kill()
