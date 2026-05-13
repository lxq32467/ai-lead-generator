import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'

type Env = { DB: D1Database; DEEPSEEK_API_KEY: string; DEEPSEEK_BASE_URL: string }

const PLAN_LIMITS: Record<string, number> = { free: 10, pro: 200, agency: 1000 }
const PLAN_PRICES: Record<string, Record<string, number>> = {
  free: { usd: 0, eur: 0, gbp: 0 },
  pro: { usd: 29, eur: 25, gbp: 22 },
  agency: { usd: 99, eur: 85, gbp: 79 },
}

const app = new Hono<{ Bindings: Env }>()

// ── Helpers ──
function todayStr() { return new Date().toISOString().slice(0, 10) }

function leadRow(row: any) {
  return {
    id: row.id, business_name: row.business_name, industry: row.industry,
    location: row.location, contact_channel: row.contact_channel, contact_info: row.contact_info,
    lead_score: row.lead_score, buying_intent_reason: row.buying_intent_reason,
    outreach_strategy: row.outreach_strategy, outreach_email: row.outreach_email,
    outreach_instagram: row.outreach_instagram, outreach_linkedin: row.outreach_linkedin,
    best_channel: row.best_channel, lead_category: row.lead_category,
    region_competition_score: row.region_competition_score, source: row.source, status: row.status,
    created_at: row.created_at, updated_at: row.updated_at,
  }
}

function estimateRevenue(score: number, industry: string) {
  const multi: Record<string, number> = { SaaS: 1.5, Fintech: 2.0, Healthcare: 1.8, 'E-commerce': 0.8, Manufacturing: 1.0, Education: 0.6, Technology: 1.3 }
  const m = multi[industry] || 1.0
  const base = 500 + score * 20
  const est = Math.round(base * m)
  return { low: Math.round(est * 0.5), high: Math.round(est * 2.0), estimated: est, currency: 'USD' }
}

// ── AI Service ──
async function callDeepSeek(env: Env, messages: any[], maxTokens = 6000, temp = 0.6) {
  const key = env.DEEPSEEK_API_KEY
  const base = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  if (!key) throw new Error('DEEPSEEK_API_KEY not configured')
  const r = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: maxTokens, temperature: temp }),
  })
  if (!r.ok) throw new Error(`DeepSeek API error: ${r.status}`)
  const d: any = await r.json()
  return d.choices[0].message.content.trim()
}

async function generateLeads(env: Env, keyword: string, industry: string, location: string, limit: number) {
  const prompt = `You are an AI Sales Intelligence system. Generate ${limit} realistic B2B leads for a sales professional targeting "${keyword}" in "${industry}" sector, located in "${location}".

For each lead, output:
- business_name: realistic, real-sounding company name
- industry: specific sub-niche
- location: city/region
- contact_channel: "email" or "linkedin" or "instagram"
- contact_info: realistic email or profile handle
- lead_score: 0-100 buying probability estimate
- buying_intent_reason: 1 sentence WHY they might buy
- outreach_strategy: 1 sentence HOW to approach
- lead_category: "hot" (70+), "warm" (40-69), "cold" (<40)
- region_competition_score: 0-100

Return ONLY strict JSON array. No markdown, no extra text.
[{"business_name":"NexaGrid","industry":"Cloud SaaS","location":"Austin TX","contact_channel":"linkedin","contact_info":"linkedin.com/in/contact","lead_score":82,"buying_intent_reason":"Recently raised Series A","outreach_strategy":"Connect on LinkedIn","lead_category":"hot","region_competition_score":65}]`

  try {
    let content = await callDeepSeek(env, [
      { role: 'system', content: 'You are an AI Sales Intelligence engine that generates verified B2B sales leads. You only return valid JSON.' },
      { role: 'user', content: prompt },
    ], 6000, 0.6)
    if (content.startsWith('```')) content = content.split('\n').slice(1, -1).join('\n')
    return JSON.parse(content).slice(0, limit)
  } catch { return mockLeads(keyword, industry, location, limit) }
}

