import React, { useState, useEffect } from 'react'
import { getSaveData } from '../api'

const SECTIONS = [
  { type: 'label',            label: 'Étiquettes produits',     color: '#C7793A' },
  { type: 'tempFridge',       label: 'Relevé frigo',            color: '#4A90D9' },
  { type: 'tempCuisson',      label: 'Fin de cuisson',          color: '#E8855A' },
  { type: 'cellule',          label: 'Cellule refroidissement', color: '#0097A7' },
  { type: 'tempService',      label: 'Contrôle au service',     color: '#C49A3C' },
  { type: 'controleReception',label: 'Réception marchandise',   color: '#2D6A4F' },
  { type: 'livraison',        label: 'Départ / Arrivée',        color: '#689F38' },
  { type: 'cleaning',         label: 'Plan de nettoyage',       color: '#26A69A' },
  { type: 'nettoyageCamion',  label: 'Nettoyage camion',        color: '#546E7A' },
  { type: 'oilTest',          label: 'Test huile',              color: '#A0742D' },
  { type: 'etalonnage',       label: 'Étalonnage sonde',        color: '#5C6BC0' },
  { type: 'nonConformite',    label: 'Non-conformités',         color: '#E05C5C' },
];

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function who(entry) {
  if (!entry.createdBy) return '—';
  return `${entry.createdBy.prenom} ${entry.createdBy.nom}`;
}

function hasNC(entry) {
  if (entry.type === 'nonConformite') return true;
  if (entry.data?.conforme === false) return true;
  const keys = ['dataTemp', 'dataCuisson', 'dataCellule', 'dataService', 'dataLivraison', 'dataOil', 'dataEtalonnage'];
  for (const k of keys) {
    if (Array.isArray(entry.data?.[k]) && entry.data[k].some(i => i.conforme === false)) return true;
  }
  return false;
}

