import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8 items-center">
              <Link to="/" className="text-xl font-bold text-blue-600">🎯 LeadGen</Link>
              <Link to="/" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">线索面板</Link>
              {user?.role === 'admin' && (
                <Link to="/admin" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">管理后台</Link>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{user?.name} ({user?.role})</span>
              <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-800">退出</button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