async function validateLead(env: Env, lead: any) {
  const prompt = `Evaluate if this company is a REALISTIC B2B prospect:
Company: ${lead.business_name}
Industry: ${lead.industry}
Score: ${lead.lead_score}/100
Intent: ${lead.buying_intent_reason}

Criteria: 1. Real-sounding company? 2. Plausible buying intent? 3. Reasonable score?

Return ONLY JSON: {"is_valid": true|false, "adjusted_score": 0-100, "confidence": 0.0-1.0, "rejection_reason": ""}`
  try {
    let content = await callDeepSeek(env, [{ role: 'user', content: prompt }], 256, 0.2)
    if (content.startsWith('```')) content = content.split('\n').slice(1, -1).join('\n')
    return JSON.parse(content)
  } catch { return { is_valid: true, adjusted_score: lead.lead_score || 50, confidence: 0.7, rejection_reason: '' } }
}

async function generateOutreachBatch(env: Env, leads: any[]) {
  const leadsText = leads.map((l: any, i: number) =>
    `Lead ${i + 1}: ${l.business_name} — ${l.industry} — Contact: ${l.contact_info} — Channel: ${l.contact_channel}`).join('\n\n')
  const prompt = `For each lead below, write 3 outreach messages (Email, Instagram DM, LinkedIn) and select the best channel.\n\n${leadsText}\n\nFor each lead, return:\n{"lead_index": 1, "email": "...", "instagram": "...", "linkedin": "...", "best_channel": "email|instagram|linkedin"}\n\nReturn ONLY strict JSON array. No markdown.\n[{"lead_index":1,...}, {"lead_index":2,...}]`
  try {
    let content = await callDeepSeek(env, [{ role: 'user', content: prompt }], 4096, 0.7)
    if (content.startsWith('```')) content = content.split('\n').slice(1, -1).join('\n')
    return JSON.parse(content)
  } catch { return leads.map((l: any) => mockOutreach(l)) }
}

async function generateSuggestion(env: Env, lead: any) {
  const prompt = `Write a 2-3 sentence follow-up strategy for:
Company: ${lead.business_name} | Industry: ${lead.industry}
Score: ${lead.lead_score || 50}/100 | Intent: ${lead.buying_intent_reason}

Output ONLY the strategy text. No JSON, no markdown.`
  try { return await callDeepSeek(env, [{ role: 'user', content: prompt }], 256, 0.5) }
  catch {
    const s = lead.lead_score || 50
    return `Follow up within 48 hours. Score ${s}/100 — ${s > 70 ? 'high priority' : 'standard priority'}.`
  }
}

function calculateFinalScore(initial: number, validation: any) {
  const adj = validation.adjusted_score || initial
  return Math.max(0, Math.min(100, Math.round(initial * 0.6 + adj * 0.4)))
}

function mockLeads(keyword: string, industry: string, location: string, limit: number) {
  const companies = ['TechNova', 'DataFlow', 'CloudPeak', 'SynergyAI', 'ByteCraft', 'QuantumEdge']
  const channels = ['email', 'linkedin', 'instagram']
  return Array.from({ length: limit }, () => {
    const c = companies[Math.floor(Math.random() * companies.length)]
    return {
      business_name: `${c} ${['Labs','Group','Holdings','Ventures'][Math.floor(Math.random() * 4)]}`,
      industry, location,
      contact_channel: channels[Math.floor(Math.random() * 3)],
      contact_info: `contact@${c.toLowerCase()}.com`,
      lead_score: Math.floor(Math.random() * 66) + 30,
      buying_intent_reason: `Growing demand for ${keyword} in ${location}`,
      outreach_strategy: `Approach via ${channels[Math.floor(Math.random() * 3)]}`,
      lead_category: 'warm',
      region_competition_score: Math.floor(Math.random() * 71) + 20,
    }
  })
}

function mockOutreach(lead: any) {
  const name = lead.business_name || 'there'
  return {
    email: `Dear team at ${name},\n\nI've been following your work in ${lead.industry} and see potential for collaboration.\n\nWould you be open to a brief call?\n\nBest regards`,
    instagram: `Hey ${name}! Love what you're building. Would love to connect!`,
    linkedin: `Hi, impressive work at ${name}. I help companies like yours scale. Let's connect!`,
    best_channel: lead.contact_channel || 'email',
  }
}

