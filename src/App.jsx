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

  const handleRefreshAuth = async () => {
    try {
      const res = await fetch('https://haccp3-0-backend.vercel.app/auth/me', {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const data = await res.json();
      if (data.result) {
        const updated = { ...auth, etablissements: data.etablissements };
        localStorage.setItem('foodsafe_auth', JSON.stringify(updated));
        setAuth(updated);
      }
    } catch {}
  };

  if (!auth) return <Login onLogin={handleLogin} />;
  return <Dashboard auth={auth} onLogout={handleLogout} onRefreshAuth={handleRefreshAuth} />;
}
