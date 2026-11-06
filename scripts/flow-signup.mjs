// Scripted check of the sign-up flow (D17) in an isolated headless Chrome profile.
// Usage: node scripts/flow-signup.mjs [baseUrl]
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const base = process.argv[2] || 'http://localhost:5173/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 9700 + Math.floor(Math.random() * 90)
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'flow-'))}`, 'about:blank'], { stdio: 'ignore' })
let t
for (let i = 0; i < 50 && !t; i++) { try { t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page') } catch { /* starting */ } await sleep(200) }
const ws = new WebSocket(t.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value

const H = `var q=(s)=>document.querySelector(s); var byText=(sel,t)=>[...document.querySelectorAll(sel)].find(e=>e.textContent.includes(t));`
const checks = []
const check = (name, ok, detail = '') => checks.push(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`)

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: base + '#/' }); await sleep(3500)
check('Eyebrow reads "For independent creators"', await ev(`${H} q('.eyebrow')?.textContent === 'For independent creators'`))
check('Header CTA is "Log in" (soft)', await ev(`${H} q('.appbar .btn.soft')?.textContent === 'Log in'`))
await ev(`${H} const ta=q('#hero-prompt'); const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value'); d.set.call(ta,'cheap dinners'); ta.dispatchEvent(new Event('input',{bubbles:true})); ta.form.requestSubmit()`); await sleep(400)
check('Prompt goes to sign-up and keeps the idea', (await ev('location.hash')) === '#/signup?q=cheap%20dinners', await ev('location.hash'))
check('Focus on sign-up heading', await ev(`document.activeElement?.tagName === 'H1'`))
await ev(`${H} byText('button','Continue with TikTok').click()`); await sleep(300)
check('Consent screen for TikTok', await ev(`${H} q('h1')?.textContent.includes('TikTok')`))
await ev(`${H} byText('button','Allow and continue').click()`); await sleep(300)
check('AI step, Continue disabled until a choice', await ev(`${H} q('h1')?.textContent.includes('AI assistant') && [...document.querySelectorAll('button')].find(b=>b.textContent==='Continue').disabled`))
await ev(`${H} q('input[value=claude]').click()`); await sleep(100)
await ev(`${H} [...document.querySelectorAll('button')].find(b=>b.textContent==='Continue').click()`); await sleep(400)
check('Profile keeps the idea', (await ev('location.hash')).startsWith('#/start?q='), await ev('location.hash'))
check('Profile shows simulated account and Claude', await ev(`${H} (byText('p','Signed in with TikTok (simulated)')?.textContent || '').includes('Claude')`))
await ev(`${H} byText('button','Maya').click()`); await sleep(500)
check('Lands on ranked matches', (await ev('location.hash')).startsWith('#/trends?q='), await ev('location.hash'))
await ev(`location.hash='#/plan/new/three-ways'`); await sleep(1500)
check('Editor shows "Send to Claude"', await ev(`${H} !!byText('.editor-bar button','Send to Claude')`))
const st = await ev(`JSON.parse(localStorage.getItem('showstop-demo-v1')).account`)
check('Account stored in this browser only', st?.provider === 'tiktok' && st?.ai === 'claude', JSON.stringify(st))
await ev(`localStorage.clear()`); await send('Page.navigate', { url: base + '#/home?as=maya' }); await sleep(1200)
check('Portfolio deep link still skips sign-up', (await ev('location.hash')).startsWith('#/home'), await ev('location.hash'))

console.log(checks.join('\n'))
ws.close(); chrome.kill()