// ── Usage Middleware ──
async function checkUsage(env: Env, apiKey: string, action: 'lead' | 'message' = 'lead') {
  const db = env.DB
  let user = await db.prepare('SELECT * FROM users WHERE api_key = ?').bind(apiKey).first()
  if (!user) return { allowed: false, error: 'Invalid API key', user: null, limit: 0, used_lead: 0 }
  const today = todayStr()
  if ((user as any).usage_date !== today) {
    await db.prepare('UPDATE users SET daily_lead_count = 0, daily_message_count = 0, usage_date = ? WHERE id = ?').bind(today, (user as any).id).run()
    ;(user as any).daily_lead_count = 0; (user as any).daily_message_count = 0
  }
  const limit = PLAN_LIMITS[(user as any).plan] || 10
  if (action === 'lead' && (user as any).daily_lead_count >= limit) return { allowed: false, error: `Daily lead limit reached (${limit}/${(user as any).plan})`, user, limit, used_lead: (user as any).daily_lead_count }
  await db.prepare(`UPDATE users SET daily_lead_count = daily_lead_count + 1, total_lead_count = total_lead_count + 1 WHERE id = ?`).bind((user as any).id).run()
  return { allowed: true, user, limit, used_lead: (user as any).daily_lead_count + 1 }
}

// ── Routes ──

// POST /api/leads/init
app.post('/api/leads/init', async (c) => {
  const db = c.env.DB
  const id = crypto.randomUUID()
  const apiKey = crypto.randomUUID().replace(/-/g, '')
  await db.prepare('INSERT INTO users (id, api_key, plan, subscription_status, usage_date) VALUES (?, ?, ?, ?, ?)').bind(id, apiKey, 'pro', 'active', todayStr()).run()
  return c.json({ api_key: apiKey, plan: 'pro', message: 'Use this API key in all requests' })
})

