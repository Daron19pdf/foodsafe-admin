import React, { useState, useEffect } from 'react'
import { getUsers, createUser, deleteUser, resetPassword, updateUserRole } from '../api'

const ROLES = {
  agent: { label: 'Agent', badge: 'badge-blue' },
  secondCuisine: { label: 'Second de cuisine', badge: 'badge-green' },
  chefCuisine: { label: 'Chef de cuisine', badge: 'badge-gold' },
  chefService: { label: 'Chef de service', badge: 'badge-purple' },
  superAdmin: { label: 'Super Admin', badge: 'badge-red' },
};

const ROLE_ORDER = ['chefService', 'chefCuisine', 'secondCuisine', 'agent'];

export default function Users({ auth, etab }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showResetPw, setShowResetPw] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [form, setForm] = useState({ nom: '', prenom: '', username: '', password: '', password2: '', role: 'agent', communeEtabId: '' });
  const [openCommunes, setOpenCommunes] = useState({});
  const [usersByCommune, setUsersByCommune] = useState({});

  const sortUsers = (list) => list.sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a.role);
    const ib = ROLE_ORDER.indexOf(b.role);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      if (auth.role === 'superAdmin') {
        const res = await fetch('https://haccp3-0-backend.vercel.app/admin/users-all', {
          headers: { Authorization: `Bearer ${auth.token}` },
        }).then(r => r.json());
        if (res.result) {
          const byCommune = {};
          const allUsers = [];
          res.data.forEach(c => {
            byCommune[c.commune] = sortUsers([...c.users]);
            allUsers.push(...c.users);
          });
          setUsersByCommune(byCommune);
          setUsers(sortUsers(allUsers));
        }
      } else {
        const data = await getUsers(auth.token, etab._id);
        setUsers(sortUsers(data.result ? data.users : []));
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    if (!form.nom || !form.prenom || !form.username || !form.password) return alert('Tous les champs sont requis');
    if (form.password !== form.password2) return alert('Les mots de passe ne correspondent pas');
    const targetEtabId = auth.role === 'superAdmin' ? form.communeEtabId : etab?._id;
    if (!targetEtabId) return alert('Veuillez sélectionner une commune');
    const data = await createUser(auth.token, { ...form, etablissementIds: [targetEtabId] });
    if (data.result) {
      setShowCreate(false);
      setForm({ nom: '', prenom: '', username: '', password: '', password2: '', role: 'agent', communeEtabId: '' });
      fetchUsers();
    } else {
      alert(data.error);
    }
  };

  const handleDelete = async (userId, name) => {
    if (!confirm(`Supprimer ${name} ?`)) return;
    if (!confirm(`Confirmer la suppression définitive de ${name} ?`)) return;
    await deleteUser(auth.token, userId);
    fetchUsers();
  };

  const handleResetPw = async () => {
    if (newPw.length < 6) return alert('Minimum 6 caractères');
    if (newPw !== newPw2) return alert('Les mots de passe ne correspondent pas');
    await resetPassword(auth.token, showResetPw, newPw);
    setShowResetPw(null);
    setNewPw('');
    setNewPw2('');
    alert('Mot de passe modifié');
  };

  const handleRoleChange = async (userId, role) => {
    await updateUserRole(auth.token, userId, role);
    fetchUsers();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Utilisateurs</h1>
        <button className="btn btn-green" onClick={() => setShowCreate(true)}>+ Nouvel utilisateur</button>
      </div>

      {loading ? <p>Chargement...</p> : (() => {
        const communes = {};
        const etabs = auth.etablissements || [];
        etabs.forEach(et => {
          const cName = et.commune?.nom || 'Autre';
          if (!communes[cName]) communes[cName] = [];
          if (!communes[cName].includes(et._id)) communes[cName].push(et._id);
        });
        const multiCommune = Object.keys(communes).length > 1;

        const renderUserTable = (userList) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Identifiant</th>
                  <th>Rôle</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {userList.filter(u => u.role !== 'superAdmin').map(u => (
                  <tr key={u._id}>
                    <td><strong>{u.prenom} {u.nom}</strong></td>
                    <td>{u.username}</td>
                    <td>
                      {(auth.role === 'superAdmin' || auth.role === 'chefService') ? (
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u._id, e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px' }}
                        >
                          {Object.entries(ROLES).filter(([id]) => id !== 'superAdmin').map(([id, r]) => (
                            <option key={id} value={id}>{r.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`badge ${ROLES[u.role]?.badge || 'badge-gray'}`}>
                          {ROLES[u.role]?.label || u.role}
                        </span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => { setShowResetPw(u._id); setNewPw(''); setNewPw2(''); }}>
                        Mot de passe
                      </button>
                      {' '}
                      <button className="btn btn-red btn-sm" onClick={() => handleDelete(u._id, `${u.prenom} ${u.nom}`)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

        const communeNames = Object.keys(usersByCommune);
        return communeNames.length > 1 ? (
          communeNames.map(cName => {
            const isOpen = openCommunes[cName];
            const cUsers = usersByCommune[cName] || [];
            return (
              <div key={cName} style={{ marginBottom: '12px' }}>
                <div onClick={() => setOpenCommunes(p => ({ ...p, [cName]: !p[cName] }))}
                  style={{ background: 'var(--green)', color: '#fff', padding: '14px 20px', borderRadius: isOpen ? '14px 14px 0 0' : '14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '700', fontSize: '16px' }}>
                  <span>🏛️ {cName}</span>
                  <span style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 10px', borderRadius: '10px' }}>{cUsers.filter(u => u.role !== 'superAdmin').length} utilisateur{cUsers.filter(u => u.role !== 'superAdmin').length > 1 ? 's' : ''}</span>
                    <span>{isOpen ? '▲' : '▼'}</span>
                  </span>
                </div>
                {isOpen && <div className="card" style={{ borderRadius: '0 0 14px 14px', borderTop: 'none' }}>{renderUserTable(cUsers)}</div>}
              </div>
            );
          })
        ) : (
          <div className="card">{renderUserTable(users)}</div>
        );
      })()}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            <h2>Nouvel utilisateur</h2>
            <label>Prénom</label>
            <input value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} />
            <label>Nom</label>
            <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
            <label>Identifiant</label>
            <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
            <label>Mot de passe</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <label>Confirmer le mot de passe</label>
            <input type="password" value={form.password2} onChange={e => setForm({ ...form, password2: e.target.value })} />
            {form.password2 && form.password !== form.password2 && (
              <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px' }}>Les mots de passe ne correspondent pas</div>
            )}
            <label>Rôle</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="agent">Agent</option>
              <option value="secondCuisine">Second de cuisine</option>
              {auth.role === 'superAdmin' && <option value="chefCuisine">Chef de cuisine</option>}
              {auth.role === 'superAdmin' && <option value="chefService">Chef de service</option>}
            </select>
            {auth.role === 'superAdmin' && (
              <>
                <label>Commune</label>
                <select value={form.communeEtabId} onChange={e => setForm({ ...form, communeEtabId: e.target.value })}>
                  <option value="">Sélectionner une commune...</option>
                  {(() => {
                    const communes = {};
                    (auth.etablissements || []).forEach(et => {
                      const cName = et.commune?.nom || 'Autre';
                      if (!communes[cName]) communes[cName] = et._id;
                    });
                    return Object.entries(communes).map(([cName, etabId]) => (
                      <option key={etabId} value={etabId}>{cName}</option>
                    ));
                  })()}
                </select>
              </>
            )}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn btn-green" onClick={handleCreate}>Créer</button>
            </div>
          </div>
        </div>
      )}

      {showResetPw && (
        <div className="modal-overlay" onClick={() => setShowResetPw(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>Nouveau mot de passe</h2>
            <label>Mot de passe</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
            <label>Confirmer</label>
            <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} />
            {newPw2 && newPw !== newPw2 && (
              <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px' }}>Les mots de passe ne correspondent pas</div>
            )}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowResetPw(null)}>Annuler</button>
              <button className="btn btn-green" onClick={handleResetPw}>Valider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
