import { useEffect, useRef } from 'react'
import { match, navigate, query, useRoute } from './lib/router.js'
import { activeCreator, chooseSampleCreator, useStore } from './lib/store.js'
import { creatorById } from './lib/data.js'
import { Link, Logo, ToastProvider } from './components/ui.jsx'
import Landing from './screens/Landing.jsx'
import Profile from './screens/Profile.jsx'
import Signup from './screens/Signup.jsx'
import Home from './screens/Home.jsx'
import Feed from './screens/Feed.jsx'
import Detail from './screens/Detail.jsx'
import Editor from './screens/Editor.jsx'
import Saved from './screens/Saved.jsx'

const NAV = [
  { to: '/home', label: 'Home' },
  { to: '/trends', label: 'Trends' },
  { to: '/saved', label: 'Saved plans' },
]

function resolve(fullPath) {
  let m
  const path = fullPath.split('?')[0]
  if (path === '/' || path === '') return { screen: 'landing' }
  if (path.startsWith('/signup')) return { screen: 'signup' }
  if (path.startsWith('/start')) return { screen: 'profile' }
  if (path === '/home') return { screen: 'home', nav: '/home' }
  if (path.split('?')[0] === '/trends') return { screen: 'feed', nav: '/trends' }
  if ((m = match('/trends/:id', path))) return { screen: 'detail', nav: '/trends', params: m }
  if ((m = match('/plan/new/:trendId', path))) return { screen: 'editor', nav: '/trends', params: { ...m, isNew: true } }
  if ((m = match('/plan/:id', path))) return { screen: 'editor', nav: '/saved', params: m }
  if (path === '/saved') return { screen: 'saved', nav: '/saved' }
  return { screen: 'notfound' }
}

function AppShell({ nav, children }) {
  const profile = useStore((s) => s.profile)
  const creator = activeCreator(profile)
  return (
    <div className="has-tabbar">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>
      <header className="appbar">
        <div className="wrap">
          <Logo />
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => <Link key={n.to} to={n.to} aria-current={nav === n.to ? 'page' : undefined}>{n.label}</Link>)}
          </nav>
          <span className="spacer" />
          {creator && (
            <Link to="/start?edit=1" className="profile-chip" aria-label={`${creator.name}, ${creator.niche}. Edit profile`}>
              {creator.name}<span className="niche"> · {creator.niche}</span> ✎
            </Link>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <p className="demo-bar"><span className="wrap" style={{ display: 'block' }}>Demo workspace · sample trends and sample plans · saved in this browser only</span></p>
        <div className="wrap">{children}</div>
      </main>
      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => <Link key={n.to} to={n.to} aria-current={nav === n.to ? 'page' : undefined}>{n.label.replace(' plans', '')}</Link>)}
      </nav>
    </div>
  )
}

export default function App() {
  const path = useRoute()
  const profile = useStore((s) => s.profile)
  const r = resolve(path)

  // Deep link for portfolio visitors: #/home?as=maya opens the dashboard as a sample creator.
  const as = query(path).get('as')
  // Typeface preview for the comparison in 04-UI (e.g. #/home?as=maya&font=figtree).
  // Field-cue preview for the comparison in 04-UI (e.g. &cue=underline). Exploration only.
  const cue = query(path).get('cue')
  useEffect(() => { if (cue) document.documentElement.dataset.cue = cue; else delete document.documentElement.dataset.cue }, [cue])
  const font = query(path).get('font')
  useEffect(() => {
    const FONTS = { jakarta: 'Plus Jakarta Sans', figtree: 'Figtree', dmsans: 'DM Sans', manrope: 'Manrope' }
    const name = FONTS[font]
    if (!name) return
    const id = `font-${font}`
    if (!document.getElementById(id)) {
      const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'
      l.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`
      document.head.appendChild(l)
    }
    document.documentElement.style.setProperty('--font', `"${name}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
  }, [font])
  useEffect(() => { if (as && creatorById(as) && (profile?.kind !== 'sample' || profile.creatorId !== as)) chooseSampleCreator(as) }, [as, profile])

  // Dashboard screens need a profile; send first-time visitors to setup.
  const needsProfile = !profile && !(as && creatorById(as)) && ['home', 'feed', 'detail', 'editor', 'saved'].includes(r.screen)
  const account = useStore((s) => s.account)
  useEffect(() => { if (needsProfile) navigate(account ? '/start' : '/signup') }, [needsProfile, account])

  // Move focus to the page heading on route change, and scroll to top.
  // Not on the first load: focus then starts at the top, so the skip link comes first.
  const lastPath = useRef(null)
  useEffect(() => {
    const first = lastPath.current === null || lastPath.current === path
    lastPath.current = path
    if (first) return
    window.scrollTo(0, 0)
    const t = setTimeout(() => {
      const h = document.querySelector('main h1, .landing h1')
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }) }
    }, 0)
    return () => clearTimeout(t)
  }, [path])

  useEffect(() => {
    const titles = { landing: 'ShowStop demo', profile: 'Set up · ShowStop', home: 'Home · ShowStop', feed: 'Trends · ShowStop', detail: 'Trend · ShowStop', editor: 'Plan · ShowStop', saved: 'Saved plans · ShowStop' }
    document.title = titles[r.screen] || 'ShowStop demo'
  }, [r.screen])

  let body
  if (!profile && ['home', 'feed', 'detail', 'editor', 'saved'].includes(r.screen)) body = null
  else if (r.screen === 'landing') return <ToastProvider><Landing /></ToastProvider>
  else if (r.screen === 'profile') return <ToastProvider><Profile /></ToastProvider>
  else if (r.screen === 'signup') return <ToastProvider><Signup /></ToastProvider>
  else if (r.screen === 'home') body = <Home />
  else if (r.screen === 'feed') body = <Feed />
  else if (r.screen === 'detail') body = <Detail id={r.params.id} />
  else if (r.screen === 'editor') body = <Editor key={path} {...r.params} />
  else if (r.screen === 'saved') body = <Saved />
  else body = <div className="stack"><h1>Page not found</h1><p><Link to="/home">Go to Home</Link></p></div>

  return <ToastProvider><AppShell nav={r.nav}>{body}</AppShell></ToastProvider>
}
