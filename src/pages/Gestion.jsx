import React, { useState, useEffect } from 'react'
import { getCommunes, getEtablissements } from '../api'

const API = 'https://haccp3-0-backend.vercel.app';

export default function Gestion({ auth, onRefreshAuth }) {
  const [communes, setCommunes] = useState([]);
  const [openCommune, setOpenCommune] = useState(null);
  const [etabs, setEtabs] = useState({});
  const [loading, setLoading] = useState(true);

  const [newCommune, setNewCommune] = useState({ nom: '', ville: '' });
  const [newEtab, setNewEtab] = useState({ nom: '', adresse: '', communeId: '' });
  const [showAddCommune, setShowAddCommune] = useState(false);
  const [showAddEtab, setShowAddEtab] = useState(null);
  const [editCommune, setEditCommune] = useState(null);
  const [editEtab, setEditEtab] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePw, setDeletePw] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    const res = await getCommunes(auth.token);
    if (res.result) {
      setCommunes(res.communes);
      const etabMap = {};
      for (const c of res.communes) {
        const eRes = await getEtablissements(auth.token, c._id);
        if (eRes.result) etabMap[c._id] = eRes.etablissements;
      }
      setEtabs(etabMap);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const addCommune = async () => {
    if (!newCommune.nom || !newCommune.ville) return alert('Nom et ville requis');
    const res = await fetch(`${API}/admin/communes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(newCommune),
    }).then(r => r.json());
    if (res.result) { setNewCommune({ nom: '', ville: '' }); setShowAddCommune(false); if (onRefreshAuth) await onRefreshAuth(); fetchAll(); }
    else alert(res.error);
  };

  const deleteCommune = (id, nom) => setDeleteTarget({ type: 'commune', id, nom });
  const deleteEtabAction = (id, nom) => setDeleteTarget({ type: 'etab', id, nom });

  const confirmDelete = async () => {
    if (!deletePw) return;
    const verify = await fetch(`${API}/auth/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ password: deletePw }),
    }).then(r => r.json());
    if (!verify.result) { alert('Mot de passe incorrect'); return; }
    const url = deleteTarget.type === 'commune' ? `${API}/admin/communes/${deleteTarget.id}` : `${API}/admin/etablissements/${deleteTarget.id}`;
    await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } });
    setDeleteTarget(null); setDeletePw('');
    if (onRefreshAuth) await onRefreshAuth();
    fetchAll();
  };

  const updateCommune = async (id, data) => {
    await fetch(`${API}/admin/communes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(data),
    });
    setEditCommune(null); fetchAll();
  };

  const updateEtab = async (id, data) => {
    await fetch(`${API}/admin/etablissements/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(data),
    });
    setEditEtab(null); fetchAll();
  };

  const addEtab = async (communeId) => {
    if (!newEtab.nom) return alert('Nom requis');
    const res = await fetch(`${API}/admin/etablissements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ ...newEtab, communeId }),
    }).then(r => r.json());
    if (res.result) { setNewEtab({ nom: '', adresse: '', communeId: '' }); setShowAddEtab(null); if (onRefreshAuth) await onRefreshAuth(); fetchAll(); }
    else alert(res.error);
  };

  const deleteEtab = (id, nom) => deleteEtabAction(id, nom);

  return (
    <div>
      <div className="page-header">
        <h1>Gestion des communes</h1>
        <button className="btn btn-green" onClick={() => setShowAddCommune(true)}>+ Nouvelle commune</button>
      </div>

      {showAddCommune && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header" style={{ background: 'var(--green)' }}>Nouvelle commune</div>
          <div className="card-body" style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Nom</label>
              <input value={newCommune.nom} onChange={e => setNewCommune(p => ({ ...p, nom: e.target.value }))} placeholder="Ex: Commune de Mont Saint Aignan" style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', width: '250px' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Ville</label>
              <input value={newCommune.ville} onChange={e => setNewCommune(p => ({ ...p, ville: e.target.value }))} placeholder="Ex: Mont Saint Aignan" style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', width: '200px' }} />
            </div>
            <button className="btn btn-green" onClick={addCommune}>Créer</button>
            <button className="btn btn-outline" onClick={() => setShowAddCommune(false)}>Annuler</button>
          </div>
        </div>
      )}

      {loading ? <p>Chargement...</p> : communes.map(c => {
        const isOpen = openCommune === c._id;
        const communeEtabs = etabs[c._id] || [];
        return (
          <div key={c._id} style={{ marginBottom: '12px' }}>
            <div
              onClick={() => setOpenCommune(isOpen ? null : c._id)}
              style={{
                background: 'var(--green)', color: '#fff', padding: '14px 20px',
                borderRadius: isOpen ? '14px 14px 0 0' : '14px',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontWeight: '700', fontSize: '16px',
              }}
            >
              <span>🏛️ {c.nom}</span>
              <span style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 10px', borderRadius: '10px' }}>{communeEtabs.length} cantine{communeEtabs.length > 1 ? 's' : ''}</span>
                <span>{isOpen ? '▲' : '▼'}</span>
              </span>
            </div>

            {isOpen && (
              <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', padding: '16px', border: '1px solid #e0e0e0', borderTop: 'none' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Ville : <strong>{c.ville}</strong></span>
                  {c.numAgrement && <span>N° agrément : <strong>{c.numAgrement}</strong></span>}
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Établissement</th>
                      <th>Adresse</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {communeEtabs.map(et => (
                      <tr key={et._id}>
                        <td><strong>{et.nom}</strong></td>
                        <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{et.adresse || '—'}</td>
                        <td style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditEtab({ _id: et._id, nom: et.nom, adresse: et.adresse || '' })}>Modifier</button>
                          <button className="btn btn-red btn-sm" onClick={() => deleteEtab(et._id, et.nom)}>Supprimer</button>
                        </td>
                      </tr>
                    ))}
                    {communeEtabs.length === 0 && (
                      <tr><td colSpan={3} style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Aucun établissement</td></tr>
                    )}
                  </tbody>
                </table>

                {showAddEtab === c._id ? (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <input value={newEtab.nom} onChange={e => setNewEtab(p => ({ ...p, nom: e.target.value }))} placeholder="Nom de l'établissement" style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', flex: 1 }} />
                    <input value={newEtab.adresse} onChange={e => setNewEtab(p => ({ ...p, adresse: e.target.value }))} placeholder="Adresse (optionnel)" style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', flex: 1 }} />
                    <button className="btn btn-green" onClick={() => addEtab(c._id)}>Ajouter</button>
                    <button className="btn btn-outline" onClick={() => setShowAddEtab(null)}>Annuler</button>
                  </div>
                ) : (
                  <button className="btn btn-outline" style={{ marginTop: '12px' }} onClick={() => { setShowAddEtab(c._id); setNewEtab({ nom: '', adresse: '', communeId: '' }); }}>+ Ajouter un établissement</button>
                )}

                <div style={{ marginTop: '16px', borderTop: '1px solid #f0f0f0', paddingTop: '12px', display: 'flex', gap: '8px' }}>
                  <button className="btn btn-outline" onClick={() => setEditCommune({ _id: c._id, nom: c.nom, ville: c.ville || '' })}>Modifier la commune</button>
                  <button className="btn btn-red" onClick={() => deleteCommune(c._id, c.nom)}>Supprimer cette commune</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Modale modifier commune */}
      {editCommune && (
        <div className="modal-overlay" onClick={() => setEditCommune(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>Modifier la commune</h2>
            <label>Nom</label>
            <input value={editCommune.nom} onChange={e => setEditCommune(p => ({ ...p, nom: e.target.value }))} />
            <label>Ville</label>
            <input value={editCommune.ville} onChange={e => setEditCommune(p => ({ ...p, ville: e.target.value }))} />
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setEditCommune(null)}>Annuler</button>
              <button className="btn btn-green" onClick={() => updateCommune(editCommune._id, { nom: editCommune.nom, ville: editCommune.ville })}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale modifier établissement */}
      {editEtab && (
        <div className="modal-overlay" onClick={() => setEditEtab(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>Modifier l'établissement</h2>
            <label>Nom</label>
            <input value={editEtab.nom} onChange={e => setEditEtab(p => ({ ...p, nom: e.target.value }))} />
            <label>Adresse</label>
            <input value={editEtab.adresse} onChange={e => setEditEtab(p => ({ ...p, adresse: e.target.value }))} />
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setEditEtab(null)}>Annuler</button>
              <button className="btn btn-green" onClick={() => updateEtab(editEtab._id, { nom: editEtab.nom, adresse: editEtab.adresse })}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale suppression avec mot de passe */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => { setDeleteTarget(null); setDeletePw(''); }}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'var(--red)' }}>⚠️ Suppression</h2>
            <p style={{ fontSize: '14px', marginBottom: '12px' }}>
              Vous allez supprimer <strong>"{deleteTarget.nom}"</strong>
              {deleteTarget.type === 'commune' ? ' et tous ses établissements, équipements et données' : ' et toutes ses données'}.
              <br /><strong>Cette action est irréversible.</strong>
            </p>
            <label>Mot de passe administrateur</label>
            <input type="password" value={deletePw} onChange={e => setDeletePw(e.target.value)} placeholder="Saisissez votre mot de passe" />
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => { setDeleteTarget(null); setDeletePw(''); }}>Annuler</button>
              <button className="btn btn-red" onClick={confirmDelete}>Confirmer la suppression</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
