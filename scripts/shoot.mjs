// Screenshot helper for design-iteration records (no dependencies).
// Usage: node scripts/shoot.mjs <outDir> <width>x<height>[@dpr] <name>=<url> [<name>=<url> ...]
// Launches headless Chrome with real device-metrics emulation, so phone widths
// below Chrome's minimum window size render correctly.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const [outDir, size, ...pairs] = process.argv.slice(2)
const [, w, h, dpr = '1'] = size.match(/^(\d+)x(\d+)(?:@(\d+))?$/)
const mobile = Number(w) < 768
mkdirSync(outDir, { recursive: true })

const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'shoot-'))
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function target() {
  for (let i = 0; i < 50; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const t = list.find((x) => x.type === 'page'); if (t) return t } catch { /* not up yet */ }
    await sleep(200)
  }
  throw new Error('Chrome did not start')
}

const t = await target()
const ws = new WebSocket(t.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: Number(dpr), mobile })
if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true })
for (const pair of pairs) {
  const i = pair.indexOf('=')
  const name = pair.slice(0, i), url = pair.slice(i + 1)
  const [u, sel] = url.split('|') // optional "|<css selector>" scrolls that element to the top
  await send('Page.navigate', { url: u })
  await sleep(2200) // fonts, sample "generation" wait and entry motion
  if (sel) { await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({block:'start'})` }); await sleep(400) }
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(r.result.data, 'base64'))
  console.log('saved', name)
}
ws.close()
chrome.kill()
