import { useState, useEffect, useCallback } from 'react'
import { t } from './i18n'

const API = import.meta.env.VITE_API_URL || ''

interface Lead {
  id: string; business_name: string; industry: string; location: string;
  contact_channel: string; contact_info: string; lead_score: number;
  buying_intent_reason: string; outreach_strategy: string;
  outreach_email: string; outreach_instagram: string; outreach_linkedin: string;
  best_channel: string; lead_category: string; region_competition_score: number;
  revenue_potential?: { low: number; high: number; estimated: number; currency: string };
  ai_suggestion?: string;
}
interface KPI { leads_today: number; total_leads: number; high_intent_leads: number; estimated_revenue_potential: number; conversion_probability: number; plan: string; limit: number }
interface Usage { plan: string; daily: { leads_used: number; leads_limit: number; remaining: number; messages_used: number } }
type Page = 'landing' | 'pricing' | 'dashboard' | 'trust'

export default function App() {
  const [page, setPage] = useState<Page>('landing')
  const [apiKey, setApiKey] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [keyword, setKeyword] = useState('')
  const [industry, setIndustry] = useState('Technology')
  const [location, setLocation] = useState('United States')

  // ── Header ──
  const Header = () => (
    <header className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPage('landing')}>
          <span className="text-xl font-bold text-blue-600">{t('app.name')}</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t('app.version')}</span>
        </div>
        <nav className="flex gap-6 text-sm items-center">
          {[
            ['landing', t('common.home')],
            ['pricing', t('common.pricing')],
            ['trust', t('common.trust')],
            ['dashboard', t('common.dashboard')],
          ].map(([p, label]) => (
            <button key={p} onClick={() => p === 'dashboard' && !apiKey ? initAndGo() : setPage(p as Page)}
              className={`${page === p ? 'text-blue-600 font-semibold' : 'text-gray-600'} hover:text-blue-600 transition-colors`}>{label}</button>
          ))}
        </nav>
      </div>
    </header>
  )

  async function initAndGo() {
    if (apiKey) { setPage('dashboard'); return }
    try {
      const r = await fetch(`${API}/api/leads/init`, { method: 'POST' })
      if (r.ok) { const d = await r.json(); setApiKey(d.api_key); setPage('dashboard') }
    } catch (e) { console.error(e) }
  }

  const loadUsage = useCallback(async (key: string) => {
    try {
      const [uR, kR] = await Promise.all([
        fetch(`${API}/api/usage/${key}`),
        fetch(`${API}/api/leads/kpi?api_key=${key}`),
      ])
      if (uR.ok) setUsage(await uR.json())
      if (kR.ok) setKpi(await kR.json())
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { if (apiKey && page === 'dashboard') loadUsage(apiKey) }, [page, apiKey, loadUsage])

  async function handleGenerate() {
    if (!keyword.trim()) return
    setLoading(true); setError('')
    try {
      const p = new URLSearchParams({ api_key: apiKey, keyword, industry, location, limit: '10' })
      const r = await fetch(`${API}/api/leads/generate?${p}`, { method: 'POST' })
      if (!r.ok) { const e = await r.json(); setError(e.detail || 'Generation failed'); return }
      const d = await r.json()
      setLeads(d.leads)
      if (d.kpi) setKpi(d.kpi)
      loadUsage(apiKey)
    } catch { setError(t('errors.network')) }
    finally { setLoading(false) }
  }

  async function loadLeads() {
    const r = await fetch(`${API}/api/leads/?api_key=${apiKey}`)
    if (r.ok) setLeads((await r.json()).leads)
  }

  async function handleExport() {
    const r = await fetch(`${API}/api/leads/export?api_key=${apiKey}`, { method: 'POST' })
    const b = await r.blob(); const url = URL.createObjectURL(b)
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-500">{t('dashboard.search.generating')}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {page === 'landing' && <Landing onCta={() => setPage('pricing')} />}
      {page === 'pricing' && <Pricing onSelectPlan={() => { initAndGo(); setPage('dashboard') }} apiKey={apiKey} />}
      {page === 'trust' && <TrustPage />}
      {page === 'dashboard' && <Dashboard {...{ apiKey, keyword, setKeyword, industry, setIndustry, location, setLocation, leads, usage, kpi, error, handleGenerate, selected, setSelected, loadLeads, handleExport }} />}
      {selected && <DetailModal lead={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════
// Landing Page v2.1
// ═══════════════════════════════════════════════
function Landing({ onCta }: { onCta: () => void }) {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800 text-white">
        <div className="max-w-5xl mx-auto px-4 py-24 text-center">
          <p className="text-blue-200 text-sm font-semibold tracking-wider uppercase mb-4">AI Sales Intelligence Platform</p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">{t('landing.hero.title')}</h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-10">{t('landing.hero.subtitle')}</p>
          <button onClick={onCta} className="px-10 py-4 bg-white text-blue-700 rounded-xl font-bold text-lg hover:bg-blue-50 shadow-2xl transition-transform hover:scale-105">{t('landing.hero.cta')}</button>
          <p className="mt-4 text-blue-200 text-sm">{t('landing.hero.secondary')}</p>
        </div>
      </section>

      {/* Social Proof */}
      <section className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <p className="text-sm text-gray-500 font-semibold tracking-wider uppercase mb-6">{t('landing.social_proof.title')}</p>
          <div className="flex justify-center gap-16">
            {[t('landing.social_proof.stat1'), t('landing.social_proof.stat2'), t('landing.social_proof.stat3')].map(s => (
              <div key={s} className="text-center">
                <p className="text-2xl font-bold text-gray-900">{s.split(' ')[0]}</p>
                <p className="text-sm text-gray-500">{s.slice(s.indexOf(' ') + 1)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem → Solution */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">{t('landing.problem_solution.title')}</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow border-l-4 border-red-400">
              <h3 className="font-bold text-xl mb-3 text-red-600">{t('landing.problem_solution.problem.title')}</h3>
              <p className="text-gray-600 leading-relaxed">{t('landing.problem_solution.problem.desc')}</p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow border-l-4 border-green-400">
              <h3 className="font-bold text-xl mb-3 text-green-600">{t('landing.problem_solution.solution.title')}</h3>
              <p className="text-gray-600 leading-relaxed">{t('landing.problem_solution.solution.desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">{t('landing.features.title')}</h2>
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            {[
              [t('landing.features.scoring.title'), t('landing.features.scoring.desc')],
              [t('landing.features.outreach.title'), t('landing.features.outreach.desc')],
              [t('landing.features.discovery.title'), t('landing.features.discovery.desc')],
            ].map(([title, desc]) => (
              <div key={title} className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
                <h3 className="font-bold text-lg mb-3">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">{t('landing.how_it_works.title')}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">{i}</div>
                <h3 className="font-bold text-lg mb-2">{t(`landing.how_it_works.step${i}.title`)}</h3>
                <p className="text-gray-500 text-sm">{t(`landing.how_it_works.step${i}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-blue-700 text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">{t('landing.bottom_cta.title')}</h2>
          <p className="text-blue-100 mb-8 text-lg">{t('landing.bottom_cta.subtitle')}</p>
          <button onClick={onCta} className="px-10 py-4 bg-white text-blue-700 rounded-xl font-bold text-lg hover:bg-blue-50 shadow-xl transition-transform hover:scale-105">{t('landing.bottom_cta.button')}</button>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <p>&copy; 2026 LeadGen — AI Sales Intelligence Platform. All rights reserved.</p>
      </footer>
    </div>
  )
}

// ═══════════════════════════════════════════════
// Pricing v2.1
// ═══════════════════════════════════════════════
function Pricing({ onSelectPlan, apiKey }: { onSelectPlan: () => void; apiKey: string }) {
  const plans = ['free', 'pro', 'agency'] as const
  const colors: Record<string, string> = { free: 'border-gray-200', pro: 'border-blue-500 ring-4 ring-blue-100', agency: 'border-purple-300' }
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-center mb-4">{t('pricing.title')}</h1>
      <p className="text-center text-gray-500 mb-2">{t('pricing.subtitle')}</p>
      <p className="text-center text-gray-400 text-sm mb-16">{t('pricing.comparison')}</p>
      <div className="grid md:grid-cols-3 gap-8">
        {plans.map(plan => (
          <div key={plan} className={`bg-white rounded-2xl shadow-lg border-2 ${colors[plan]} p-8 relative ${plan === 'pro' ? 'scale-105' : ''}`}>
            {plan === 'pro' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white px-5 py-1 rounded-full text-xs font-bold">BEST VALUE</div>}
            <h3 className="text-xl font-bold mb-2">{t(`pricing.${plan}.name`)}</h3>
            <div className="mb-3"><span className="text-4xl font-bold">{t(`pricing.${plan}.price`)}</span><span className="text-gray-400">/mo</span></div>
            <p className="text-sm text-blue-600 font-semibold mb-4">{t(`pricing.${plan}.leads`)}</p>
            <ul className="space-y-2 mb-8 text-sm text-gray-600">
              {(t(`pricing.${plan}.features`) as unknown as string[]).map((f: string, i: number) => (
                <li key={i} className="flex items-start gap-2"><span className="text-green-500 mt-0.5">&#10003;</span> {f}</li>
              ))}
            </ul>
            {plan === 'agency' ? <div className="w-full py-3 text-center border-2 border-purple-300 rounded-xl font-semibold text-purple-500">{t('pricing.agency.coming_soon')}</div>
              : plan === 'pro' ? (apiKey ? <div className="w-full py-3 text-center bg-green-50 text-green-700 rounded-xl font-semibold">{t('pricing.active')}</div>
                : <button onClick={onSelectPlan} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">{t('pricing.cta_pro')}</button>)
              : <button onClick={onSelectPlan} className="w-full py-3 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-colors">{t('pricing.cta_free')}</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// Trust Page
// ═══════════════════════════════════════════════
function TrustPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-center mb-4">{t('trust.title')}</h1>
      <p className="text-center text-gray-500 mb-16">Transparency in how our AI discovers and scores leads.</p>
      <div className="space-y-8">
        {['section1', 'section2', 'section3'].map(s => (
          <div key={s} className="bg-white rounded-2xl shadow p-8">
            <h3 className="font-bold text-xl mb-3">{t(`trust.${s}.title`)}</h3>
            <p className="text-gray-600 leading-relaxed">{t(`trust.${s}.desc`)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// Dashboard v2.1 — KPI + Revenue Simulation
// ═══════════════════════════════════════════════
function Dashboard(props: any) {
  const { apiKey, keyword, setKeyword, industry, setIndustry, location, setLocation,
    leads, usage, kpi, error, handleGenerate, selected, setSelected, loadLeads, handleExport } = props
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* KPI Cards */}
      {kpi && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: t('dashboard.kpi.leads_today'), value: kpi.leads_today, sub: `/ ${kpi.limit}`, color: 'text-blue-600 bg-blue-50' },
            { label: t('dashboard.kpi.high_intent'), value: kpi.high_intent_leads, sub: `70+ score`, color: 'text-green-600 bg-green-50' },
            { label: t('dashboard.kpi.revenue_potential'), value: `$${(kpi.estimated_revenue_potential || 0).toLocaleString()}`, sub: 'estimated', color: 'text-purple-600 bg-purple-50' },
            { label: t('dashboard.kpi.conversion_rate'), value: `${kpi.conversion_probability}%`, sub: 'of leads are hot', color: 'text-orange-600 bg-orange-50' },
          ].map(k => (
            <div key={k.label} className={`rounded-xl p-5 ${k.color.split(' ')[1]} bg-opacity-50`}>
              <p className="text-xs text-gray-500 mb-1">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color.split(' ')[0]}`}>{k.value}</p>
              <p className="text-xs text-gray-400">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Usage Bar */}
      {usage && (
        <div className="bg-white rounded-xl shadow p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="font-bold">{usage.plan.toUpperCase()}</span>
            <span className="text-xs text-gray-400">{apiKey.slice(0, 16)}...</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm"><strong>{usage.daily.leads_used}/{usage.daily.leads_limit}</strong> <span className="text-gray-400">{t('dashboard.usage_label')}</span></span>
            <div className="w-32 bg-gray-200 rounded-full h-2"><div className="bg-blue-600 rounded-full h-2 transition-all" style={{ width: `${Math.min((usage.daily.leads_used / usage.daily.leads_limit) * 100, 100)}%` }} /></div>
          </div>
        </div>
      )}

      {/* Search + Actions */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex flex-wrap gap-3">
          <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder={t('dashboard.search.keyword_placeholder')}
            className="flex-1 min-w-[200px] px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder={t('dashboard.search.industry_placeholder')} className="w-36 px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('dashboard.search.location_placeholder')} className="w-40 px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={handleGenerate} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-colors">{t('dashboard.search.generate_btn')}</button>
          <button onClick={loadLeads} className="px-4 py-3 border rounded-xl hover:bg-gray-50">{t('dashboard.search.refresh_btn')}</button>
          <button onClick={handleExport} className="px-4 py-3 border rounded-xl hover:bg-gray-50">{t('dashboard.search.export_btn')}</button>
        </div>
        {error && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
      </div>

      {/* Lead Grid with Revenue */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leads.length === 0 ? (
          <div className="col-span-full text-center py-16 text-gray-400">{t('dashboard.empty')}</div>
        ) : leads.map((l: Lead) => (
          <div key={l.id} onClick={() => setSelected(l)}
            className="bg-white rounded-xl shadow p-5 hover:shadow-lg cursor-pointer border-l-4 transition-shadow"
            style={{ borderLeftColor: l.lead_category === 'hot' ? '#ef4444' : l.lead_category === 'warm' ? '#f59e0b' : '#6b7280' }}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-gray-900">{l.business_name}</h3>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${l.lead_category === 'hot' ? 'bg-red-100 text-red-700' : l.lead_category === 'warm' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{l.lead_category}</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">{l.industry} &middot; {l.location}</p>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5"><div className="bg-green-500 rounded-full h-1.5" style={{ width: `${l.lead_score}%` }} /></div>
              <span className="text-xs font-bold text-gray-600">{l.lead_score}</span>
            </div>
            {l.revenue_potential && (
              <p className="text-xs text-green-600 font-medium mb-2">{t('dashboard.card.potential_value')}: ${l.revenue_potential.low} – ${l.revenue_potential.high}</p>
            )}
            <p className="text-xs text-gray-500 line-clamp-2">{l.buying_intent_reason}</p>
            <div className="mt-3 pt-3 border-t flex justify-between items-center text-xs text-gray-400">
              <span>{l.contact_channel}</span>
              <span>{t('dashboard.card.view_details')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// Detail Modal
// ═══════════════════════════════════════════════
function DetailModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold">{lead.business_name}</h2>
            <p className="text-sm text-gray-500">{lead.industry} &middot; {lead.location}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {lead.revenue_potential && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 text-center border border-green-200">
              <p className="text-sm text-green-700 font-semibold">Estimated Deal Value</p>
              <p className="text-3xl font-bold text-green-600">${lead.revenue_potential.low} – ${lead.revenue_potential.high}</p>
              <p className="text-xs text-green-500">Mid: ${lead.revenue_potential.estimated}</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: t('dashboard.detail.lead_score'), value: lead.lead_score, color: 'text-green-600' },
              { label: t('dashboard.detail.category'), value: lead.lead_category?.toUpperCase(), color: 'text-blue-600' },
              { label: t('dashboard.detail.region_competition'), value: lead.region_competition_score, color: 'text-purple-600' },
            ].map(tile => (
              <div key={tile.label} className="bg-gray-50 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${tile.color}`}>{tile.value}</p>
                <p className="text-xs text-gray-500 mt-1">{tile.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-1">{t('dashboard.detail.contact')}</h3>
            <p className="text-sm">{lead.contact_info} <span className="text-xs text-gray-400">{t('dashboard.detail.via')} {lead.contact_channel}</span></p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <h3 className="font-semibold text-sm text-blue-900 mb-1">{t('dashboard.detail.buying_intent')}</h3>
            <p className="text-sm text-blue-800">{lead.buying_intent_reason}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <h3 className="font-semibold text-sm text-green-900 mb-1">{t('dashboard.detail.strategy')}</h3>
            <p className="text-sm text-green-800">{lead.outreach_strategy}</p>
          </div>
          {lead.ai_suggestion && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <h3 className="font-semibold text-sm text-amber-900 mb-1">AI Recommendation</h3>
              <p className="text-sm text-amber-800">{lead.ai_suggestion}</p>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-sm mb-3">{t('dashboard.detail.outreach_messages')} ({t('dashboard.detail.best_channel')}: {lead.best_channel})</h3>
            {[
              { label: t('dashboard.detail.email'), content: lead.outreach_email, color: 'border-blue-200 bg-blue-50' },
              { label: t('dashboard.detail.instagram'), content: lead.outreach_instagram, color: 'border-pink-200 bg-pink-50' },
              { label: t('dashboard.detail.linkedin'), content: lead.outreach_linkedin, color: 'border-indigo-200 bg-indigo-50' },
            ].map(ch => (
              <div key={ch.label} className={`border rounded-xl p-3 mb-2 ${ch.color}`}>
                <p className="text-xs font-semibold mb-1">{ch.label}</p>
                <p className="text-sm whitespace-pre-wrap">{ch.content || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