function renderItems(entry) {
  const d = entry.data;
  if (!d) return null;

  const items = d.dataTemp || d.dataCuisson || d.dataCellule || d.dataService || d.dataLivraison || d.dataOil || d.dataEtalonnage;

  if (Array.isArray(items)) {
    return (
      <table style={{ tableLayout: 'fixed', width: '100%' }}>
        <colgroup>
          <col style={{ width: '25%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '30%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Élément</th>
            <th>Valeur</th>
            <th>Détail</th>
            <th>Conf.</th>
            <th>Observation</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className={item.conforme === false ? 'nc-row' : ''}>
              <td>{item.plat || item.fridge || item.friteuse || item.sonde || item.produit || '—'}</td>
              <td><strong>{item.temperature || item.tpc || item.mesure || item.tempEntree || '—'}</strong></td>
              <td style={{ fontSize: '12px' }}>{item.period || item.periode || item.direction || item.action || item.duree || '—'}</td>
              <td>
                {item.conforme !== undefined && (
                  <span className={item.conforme ? 'c-badge' : 'nc-badge'}>
                    {item.conforme ? '✅' : '❌'}
                  </span>
                )}
              </td>
              <td style={{ fontSize: '12px', color: '#C7793A', wordBreak: 'break-word' }}>{item.observation || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (entry.type === 'cleaning' && d.cleaning) {
    return (
      <div>
        {Object.entries(d.cleaning).filter(([k]) => k !== 'observation' && k !== '_id').map(([zone, tasks]) => (
          Array.isArray(tasks) && tasks.length > 0 && (
            <div key={zone} style={{ marginBottom: '8px' }}>
              <strong>{zone}</strong>: {tasks.join(', ')}
            </div>
          )
        ))}
        {d.cleaning.observation && <div style={{ color: '#C7793A', fontStyle: 'italic' }}>📝 {d.cleaning.observation}</div>}
      </div>
    );
  }

  if (entry.type === 'nettoyageCamion') {
    return (
      <div>
        <strong>{d.camion || 'Camion'}</strong>
        <div>{(d.items || []).join(', ')}</div>
        {d.observation && <div style={{ color: '#C7793A', fontStyle: 'italic' }}>📝 {d.observation}</div>}
      </div>
    );
  }

  if (entry.type === 'nonConformite') {
    return (
      <div>
        <div><strong style={{ color: 'var(--red)' }}>{d.typeNC}</strong></div>
        <div>{d.produit} — {d.valeur} (seuil : {d.seuil})</div>
        <div>Action : {d.actionCorrective}</div>
        {d.observations && <div style={{ color: '#C7793A', fontStyle: 'italic' }}>📝 {d.observations}</div>}
        {d.responsable && <div style={{ fontSize: '12px' }}>Par : {d.responsable}</div>}
      </div>
    );
  }

  if (entry.type === 'label') {
    const photos = d.photos || [];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {photos.map((p, i) => (
          <a key={i} href={p.url || p} target="_blank" rel="noopener noreferrer">
            <img src={p.url || p} alt={`Photo ${i+1}`} style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #ddd' }} />
          </a>
        ))}
        {photos.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Aucune photo</span>}
      </div>
    );
  }

  if (entry.type === 'controleReception') {
    return (
      <div>
        <div><strong>Fournisseur :</strong> {d.fournisseur}</div>
        <div>Camion : {d.etatCamion} — {d.tempCamion}°C</div>
        {d.photosBL?.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', margin: '8px 0' }}>
            {d.photosBL.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`BL ${i+1}`} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #ddd' }} />
              </a>
            ))}
          </div>
        )}
        {(d.items || []).map((item, i) => (
          <div key={i} style={{ marginLeft: '12px', marginBottom: '6px' }}>
            <div>• <strong>{item.nomProduit || 'Produit'}</strong> — {item.temperature}°C — DLC: {item.dlc}</div>
            {item.photos?.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px', marginLeft: '12px' }}>
                {item.photos.map((url, j) => (
                  <a key={j} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Produit ${i+1}`} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return <pre style={{ fontSize: '11px', overflow: 'auto' }}>{JSON.stringify(d, null, 2)}</pre>;
}

function PhotoViewer({ photos, startIndex, onClose }) {
  const [index, setIndex] = React.useState(startIndex);
  const prev = () => setIndex(i => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex(i => (i + 1) % photos.length);

  React.useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <button onClick={e => { e.stopPropagation(); prev(); }} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '32px', padding: '10px 16px', borderRadius: '50%', cursor: 'pointer' }}>‹</button>
      <div onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <img src={photos[index]} alt="" style={{ maxHeight: '80vh', maxWidth: '85vw', borderRadius: '12px', objectFit: 'contain' }} />
        <div style={{ color: 'white', marginTop: '12px', fontSize: '14px' }}>{index + 1} / {photos.length}</div>
      </div>
      <button onClick={e => { e.stopPropagation(); next(); }} style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '32px', padding: '10px 16px', borderRadius: '50%', cursor: 'pointer' }}>›</button>
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer' }}>✕</button>
    </div>
  );
}

export default function History({ auth, etab }) {
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openSections, setOpenSections] = useState({});
  const [viewerPhotos, setViewerPhotos] = useState(null);
  const [viewerStart, setViewerStart] = useState(0);

  const fetchData = () => {
    if (!etab?._id) return;
    setLoading(true);
    getSaveData(auth.token, etab._id, startDate, endDate).then(data => {
      setEntries(data.result ? data.data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [etab?._id, startDate, endDate]);

  const entriesByType = (type) => entries.filter(e => e.type === type);

  const renderMerged = (type, list) => {
    if (type === 'label') {
      const allUrls = list.flatMap(e => (e.data?.photos || []).map(p => p.url || p));
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {allUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              onClick={() => { setViewerPhotos(allUrls); setViewerStart(i); }}
              style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer', transition: 'transform 0.15s' }}
              onMouseOver={e => e.target.style.transform = 'scale(1.05)'}
              onMouseOut={e => e.target.style.transform = 'scale(1)'}
            />
          ))}
        </div>
      );
    }

    if (type === 'cleaning') {
      return list.map(entry => (
        <div key={entry._id} style={{ background: 'var(--green-light)', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <span>{fmtDate(entry.createdAt)} à {fmtTime(entry.createdAt)}</span>
            <span>{who(entry)}</span>
          </div>
          {renderItems(entry)}
        </div>
      ));
    }

    if (type === 'nettoyageCamion' || type === 'nonConformite' || type === 'controleReception') {
      return list.map(entry => (
        <div key={entry._id} style={{ background: hasNC(entry) ? '#FFF5F5' : 'var(--green-light)', borderRadius: '10px', padding: '12px', marginBottom: '8px', borderLeft: hasNC(entry) ? '4px solid var(--red)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <span>{fmtDate(entry.createdAt)} à {fmtTime(entry.createdAt)}</span>
            <span>{who(entry)}</span>
          </div>
          {renderItems(entry)}
        </div>
      ));
    }

    // Types avec dataArrays : fusionner dans un seul tableau
    const dataKey = { tempFridge: 'dataTemp', tempCuisson: 'dataCuisson', cellule: 'dataCellule', tempService: 'dataService', livraison: 'dataLivraison', oilTest: 'dataOil', etalonnage: 'dataEtalonnage' }[type];
    if (!dataKey) return null;

    const allRows = list.flatMap(entry =>
      (entry.data?.[dataKey] || []).map(item => ({ ...item, _date: fmtDate(entry.createdAt), _time: fmtTime(entry.createdAt), _by: who(entry) }))
    );

    if (allRows.length === 0) return <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Aucune donnée</p>;

    return (
      <div className="table-wrap">
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Date</th>
              <th>Heure</th>
              <th>Élément</th>
              <th>Valeur</th>
              <th>Détail</th>
              <th>Conf.</th>
              <th>Observation</th>
              <th>Par</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((item, i) => (
              <tr key={i} className={item.conforme === false ? 'nc-row' : ''}>
                <td style={{ fontSize: '12px' }}>{item._date}</td>
                <td style={{ fontSize: '12px' }}>{item._time || item.heure || '—'}</td>
                <td><strong>{item.plat || item.fridge || item.friteuse || item.sonde || item.produit || '—'}</strong></td>
                <td><strong>{item.temperature || item.tpc || item.mesure || item.tempEntree || '—'}</strong></td>
                <td style={{ fontSize: '12px' }}>{item.period || item.periode || item.direction || item.action || item.duree || '—'}</td>
                <td>
                  {item.conforme !== undefined && (
                    <span className={item.conforme ? 'c-badge' : 'nc-badge'}>
                      {item.conforme ? '✅' : '❌'}
                    </span>
                  )}
                </td>
                <td style={{ fontSize: '11px', color: '#C7793A', wordBreak: 'break-word' }}>{item.observation || '—'}</td>
                <td style={{ fontSize: '11px' }}>{item._by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1>Historique HACCP — {etab?.nom || ''}</h1>
      </div>

      <div className="date-bar">
        <label>Du</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} max={today} />
        <label>au</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} max={today} />
        <button className="btn btn-outline" onClick={fetchData}>Actualiser</button>
      </div>

      {loading ? <p>Chargement...</p> : (
        SECTIONS.map(({ type, label, color }) => {
          const list = entriesByType(type);
          const isOpen = openSections[type];
          const ncInSection = list.filter(hasNC).length;
          return (
            <div key={type} className="card" style={{ marginBottom: '12px' }}>
              <div
                className="card-header"
                style={{ background: color, cursor: 'pointer' }}
                onClick={() => setOpenSections(p => ({ ...p, [type]: !p[type] }))}
              >
                {label}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {ncInSection > 0 && (
                    <span style={{ background: 'rgba(255,255,255,0.3)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                      {ncInSection} NC
                    </span>
                  )}
                  <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>
                    {list.length}
                  </span>
                  <span>{isOpen ? '▲' : '▼'}</span>
                </span>
              </div>

              {isOpen && (
                <div className="card-body">
                  {list.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Aucune donnée pour cette période</p>
                  ) : (
                    renderMerged(type, list)
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {viewerPhotos && (
        <PhotoViewer
          photos={viewerPhotos}
          startIndex={viewerStart}
          onClose={() => setViewerPhotos(null)}
        />
      )}
    </div>
  );
}
