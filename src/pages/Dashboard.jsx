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
  const [selectedEtab, setSelectedEtab] = useState(
    auth.etablissements?.length > 0 ? auth.etablissements[0] : null
  );

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

        {auth.etablissements?.length > 1 && (
          <div style={{ padding: '8px 20px' }}>
            <select
              value={selectedEtab?._id || ''}
              onChange={e => {
                const etab = auth.etablissements.find(et => et._id === e.target.value);
                setSelectedEtab(etab);
              }}
              style={{
                width: '100%', padding: '8px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '12px',
              }}
            >
              {(() => {
                const communes = {};
                auth.etablissements.forEach(et => {
                  const cName = et.commune?.nom || 'Autre';
                  if (!communes[cName]) communes[cName] = [];
                  communes[cName].push(et);
                });
                return Object.entries(communes).map(([cName, cEtabs]) => (
                  <optgroup key={cName} label={cName} style={{ color: '#333' }}>
                    {cEtabs.map(et => (
                      <option key={et._id} value={et._id} style={{ color: '#333' }}>{et.nom}</option>
                    ))}
                  </optgroup>
                ));
              })()}
            </select>
          </div>
        )}

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
        {page === 'overview' && <Overview auth={auth} etab={selectedEtab} onNavigate={(p, et) => { setSelectedEtab(et); setPage(p); }} />}

        {page === 'history' && <History auth={auth} etab={selectedEtab} onChangeEtab={setSelectedEtab} />}
        {page === 'users' && <Users auth={auth} etab={selectedEtab} />}
      </main>
    </div>
  );
}