// POST /api/leads/generate
app.post('/api/leads/generate', async (c) => {
  const apiKey = c.req.query('api_key') || ''
  const keyword = c.req.query('keyword') || ''
  const industry = c.req.query('industry') || 'Technology'
  const location = c.req.query('location') || 'USA'
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 20)

  if (!keyword.trim()) return c.json({ detail: 'Keyword is required' }, 400)

  const usage = await checkUsage(c.env, apiKey, 'lead')
  if (!usage.allowed) return c.json({ detail: usage.error }, 429)

  const user: any = usage.user

  // Layer 1: Generate
  const leadsData: any[] = await generateLeads(c.env, keyword, industry, location, limit)
  // Batch outreach
  const outreachResults: any[] = await generateOutreachBatch(c.env, leadsData)

  const db = c.env.DB
  const results: any[] = []
  let rejected = 0, totalRevLow = 0, totalRevHigh = 0, highIntent = 0

  for (let i = 0; i < leadsData.length; i++) {
    const ld = leadsData[i]
    const validation: any = await validateLead(c.env, ld)
    if (!validation.is_valid) { rejected++; continue }

    const finalScore = calculateFinalScore(ld.lead_score || 50, validation)
    const category = finalScore >= 70 ? 'hot' : finalScore >= 40 ? 'warm' : 'cold'
    const revenue = estimateRevenue(finalScore, ld.industry || industry)
    const outreach = outreachResults[i] || mockOutreach(ld)
    const suggestion = await generateSuggestion(c.env, { ...ld, lead_score: finalScore })

    const leadId = crypto.randomUUID()
    const now = new Date().toISOString()
    await db.prepare(`INSERT INTO leads (id, user_id, business_name, industry, location, contact_channel, contact_info, lead_score, buying_intent_reason, outreach_strategy, outreach_email, outreach_instagram, outreach_linkedin, best_channel, lead_category, region_competition_score, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      leadId, user.id, ld.business_name, ld.industry || industry, ld.location || location,
      ld.contact_channel || outreach.best_channel || 'email', ld.contact_info || '',
      finalScore, ld.buying_intent_reason || '', ld.outreach_strategy || '',
      outreach.email || '', outreach.instagram || '', outreach.linkedin || '',
      outreach.best_channel || 'email', category, ld.region_competition_score || 50,
      now, now,
    ).run()

    totalRevLow += revenue.low; totalRevHigh += revenue.high
    if (finalScore >= 70) highIntent++

    results.push({
      id: leadId, business_name: ld.business_name, industry: ld.industry || industry,
      location: ld.location || location, contact_channel: ld.contact_channel || outreach.best_channel || 'email',
      contact_info: ld.contact_info || '', lead_score: finalScore,
      buying_intent_reason: ld.buying_intent_reason || '', outreach_strategy: ld.outreach_strategy || '',
      outreach_email: outreach.email || '', outreach_instagram: outreach.instagram || '',
      outreach_linkedin: outreach.linkedin || '', best_channel: outreach.best_channel || 'email',
      lead_category: category, region_competition_score: ld.region_competition_score || 50,
      source: 'ai_generated', status: 'new', created_at: now, updated_at: now,
      revenue_potential: revenue, ai_suggestion: suggestion,
    })
  }

  return c.json({
    leads: results, total: results.length, rejected,
    kpi: {
      total_generated: results.length, high_intent_leads: highIntent,
      estimated_revenue_low: totalRevLow, estimated_revenue_high: totalRevHigh,
      conversion_probability: Math.round((highIntent / Math.max(results.length, 1)) * 100 * 10) / 10,
    },
    usage: { used: usage.used_lead, limit: usage.limit, plan: user.plan },
  })
})

// GET /api/leads/
app.get('/api/leads', async (c) => {
  const apiKey = c.req.query('api_key') || ''
  const page = parseInt(c.req.query('page') || '1')
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
  const category = c.req.query('lead_category') || ''

  const db = c.env.DB
  const user = await db.prepare('SELECT * FROM users WHERE api_key = ?').bind(apiKey).first() as any
  if (!user) return c.json({ detail: 'Invalid API key' }, 404)

  let query = 'SELECT * FROM leads WHERE user_id = ?'
  const params: any[] = [user.id]
  if (category) { query += ' AND lead_category = ?'; params.push(category) }
  const { total } = (await db.prepare(`SELECT COUNT(*) as total FROM (${query})`).bind(...params).first()) as any || { total: 0 }
  const leads = (await db.prepare(`${query} ORDER BY lead_score DESC LIMIT ? OFFSET ?`).bind(...params, limit, (page - 1) * limit).all()).results

  return c.json({ leads: leads.map(leadRow), total })
})

// GET /api/leads/kpi
app.get('/api/leads/kpi', async (c) => {
  const apiKey = c.req.query('api_key') || ''
  const db = c.env.DB
  const user: any = await db.prepare('SELECT * FROM users WHERE api_key = ?').bind(apiKey).first()
  if (!user) return c.json({ detail: 'Invalid API key' }, 404)
  const leads: any[] = (await db.prepare('SELECT * FROM leads WHERE user_id = ?').bind(user.id).all()).results
  const highIntent = leads.filter(l => l.lead_score >= 70)
  const totalRev = highIntent.reduce((s, l) => s + 500 + l.lead_score * 20, 0)
  return c.json({
    leads_today: user.daily_lead_count, total_leads: leads.length,
    high_intent_leads: highIntent.length, estimated_revenue_potential: totalRev,
    conversion_probability: Math.round((highIntent.length / Math.max(leads.length, 1)) * 100 * 10) / 10,
    plan: user.plan, limit: PLAN_LIMITS[user.plan] || 10,
  })
})

// GET /api/leads/:lead_id
app.get('/api/leads/:lead_id', async (c) => {
  const leadId = c.req.param('lead_id')
  const db = c.env.DB
  const lead: any = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first()
  if (!lead) return c.json({ detail: 'Not found' }, 404)
  const revenue = estimateRevenue(lead.lead_score, lead.industry || 'Technology')
  return c.json({ lead: { ...leadRow(lead), revenue_potential: revenue } })
})

// POST /api/leads/export
app.post('/api/leads/export', async (c) => {
  const apiKey = c.req.query('api_key') || ''
  const db = c.env.DB
  const user: any = await db.prepare('SELECT * FROM users WHERE api_key = ?').bind(apiKey).first()
  if (!user) return c.json({ detail: 'Invalid API key' }, 404)
  const leads: any[] = (await db.prepare('SELECT * FROM leads WHERE user_id = ? ORDER BY lead_score DESC').bind(user.id).all()).results
  const header = 'Business,Industry,Location,Channel,Contact,Score,Category,Est. Revenue ($),Buying Intent,Email Outreach,LinkedIn Outreach,Instagram Outreach\n'
  const rows = leads.map(l => {
    const rev = estimateRevenue(l.lead_score, l.industry || '')
    return [l.business_name, l.industry, l.location, l.contact_channel, l.contact_info, l.lead_score, l.lead_category, `$${rev.estimated}`, l.buying_intent_reason, `"${(l.outreach_email || '').replace(/"/g, '""')}"`, `"${(l.outreach_linkedin || '').replace(/"/g, '""')}"`, `"${(l.outreach_instagram || '').replace(/"/g, '""')}"`].join(',')
  }).join('\n')
  return c.text(header + rows, 200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=leads.csv' })
})

