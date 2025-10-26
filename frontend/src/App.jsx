import { useState } from 'react';
import Auth from './auth';
import Dashboard from './Dashboard';

export default function App() {
  const [user, setUser] = useState(null);

  const handleLoginSuccess = (username) => {
    setUser(username);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return user ? (
    <Dashboard username={user} onLogout={handleLogout} />
  ) : (
    <Auth onLoginSuccess={handleLoginSuccess} />
  );
}