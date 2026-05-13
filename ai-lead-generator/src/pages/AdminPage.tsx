import { useState, useEffect } from 'react'
import { adminAPI } from '../api/admin'

interface Stats { total_users: number; active_users: number; total_leads: number; leads_by_status: Record<string, number> }

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    adminAPI.getStats().then(setStats)
    adminAPI.listUsers().then(res => setUsers(res.users))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">管理后台</h1>
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-500">总用户</p><p className="text-2xl font-bold">{stats.total_users}</p></div>
          <div className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-500">活跃用户</p><p className="text-2xl font-bold">{stats.active_users}</p></div>
          <div className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-500">总线索</p><p className="text-2xl font-bold">{stats.total_leads}</p></div>
          <div className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-500">状态分布</p><p className="text-xs">{JSON.stringify(stats.leads_by_status)}</p></div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(u => (
              <tr key={u.id}>
                <td className="px-6 py-4"><div className="font-medium">{u.name}</div><div className="text-sm text-gray-500">{u.email}</div></td>
                <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">{u.role}</span></td>
                <td className="px-6 py-4">{u.is_active ? '✅ 活跃' : '❌ 禁用'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