// POST /api/subscribe
app.post('/api/subscribe', async (c) => {
  const { plan, currency = 'usd' } = await c.req.json().catch(() => ({ plan: 'free', currency: 'usd' }))
  if (!['free', 'pro', 'agency'].includes(plan)) return c.json({ detail: 'Invalid plan' }, 400)
  const db = c.env.DB
  const id = crypto.randomUUID()
  const apiKey = crypto.randomUUID().replace(/-/g, '')
  await db.prepare('INSERT INTO users (id, api_key, plan, subscription_status, usage_date) VALUES (?,?,?,?,?)').bind(id, apiKey, plan, 'active', todayStr()).run()
  const price = PLAN_PRICES[plan]?.[currency] || 0
  const limit = PLAN_LIMITS[plan] || 10
  return c.json({ user_id: id, api_key: apiKey, plan, currency, price, subscription_status: 'active', limits: { daily_leads: limit }, message: `Subscription active — ${plan.toUpperCase()} plan. Save your API key.` })
})

// GET /api/plans
app.get('/api/plans', (c) => {
  const currency = c.req.query('currency') || 'usd'
  const features: Record<string, string[]> = {
    free: ['10 leads/day', 'Basic outreach messages', 'CSV export'],
    pro: ['200 leads/day', 'Multi-channel outreach (Email + Instagram + LinkedIn)', 'AI lead scoring 0-100', 'Hot/Warm/Cold labels', 'Region competition data', 'CSV export', 'Priority support'],
    agency: ['1,000 leads/day', 'All Pro features', 'API access', 'White-label reports', 'Dedicated support'],
  }
  const plans: any = {}
  for (const p of ['free', 'pro', 'agency']) {
    const sym = currency === 'usd' ? '$' : currency === 'eur' ? '€' : '£'
    plans[p] = { name: p.charAt(0).toUpperCase() + p.slice(1), price: `${sym}${PLAN_PRICES[p]?.[currency] || 0}`, currency, daily_leads: PLAN_LIMITS[p] || 10, features: features[p] }
  }
  return c.json({ plans, supported_currencies: ['usd', 'eur', 'gbp'] })
})

// Stripe endpoints (placeholder)
app.post('/api/create-checkout-session', async (c) => {
  const plan = c.req.query('plan') || ''
  const currency = c.req.query('currency') || 'usd'
  if (!['pro', 'agency'].includes(plan)) return c.json({ detail: 'Checkout only available for Pro and Agency plans' }, 400)
  return c.json({ session_url: `https://checkout.stripe.com/pay/${plan}-${currency}`, plan, currency, amount: PLAN_PRICES[plan]?.[currency] || 29, mode: 'subscription', message: 'Stripe integration ready for production deployment' })
})

