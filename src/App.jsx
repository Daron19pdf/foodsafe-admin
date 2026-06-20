import React, { useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('foodsafe_auth');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (data) => {
    localStorage.setItem('foodsafe_auth', JSON.stringify(data));
    setAuth(data);
  };

  const handleLogout = () => {
    localStorage.removeItem('foodsafe_auth');
    setAuth(null);
  };

  if (!auth) return <Login onLogin={handleLogin} />;
  return <Dashboard auth={auth} onLogout={handleLogout} />;
}
