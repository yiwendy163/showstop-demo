import creatorsJson from '../../data/creators.json'
import trendsJson from '../../data/trends.json'
import plansJson from '../../data/plans.json'

export const creators = creatorsJson.creators
export const trends = trendsJson.trends
export const trendMeta = trendsJson.meta
export const planMeta = plansJson.meta

export const STAGES = ['emerging', 'rising', 'peaking', 'fading']
export const FIT_ORDER = { strong: 0, possible: 1, weak: 2 }
export const FIT_LABEL = { strong: 'Strong fit', possible: 'Possible fit', weak: 'Weak fit' }

export const creatorById = (id) => creators.find((c) => c.id === id)
export const trendById = (id) => trends.find((t) => t.id === id)
export const samplePlan = (trendId, creatorId) =>
  plansJson.plans.find((p) => p.trendId === trendId && p.creatorId === creatorId)

export const formats = [...new Set(trends.map((t) => t.format))]

// D3.4: a custom profile uses the closest sample creator's plans.
// Simple keyword match on niche and audience; defaults to Maya.
const JORDAN_WORDS = /home|room|decor|thrift|apartment|rent|interior|makeover|furniture|diy|space/i
export function nearestCreatorId(profile) {
  const text = `${profile.niche || ''} ${profile.audience || ''}`
  return JORDAN_WORDS.test(text) ? 'jordan' : 'maya'
}
