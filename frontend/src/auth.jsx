import { useState } from 'react';
import { LogIn, UserPlus, Wallet } from 'lucide-react';

export default function Auth({ onLoginSuccess }) {
  const [authMode, setAuthMode] = useState(null); // null, 'login', or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !password) {
      setMessage('❌ Username and password required');
      return;
    }

    if (password.length < 6) {
      setMessage('❌ Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('✅ Registration successful! Now try logging in.');
        setUsername('');
        setPassword('');
        setTimeout(() => setAuthMode('login'), 1500);
      } else {
        setMessage('❌ ' + data.error);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!username || !password) {
      setMessage('❌ Username and password required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        onLoginSuccess(username);
      } else {
        setMessage('❌ ' + data.error);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setAuthMode(null);
    setUsername('');
    setPassword('');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{animationDelay: '2s'}}></div>

      <div className="w-full max-w-md relative z-10">
        {/* Main Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-slate-700/50">
          {/* Logo & Header */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-3 rounded-lg">
                <Wallet size={32} className="text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Expense Splitter</h1>
            <p className="text-slate-400">Split expenses with friends effortlessly</p>
          </div>

          {/* Initial Choice Buttons */}
          {authMode === null && (
            <div className="space-y-3">
              <button
                onClick={() => {
                  setAuthMode('register');
                  setMessage('');
                }}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 rounded-lg font-semibold transition shadow-lg flex items-center justify-center gap-2"
              >
                <UserPlus size={20} /> Register
              </button>
              <button
                onClick={() => {
                  setAuthMode('login');
                  setMessage('');
                }}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 rounded-lg font-semibold transition shadow-lg flex items-center justify-center gap-2"
              >
                <LogIn size={20} /> Login
              </button>
            </div>
          )}

          {/* Form - Only show after mode selected */}
          {authMode !== null && (
            <>
              {/* Header for selected mode */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                  {authMode === 'register' ? (
                    <>
                      <UserPlus size={24} /> Register
                    </>
                  ) : (
                    <>
                      <LogIn size={24} /> Login
                    </>
                  )}
                </h2>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (authMode === 'login' ? handleLogin() : handleRegister())}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (authMode === 'login' ? handleLogin() : handleRegister())}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={authMode === 'login' ? handleLogin : handleRegister}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mb-4"
              >
                {loading ? 'Loading...' : authMode === 'login' ? 'Login' : 'Register'}
              </button>

              {/* Back Button */}
              <button
                onClick={resetForm}
                disabled={loading}
                className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-200 py-3 rounded-lg font-semibold transition disabled:opacity-50 border border-slate-600/50"
              >
                Back
              </button>
            </>
          )}

          {/* Message */}
          {message && (
            <div className={`p-4 rounded-lg text-sm font-semibold mt-6 ${
              message.includes('✅')
                ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                : 'bg-red-500/20 text-red-300 border border-red-500/50'
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 text-xs mt-6">
          Backend: http://localhost:5000
        </p>
      </div>
    </div>
  );
}