import { samplePlan, trendById } from './data.js'

// Editable plan model. List sections are stored as arrays of strings;
// checklists also keep a "done" set.
export const SECTIONS = [
  { key: 'angle', label: 'Angle', kind: 'text' },
  { key: 'hook', label: 'Hook', kind: 'text' },
  { key: 'keep', label: 'Keep from the trend', kind: 'list' },
  { key: 'twist', label: 'Your twist', kind: 'text' },
  { key: 'structure', label: 'Structure', kind: 'list' },
  { key: 'shots', label: 'Shot list', kind: 'check' },
  { key: 'assets', label: 'Assets to prepare', kind: 'list' },
  { key: 'nextSteps', label: 'Next steps', kind: 'check' },
]

let counter = 0
const newId = () => `plan-${Date.now().toString(36)}-${(counter++).toString(36)}`

export function draftFrom(trendId, creatorId) {
  const src = samplePlan(trendId, creatorId)
  const trend = trendById(trendId)
  if (!src || !trend) return null
  return {
    id: newId(),
    trendId,
    creatorId,
    title: src.angle.split(',')[0].replace(/\.$/, ''),
    angle: src.angle,
    hook: src.hook,
    keep: [...src.keep],
    twist: src.twist,
    structure: [...src.structure],
    shots: [...src.shots],
    assets: [...src.assets],
    nextSteps: [...src.nextSteps],
    done: {},
    hookAlternatives: src.hookAlternatives || [],
    unknowns: trend.fit[creatorId]?.unknowns || [],
    answered: [],
  }
}

export function toPlainText(plan) {
  const trend = trendById(plan.trendId)
  const lines = [plan.title, `From the trend: ${trend?.title || ''} (sample plan, ShowStop demo)`, '']
  for (const s of SECTIONS) {
    lines.push(s.label.toUpperCase())
    const v = plan[s.key]
    if (Array.isArray(v)) v.forEach((item, i) => lines.push(s.kind === 'check' ? `[${plan.done?.[`${s.key}:${i}`] ? 'x' : ' '}] ${item}` : `- ${item}`))
    else lines.push(v)
    lines.push('')
  }
  return lines.join('\n').trim()
}
