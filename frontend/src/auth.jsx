import { useState } from 'react'
import { LogIn, UserPlus, Wallet } from 'lucide-react'

const API = import.meta.env.VITE_API_BASE //#endregion|| 'http://127.0.0.1:5000'

export default function Auth({ onLoginSuccess }) {
  const [authMode, setAuthMode] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!username || !password) {
      setMessage('❌ Username and password required')
      return
    }
    if (password.length < 6) {
      setMessage('❌ Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`${API}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await response.json()
      if (response.ok) {
        setMessage('✅ Registration successful! Now try logging in.')
        setUsername('')
        setPassword('')
        setTimeout(() => setAuthMode('login'), 1500)
      } else {
        setMessage('❌ ' + data.error)
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message)
    }
    setLoading(false)
  }

  const handleLogin = async () => {
    if (!username || !password) {
      setMessage('❌ Username and password required')
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`${API}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await response.json()
      if (response.ok) {
        onLoginSuccess(username)
      } else {
        setMessage('❌ ' + data.error)
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message)
    }
    setLoading(false)
  }

  const resetForm = () => {
    setAuthMode(null)
    setUsername('')
    setPassword('')
    setMessage('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-blue-900 flex items-center justify-center p-6">
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-700/50 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-3 rounded-lg">
            <Wallet size={40} className="text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">Expense Splitter</h1>
        <p className="text-slate-400 mb-8">Split expenses with friends effortlessly</p>

        {authMode === null && (
          <div className="space-y-4">
            <button
              onClick={() => {
                setAuthMode('register')
                setMessage('')
              }}
              className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition shadow-lg"
            >
              Register
            </button>
            <button
              onClick={() => {
                setAuthMode('login')
                setMessage('')
              }}
              className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition shadow-lg"
            >
              Login
            </button>
          </div>
        )}

        {authMode !== null && (
          <>
            <h2 className="text-2xl font-bold text-white mt-6 mb-4">
              {authMode === 'register' ? 'Register' : 'Login'}
            </h2>
            <div className="space-y-4 mb-6">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) =>
                  e.key === 'Enter' &&
                  (authMode === 'login' ? handleLogin() : handleRegister())
                }
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) =>
                  e.key === 'Enter' &&
                  (authMode === 'login' ? handleLogin() : handleRegister())
                }
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={authMode === 'login' ? handleLogin : handleRegister}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-semibold transition shadow-lg mb-4"
            >
              {loading ? 'Loading...' : authMode === 'login' ? 'Login' : 'Register'}
            </button>
            <button
              onClick={resetForm}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-semibold transition border border-slate-600/50"
            >
              Back
            </button>
          </>
        )}

        {message && (
          <div
            className={`p-3 rounded-lg text-sm font-semibold mt-6 ${
              message.includes('✅')
                ? 'bg-green-500/20 text-green-300'
                : 'bg-red-500/20 text-red-300'
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  )
}