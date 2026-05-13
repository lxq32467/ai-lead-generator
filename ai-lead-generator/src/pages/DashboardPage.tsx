import { useState, useEffect } from 'react'
import { leadsAPI } from '../api/leads'
import { Lead } from '../types'

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const loadLeads = async () => {
    try {
      const res = await leadsAPI.list({ status: statusFilter || undefined })
      setLeads(res.leads)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadLeads() }, [statusFilter])

  const handleSearch = async () => {
    if (!keyword.trim()) return
    setSearching(true)
    try {
      const res = await leadsAPI.search(keyword)
      setLeads(res.leads)
    } catch (err) { console.error(err) }
    finally { setSearching(false) }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await leadsAPI.update(id, { status })
      loadLeads()
    } catch (err) { console.error(err) }
  }

  const handleGenerateSuggestion = async (id: string) => {
    try {
      await leadsAPI.generateSuggestion(id)
      loadLeads()
    } catch (err) { console.error(err) }
  }

  const handleExport = async () => {
    try {
      const res = await leadsAPI.export()
      const blob = new Blob([res], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'leads.csv'; a.click()
    } catch (err) { console.error(err) }
  }

  return (
    <div>
      {/* Search Bar */}
      <div className="flex gap-4 mb-6">
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="输入行业/关键词搜索线索..." className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        <button onClick={handleSearch} disabled={searching}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {searching ? '搜索中...' : '搜索线索'}
        </button>
        <button onClick={handleExport} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">导出CSV</button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['', 'new', 'interested', 'contacted', 'not-interested'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s || '全部'}
          </button>
        ))}
      </div>

      {/* Lead Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">公司</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">行业</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">联系人</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leads.map(lead => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{lead.company_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{lead.industry}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{lead.contact_name}<br/><span className="text-xs">{lead.contact_email}</span></td>
                  <td className="px-6 py-4">
                    <select value={lead.status} onChange={e => handleStatusChange(lead.id, e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1">
                      <option value="new">新线索</option>
                      <option value="interested">感兴趣</option>
                      <option value="contacted">已联系</option>
                      <option value="not-interested">无意向</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleGenerateSuggestion(lead.id)}
                      className="text-sm text-blue-600 hover:text-blue-800">AI建议</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
