import React, { useState } from 'react'
import Overview from './Overview'
import Users from './Users'
import History from './History'
import Gestion from './Gestion'
const PAGES = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
  { id: 'history', label: 'Historique HACCP', icon: '📋' },
  { id: 'users', label: 'Utilisateurs', icon: '👥' },
];

export default function Dashboard({ auth, onLogout, onRefreshAuth }) {
  const [page, setPage] = useState('overview');
  const [openEtabId, setOpenEtabId] = useState(null);
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>FoodSafe</h2>
          <span>ADMINISTRATION</span>
        </div>
        <div className="sidebar-user">
          {auth.prenom} {auth.nom}
          <br />
          <small style={{ opacity: 0.6 }}>
            {auth.role === 'superAdmin' ? 'Super Admin' : 'Chef de service'}
          </small>
        </div>

        <nav className="sidebar-nav">
          {PAGES.map(p => (
            <a
              key={p.id}
              className={page === p.id ? 'active' : ''}
              onClick={() => setPage(p.id)}
              href="#"
            >
              <span>{p.icon}</span> {p.label}
            </a>
          ))}
          {auth.role === 'superAdmin' && (
            <a className={page === 'gestion' ? 'active' : ''} onClick={() => setPage('gestion')} href="#">
              <span>🏛️</span> Gestion
            </a>
          )}
        </nav>

        <div className="sidebar-logout">
          <button onClick={onLogout}>Déconnexion</button>
        </div>
      </aside>

      <main className="main-content">
        {page === 'overview' && <Overview auth={auth} onNavigate={(p, etabId) => { setOpenEtabId(etabId || null); setPage(p); }} />}
        {page === 'history' && <History auth={auth} openEtabId={openEtabId} />}
        {page === 'users' && <Users auth={auth} etab={auth.etablissements?.[0]} />}
        {page === 'gestion' && <Gestion auth={auth} onRefreshAuth={onRefreshAuth} />}
      </main>
    </div>
  );
}