app.post('/api/webhook/payment', (c) => c.json({ received: true, status: 'ok' }))
app.get('/api/webhook/payment', (c) => c.json({ status: 'Webhook endpoint ready', version: '2.1.0' }))

// GET /api/usage/:api_key
app.get('/api/usage/:api_key', async (c) => {
  const apiKey = c.req.param('api_key')
  const db = c.env.DB
  const user: any = await db.prepare('SELECT * FROM users WHERE api_key = ?').bind(apiKey).first()
  if (!user) return c.json({ detail: 'User not found' }, 404)
  const today = todayStr()
  if (user.usage_date !== today) {
    await db.prepare('UPDATE users SET daily_lead_count = 0, daily_message_count = 0, usage_date = ? WHERE id = ?').bind(today, user.id).run()
    user.daily_lead_count = 0; user.daily_message_count = 0
  }
  const { total }: any = (await db.prepare('SELECT COUNT(*) as total FROM leads WHERE user_id = ?').bind(user.id).first()) || { total: 0 }
  const limit = PLAN_LIMITS[user.plan] || 10
  return c.json({ plan: user.plan, subscription_status: user.subscription_status, daily: { leads_used: user.daily_lead_count, leads_limit: limit, messages_used: user.daily_message_count, remaining: Math.max(0, limit - user.daily_lead_count) }, total: { leads_generated: total, since: user.created_at } })
})

// GET /api/usage/:api_key/logs
app.get('/api/usage/:api_key/logs', async (c) => {
  const apiKey = c.req.param('api_key')
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
  const db = c.env.DB
  const user: any = await db.prepare('SELECT * FROM users WHERE api_key = ?').bind(apiKey).first()
  if (!user) return c.json({ detail: 'User not found' }, 404)
  const leads: any[] = (await db.prepare('SELECT * FROM leads WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').bind(user.id, limit).all()).results
  return c.json({ logs: leads.map(l => ({ business_name: l.business_name, lead_score: l.lead_score, lead_category: l.lead_category, created_at: l.created_at })) })
})

// A/B Experiments
const EXPERIMENTS: any = {
  pricing_layout: { variants: ['control', 'value_focused', 'social_proof'], traffic_split: [0.34, 0.33, 0.33] },
  cta_copy: { variants: ['start_free_trial', 'get_customers_now', 'see_leads'], traffic_split: [0.50, 0.30, 0.20] },
  landing_hero: { variants: ['revenue_focused', 'growth_focused', 'efficiency_focused'], traffic_split: [0.34, 0.33, 0.33] },
}

function assignVariant(experiment: string, userId: string) {
  const exp = EXPERIMENTS[experiment]
  if (!exp) return { experiment, variant: 'control', error: 'Unknown experiment' }
  const hash = Array.from(new TextEncoder().encode(`${experiment}:${userId}`)).reduce((h, b) => (h * 31 + b) & 0xFFFFFFFF, 0)
  const bucket = Math.abs(hash) % 100
  let cum = 0
  for (let i = 0; i < exp.traffic_split.length; i++) {
    cum += Math.round(exp.traffic_split[i] * 100)
    if (bucket < cum) return { experiment, variant: exp.variants[i], bucket }
  }
  return { experiment, variant: exp.variants[exp.variants.length - 1], bucket }
}

app.get('/api/experiment/variant', (c) => {
  const experiment = c.req.query('experiment') || ''
  const userId = c.req.query('user_id') || ''
  return c.json(assignVariant(experiment, userId))
})

app.post('/api/experiment/track', (c) => {
  const experiment = c.req.query('experiment') || ''
  const variant = c.req.query('variant') || ''
  const userId = c.req.query('user_id') || ''
  const event = c.req.query('event') || ''
  return c.json({ tracked: true, experiment, variant, user_id: userId, event })
})

app.get('/api/experiment/experiments', (c) => c.json({ experiments: EXPERIMENTS }))

// Health
app.get('/api/health', (c) => c.json({ status: 'healthy', version: '2.1.0' }))

export const onRequest = handle(app)
