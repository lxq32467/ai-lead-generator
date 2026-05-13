import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { leadsAPI } from '../api/leads'
import { Lead } from '../types'

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    leadsAPI.get(id).then(res => setLead(res.lead)).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-12">加载中...</div>
  if (!lead) return <div className="text-center py-12">线索不存在</div>

  return (
    <div>
      <button onClick={() => navigate('/')} className="text-blue-600 hover:underline mb-4 block">&larr; 返回面板</button>
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">{lead.company_name}</h1>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div><label className="text-sm text-gray-500">行业</label><p>{lead.industry}</p></div>
          <div><label className="text-sm text-gray-500">状态</label><p>{lead.status}</p></div>
          <div><label className="text-sm text-gray-500">联系人</label><p>{lead.contact_name}</p></div>
          <div><label className="text-sm text-gray-500">邮箱</label><p>{lead.contact_email}</p></div>
        </div>
        {lead.ai_suggestion && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-blue-900 mb-2">AI 跟进建议</h2>
            <pre className="text-sm text-blue-800 whitespace-pre-wrap">{lead.ai_suggestion}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
