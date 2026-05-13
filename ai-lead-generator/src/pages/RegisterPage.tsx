import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../api/auth'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'sales' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authAPI.register(form)
      navigate('/login')
    } catch (err: any) {
      setError(err.response?.data?.detail || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <h2 className="text-center text-3xl font-bold text-gray-900">注册账号</h2>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700">姓名</label>
            <input type="text" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">邮箱</label>
            <input type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">密码</label>
            <input type="password" required minLength={6} value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {loading ? '注册中...' : '注册'}
          </button>
          <p className="text-center text-sm text-gray-600">
            已有账号？<Link to="/login" className="text-blue-600">登录</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
