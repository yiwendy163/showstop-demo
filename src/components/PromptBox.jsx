import { useEffect, useState } from 'react'
import { navigate } from '../lib/router.js'

const IDEAS = ['cheap dinners my roommates would actually eat', 'something calm I don’t have to talk in', 'a quick makeover for my rental']
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// AI prompt entry (D4.11, D4.13): landing hero and Home. Sends the idea to ranked sample matches.
export function PromptBox({ target = 'trends', label = 'What do you want to film this week?', id = 'hero-prompt' }) {
  const [value, setValue] = useState('')
  const [hint, setHint] = useState(IDEAS[0])
  useEffect(() => {
    if (reduceMotion()) return
    let i = 0
    const t = setInterval(() => { i = (i + 1) % IDEAS.length; setHint(IDEAS[i]) }, 3200)
    return () => clearInterval(t)
  }, [])
  const go = (q) => {
    const idea = (q ?? value).trim()
    if (!idea) { document.getElementById(id)?.focus(); return }
    const enc = encodeURIComponent(idea)
    navigate(target === 'trends' ? `/trends?q=${enc}` : `/${target}?q=${enc}`)
  }
  return (
    <form className="prompt" onSubmit={(e) => { e.preventDefault(); go() }} role="search" aria-label="Find trends for your idea">
      <label htmlFor={id} className="sr-only">{label}</label>
      <textarea id={id} rows={2} value={value} onChange={(e) => setValue(e.target.value)} placeholder={`e.g. ${hint}`}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } }} />
      <div className="prompt-bar">
        <div className="row prompt-chips" aria-label="Example ideas">
          {IDEAS.slice(1).map((i) => <button key={i} type="button" className="chip" onClick={() => go(i)}>{i}</button>)}
        </div>
        <button type="submit" className="btn primary">Find trends</button>
      </div>
    </form>
  )
}

