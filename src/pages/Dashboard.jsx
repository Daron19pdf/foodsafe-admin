import React, { useState } from 'react'
import Overview from './Overview'
import Users from './Users'
import History from './History'
const PAGES = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
  { id: 'history', label: 'Historique HACCP', icon: '📋' },
  { id: 'users', label: 'Utilisateurs', icon: '👥' },
];

export default function Dashboard({ auth, onLogout }) {
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
        </nav>

        <div className="sidebar-logout">
          <button onClick={onLogout}>Déconnexion</button>
        </div>
      </aside>

      <main className="main-content">
        {page === 'overview' && <Overview auth={auth} onNavigate={(p, etabId) => { setOpenEtabId(etabId || null); setPage(p); }} />}
        {page === 'history' && <History auth={auth} openEtabId={openEtabId} />}
        {page === 'users' && <Users auth={auth} etab={auth.etablissements?.[0]} />}
      </main>
    </div>
  );
}
