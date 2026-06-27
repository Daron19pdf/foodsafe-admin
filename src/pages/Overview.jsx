import React, { useState, useEffect } from 'react'
import { getSaveData, getUsers } from '../api'

async function getEquipement(token, etabId) {
  const res = await fetch(`https://haccp3-0-backend.vercel.app/equipement`, {
    headers: { Authorization: `Bearer ${token}`, 'x-etablissement': etabId },
  });
  return res.json();
}

const DAILY_TYPES = [
  { type: 'tempFridge', label: 'Frigo' },
  { type: 'tempCuisson', label: 'Cuisson' },
  { type: 'tempService', label: 'Service' },
  { type: 'cleaning', label: 'Nettoyage' },
];

export default function Overview({ auth, onNavigate }) {
  const [allData, setAllData] = useState({});
  const [allUsers, setAllUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportPreset, setExportPreset] = useState('');
  const [openCommunes, setOpenCommunes] = useState({});

  const [weekData, setWeekData] = useState({});

  const etabs = auth.etablissements || [];

  function getWeekStart(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    return monday.toISOString().split('T')[0];
  }

  function getPrevWeek(dateStr) {
    const ws = new Date(getWeekStart(dateStr));
    ws.setDate(ws.getDate() - 7);
    const end = new Date(ws);
    end.setDate(end.getDate() + 6);
    return { start: ws.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }

  useEffect(() => {
    setLoading(true);
    fetch(`https://haccp3-0-backend.vercel.app/saveData/overview?date=${selectedDate}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then(r => r.json())
      .then(json => {
        if (json.result) {
          const dataMap = {};
          json.data.forEach(r => { dataMap[r.id] = r; });
          setAllData(dataMap);
        }
        setLoading(false);
      })
      .catch(err => { console.error('Overview fetch error:', err); setLoading(false); });
  }, [selectedDate]);

  const countByType = (entries, type) => entries.filter(e => e.type === type).length;

  const entryHasNC = (e) => {
    if (!e || !e.data) return false;
    if (e.type === 'nonConformite') return true;
    if (e.data.conforme === false) return true;
    const keys = ['dataTemp', 'dataCuisson', 'dataCellule', 'dataService', 'dataLivraison', 'dataOil', 'dataEtalonnage'];
    for (const k of keys) {
      if (Array.isArray(e.data[k]) && e.data[k].some(i => i.conforme === false)) return true;
    }
    return false;
  };

  const getNCs = (entries, excludeFiches = false) => {
    const ncs = [];
    entries.forEach(e => {
      const date = new Date(e.createdAt).toLocaleDateString('fr-FR');
      if (e.type === 'nonConformite') {
        if (!excludeFiches) ncs.push({ date, type: e.data?.typeNC || 'NC', produit: e.data?.produit, valeur: e.data?.valeur, action: e.data?.actionCorrective, by: e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '' });
        return;
      }
      const keys = ['dataTemp', 'dataCuisson', 'dataCellule', 'dataService', 'dataLivraison', 'dataOil', 'dataEtalonnage'];
      for (const k of keys) {
        if (Array.isArray(e.data?.[k])) {
          e.data[k].filter(i => i.conforme === false).forEach(item => {
            ncs.push({ date, type: e.type, produit: item.plat || item.fridge || item.friteuse || item.produit || '—', valeur: item.temperature || item.tpc || '', observation: item.observation || '', by: e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '' });
          });
        }
      }
    });
    return ncs;
  };

  const getCleaningStats = (entries, equipement) => {
    try {
      const plan = equipement?.cleaningPlan;
      if (!plan || typeof plan !== 'object') return { done: 0, total: 0 };
      const dailyTasks = new Set();
      for (const [zone, freqs] of Object.entries(plan)) {
        if (zone === '_id' || !freqs || typeof freqs !== 'object') continue;
        const tasks = freqs['Journalier'];
        if (Array.isArray(tasks)) tasks.forEach(t => dailyTasks.add(t));
      }
      let doneCount = 0;
      entries.filter(e => e.type === 'cleaning').forEach(e => {
        const cleaning = e.data?.cleaning;
        if (!cleaning || typeof cleaning !== 'object') return;
        for (const zone in cleaning) {
          if (zone === 'observation' || zone === '_id') continue;
          if (Array.isArray(cleaning[zone])) {
            cleaning[zone].forEach(t => { if (dailyTasks.has(t)) doneCount++; });
          }
        }
      });
      return { done: Math.min(doneCount, dailyTasks.size), total: dailyTasks.size };
    } catch { return { done: 0, total: 0 }; }
  };

  const getFridgeStats = (entries, equipement) => {
    try {
      const frigos = equipement?.frigos || [];
      const total = frigos.length * 2;
      const pairs = new Set();
      entries.filter(e => e.type === 'tempFridge').forEach(e => {
        (e.data?.dataTemp || []).forEach(item => {
          if (item.fridge && item.period) pairs.add(`${item.fridge}__${item.period}`);
        });
      });
      return { done: pairs.size, total: total || 0 };
    } catch { return { done: 0, total: 0 }; }
  };

  const getServiceStats = (entries) => {
    const checks = { debutChaud: false, debutFroid: false, finChaud: false, finFroid: false };
    entries.filter(e => e.type === 'tempService').forEach(e => {
      (e.data?.dataService || []).forEach(item => {
        if (item.periode === 'Début de service' && item.type === 'chaud') checks.debutChaud = true;
        if (item.periode === 'Début de service' && item.type === 'froid') checks.debutFroid = true;
        if (item.periode === 'Fin de service' && item.type === 'chaud') checks.finChaud = true;
        if (item.periode === 'Fin de service' && item.type === 'froid') checks.finFroid = true;
      });
    });
    const done = Object.values(checks).filter(v => v).length;
    return { done, total: 4 };
  };

  const getCuissonStats = (entries) => {
    const count = countByType(entries, 'tempCuisson');
    return { done: count, total: Math.max(count, 1) };
  };

  const getTypeDetail = (type, entries, equipement) => {
    try {
      if (type === 'cleaning') return getCleaningStats(entries, equipement);
      if (type === 'tempFridge') return getFridgeStats(entries, equipement);
      if (type === 'tempService') return getServiceStats(entries);
      if (type === 'tempCuisson') return getCuissonStats(entries);
      const count = countByType(entries, type);
      return { done: count, total: count > 0 ? count : 0 };
    } catch { return { done: 0, total: 0 }; }
  };

  const isVacances = (equipement) => {
    const vacs = equipement?.vacances || [];
    const today = new Date().toISOString().split('T')[0];
    return vacs.some(v => today >= (v.debut?.split('T')[0] || '') && today <= (v.fin?.split('T')[0] || ''));
  };

  const getSelectedDayTasks = (equipement) => {
    const ph = equipement?.planningHebdo || {};
    const planning = typeof ph.toJSON === 'function' ? ph.toJSON() : ph;
    const day = new Date(selectedDate + 'T12:00:00').getDay().toString();
    return planning[day] || [];
  };

  const getCompletionPct = (entries, equipement) => {
    if (isVacances(equipement)) return -1;
    const todayTasks = getSelectedDayTasks(equipement);
    if (todayTasks.length === 0) return -1;
    const types = DAILY_TYPES.filter(t => todayTasks.includes(t.type));
    let totalDone = 0;
    let totalExpected = 0;
    types.forEach(t => {
      const stats = getTypeDetail(t.type, entries, equipement);
      if (stats.total > 0) {
        totalDone += Math.min(stats.done, stats.total);
        totalExpected += stats.total;
      }
    });
    return totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0;
  };

  const launchExport = async () => {
    setExportLoading(true);
    try {
      const selectedEtabId = document.getElementById('exportEtab')?.value;
      const res = await fetch(`https://haccp3-0-backend.vercel.app/saveData/history?startDate=${exportStart}&endDate=${exportEnd}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const json = await res.json();
      if (!json.result) { setExportLoading(false); return; }

      let exportEtabData = json.data;
      if (selectedEtabId !== 'all') exportEtabData = exportEtabData.filter(d => d.id === selectedEtabId);

      const eqRes = await fetch(`https://haccp3-0-backend.vercel.app/equipement/all`, { headers: { Authorization: `Bearer ${auth.token}` } }).then(r => r.json()).catch(() => ({ result: false }));
      const allEquipements = eqRes.result ? eqRes.data : {};

      const dataMap = {};
      exportEtabData.forEach(d => {
        dataMap[d.id] = { id: d.id, nom: d.nom, entries: d.entries || [], equipement: allEquipements[d.id] || null };
      });
      setExportData(dataMap);
      generatePDF(dataMap);
    } catch (err) { console.error('Export error:', err); }
    setExportLoading(false);
    setShowExportModal(false);
    setExportPreset('');
  };

  const generatePDF = (pdfData) => {
    const startLabel = new Date(exportStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const endLabel = new Date(exportEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const dateLabel = exportStart === exportEnd ? startLabel : `${startLabel} au ${endLabel}`;

    const sectionIcons = { 'Non-conformités détectées': '🚨', 'Relevé frigo': '🧊', 'Fin de cuisson': '🔥', 'Contrôle au service': '🍽️', 'Cellule refroidissement': '❄️', 'Départ / Arrivée': '🚚', 'Plan de nettoyage': '🧹', 'Test huile': '🛢️', 'Étalonnage': '🌡️' };
    const section = (title, color, content) => `<div style="margin-top:16px;"><div style="background:${color};color:#fff;padding:8px 14px;border-radius:8px 8px 0 0;font-weight:700;font-size:12px;">${sectionIcons[title] || '📋'} ${title}</div><div style="border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;padding:10px;">${content}</div></div>`;
    const confCell = (v) => v === undefined ? '' : `<span style="color:${v ? '#2D6A4F' : '#E05C5C'};font-weight:700">${v ? '✅ C' : '❌ NC'}</span>`;

    // Résumé global
    const pdfEtabs = Object.values(pdfData);
    const globalTotal = pdfEtabs.reduce((s, d) => s + d.entries.length, 0);
    const globalNCs = pdfEtabs.reduce((s, d) => s + getNCs(d.entries).length, 0);
    const globalConf = globalTotal > 0 ? Math.round(((globalTotal - globalNCs) / globalTotal) * 100) : 100;

    let body = `<div style="background:#EAF4EC;border-radius:12px;padding:16px;margin-bottom:20px;">
      <h2 style="color:#2D6A4F;margin:0 0 10px;font-size:16px;">📊 Résumé de la période</h2>
      <table><tbody>
        <tr><td style="font-weight:700;width:50%">Période</td><td>${dateLabel}</td></tr>
        <tr><td style="font-weight:700">Établissements</td><td>${pdfEtabs.length}</td></tr>
        <tr><td style="font-weight:700">Total enregistrements</td><td>${globalTotal}</td></tr>
        <tr><td style="font-weight:700">Non-conformités</td><td style="color:${globalNCs > 0 ? '#E05C5C' : '#2D6A4F'};font-weight:700">${globalNCs}</td></tr>
        <tr><td style="font-weight:700">Taux de conformité</td><td style="color:${globalConf >= 95 ? '#2D6A4F' : globalConf >= 80 ? '#C49A3C' : '#E05C5C'};font-weight:700;font-size:14px">${globalConf}%</td></tr>
      </tbody></table>
    </div>`;

    const allBLPhotos = [];

    pdfEtabs.forEach(d => {
      const et = { _id: d.id, nom: d.nom };
      const entries = d?.entries || [];
      const eq = d?.equipement;
      const pct = getCompletionPct(entries, eq);
      const ncs = getNCs(entries, true);

      body += `<div style="page-break-inside:avoid;margin-top:28px;border:2px solid #2D6A4F;border-radius:12px;overflow:hidden;">`;
      body += `<div style="background:#2D6A4F;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;"><span style="font-size:16px;font-weight:700;">🏫 ${et.nom}</span><span style="background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:20px;font-size:12px;">${pct < 0 ? 'Fermé' : pct + '%'}</span></div>`;

      if (pct < 0) {
        body += `<div style="padding:14px;text-align:center;color:#999;font-style:italic;">Fermé — pas de service pour cette période</div></div>`;
        return;
      }

      body += `<div style="padding:14px;">`;

      // Résumé complétion
      let resumeRows = '';
      DAILY_TYPES.forEach(t => {
        const stats = getTypeDetail(t.type, entries, eq);
        const ok = stats.total > 0 && stats.done >= stats.total;
        const color = ok ? '#2D6A4F' : stats.done > 0 ? '#C49A3C' : '#E05C5C';
        const icons = { tempFridge: '🧊', tempCuisson: '🔥', tempService: '🍽️', cleaning: '🧹' };
        resumeRows += `<tr><td style="font-weight:600">${icons[t.type] || '📋'} ${t.label}</td><td style="text-align:center">${stats.done} / ${stats.total}</td><td style="text-align:center"><span style="background:${color};color:#fff;padding:2px 10px;border-radius:12px;font-size:9px;font-weight:700">${ok ? 'COMPLET' : stats.done > 0 ? 'EN COURS' : 'NON FAIT'}</span></td></tr>`;
      });
      body += `<table style="margin-bottom:12px;"><thead><tr><th>Contrôle</th><th style="text-align:center">Réalisé</th><th style="text-align:center">Statut</th></tr></thead><tbody>${resumeRows}</tbody></table>`;

      // NC
      if (ncs.length > 0) {
        let ncRows = '';
        ncs.forEach(nc => {
          ncRows += `<tr style="background:#FFF5F5"><td style="font-size:9px">${nc.date}</td><td>${nc.type}</td><td>${nc.produit || '—'}</td><td style="color:#E05C5C;font-weight:700">${nc.valeur || '—'}</td><td style="font-size:9px;color:#C7793A">${nc.observation || '—'}</td><td style="font-size:9px">${nc.by}</td></tr>`;
        });
        body += section('Non-conformités détectées', '#E05C5C', `<table><thead><tr><th>Date</th><th>Type</th><th>Produit</th><th>Valeur</th><th>Observation</th><th>Opérateur</th></tr></thead><tbody>${ncRows}</tbody></table>`);
      }

      // Frigo
      const frigoItems = entries.filter(e => e.type === 'tempFridge').flatMap(e => (e.data?.dataTemp || []).map(i => {
        let conf = i.conforme;
        if (conf === undefined || conf === null) {
          const t = parseFloat((i.temperature || '').replace('°C', '').replace(',', '.'));
          const isCongel = (i.fridge || '').toLowerCase().includes('congél') || (i.fridge || '').toLowerCase().includes('congel');
          conf = !isNaN(t) ? (isCongel ? t <= -18 : t <= 3) : undefined;
        }
        return { ...i, conforme: conf, _date: new Date(e.createdAt).toLocaleDateString('fr-FR'), _by: e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '' };
      }));
      if (frigoItems.length > 0) {
        let rows = frigoItems.map(i => `<tr><td style="font-size:9px">${i._date}</td><td>${i.fridge}</td><td>${i.period}</td><td style="font-weight:700">${i.temperature}</td><td>${confCell(i.conforme)}</td><td style="font-size:9px;color:#C7793A">${i.observation || '—'}</td><td style="font-size:9px">${i._by}</td></tr>`).join('');
        body += section('Relevé frigo', '#4A90D9', `<table><thead><tr><th>Date</th><th>Équipement</th><th>Période</th><th>Température</th><th>Conformité</th><th>Observation</th><th>Opérateur</th></tr></thead><tbody>${rows}</tbody></table>`);
      }

      // Cuisson
      const cuissonItems = entries.filter(e => e.type === 'tempCuisson').flatMap(e => (e.data?.dataCuisson || []).map(i => {
        let conf = i.conforme;
        if (conf === undefined || conf === null) {
          const t = parseFloat((i.temperature || '').replace('°C', '').replace(',', '.'));
          conf = !isNaN(t) ? t >= 63 : undefined;
        }
        return { ...i, conforme: conf, _date: new Date(e.createdAt).toLocaleDateString('fr-FR'), _by: e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '' };
      }));
      if (cuissonItems.length > 0) {
        let rows = cuissonItems.map(i => `<tr><td style="font-size:9px">${i._date}</td><td>${i.plat}</td><td style="font-weight:700">${i.temperature}</td><td>${i.heure || '—'}</td><td>${confCell(i.conforme)}</td><td style="font-size:9px;color:#C7793A">${i.observation || '—'}</td><td style="font-size:9px">${i._by}</td></tr>`).join('');
        body += section('Fin de cuisson', '#E8855A', `<table><thead><tr><th>Date</th><th>Plat</th><th>Température</th><th>Heure</th><th>Conformité</th><th>Observation</th><th>Opérateur</th></tr></thead><tbody>${rows}</tbody></table>`);
      }

      // Service
      const serviceItems = entries.filter(e => e.type === 'tempService').flatMap(e => (e.data?.dataService || []).map(i => {
        let conf = i.conforme;
        if (conf === undefined || conf === null) {
          const t = parseFloat((i.temperature || '').replace('°C', '').replace(',', '.'));
          if (!isNaN(t)) conf = i.type === 'chaud' ? t >= 63 : t <= 3;
        }
        return { ...i, conforme: conf, _date: new Date(e.createdAt).toLocaleDateString('fr-FR'), _by: e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '' };
      }));
      if (serviceItems.length > 0) {
        let rows = serviceItems.map(i => `<tr><td style="font-size:9px">${i._date}</td><td>${i.type === 'chaud' ? '🔥' : '❄'} ${i.plat}</td><td>${i.periode}</td><td style="font-weight:700">${i.temperature}</td><td>${confCell(i.conforme)}</td><td style="font-size:9px;color:#C7793A">${i.observation || '—'}</td><td style="font-size:9px">${i._by}</td></tr>`).join('');
        body += section('Contrôle au service', '#C49A3C', `<table><thead><tr><th>Date</th><th>Plat</th><th>Période</th><th>Température</th><th>Conformité</th><th>Observation</th><th>Opérateur</th></tr></thead><tbody>${rows}</tbody></table>`);
      }

      // Cellule
      const celluleItems = entries.filter(e => e.type === 'cellule').flatMap(e => (e.data?.dataCellule || []).map(i => {
        let conf = i.conforme;
        if (conf === undefined || conf === null) {
          const t = parseFloat((i.tempSortie || '').replace('°C', '').replace(',', '.'));
          conf = !isNaN(t) ? t <= 10 : undefined;
        }
        return { ...i, conforme: conf, _date: new Date(e.createdAt).toLocaleDateString('fr-FR'), _by: e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '' };
      }));
      if (celluleItems.length > 0) {
        let rows = celluleItems.map(i => `<tr><td style="font-size:9px">${i._date}</td><td>${i.plat}</td><td style="font-weight:700">${i.tempEntree}</td><td>${i.heureEntree || '—'}</td><td style="font-weight:700">${i.tempSortie}</td><td>${i.heureSortie || '—'}</td><td>${i.duree || '—'}</td><td>${confCell(i.conforme)}</td><td style="font-size:9px;color:#C7793A">${i.observation || '—'}</td><td style="font-size:9px">${i._by}</td></tr>`).join('');
        body += section('Cellule refroidissement', '#0097A7', `<table><thead><tr><th>Date</th><th>Plat</th><th>Temp. entrée</th><th>Heure entrée</th><th>Temp. sortie</th><th>Heure sortie</th><th>Durée</th><th>Conformité</th><th>Observation</th><th>Opérateur</th></tr></thead><tbody>${rows}</tbody></table>`);
      }

      // Livraison — grouper départ + arrivée (avec arrivées cross-établissement)
      const livraisonItems = entries.filter(e => e.type === 'livraison').flatMap(e => (e.data?.dataLivraison || []).map(i => {
        let conf = i.conforme;
        if (conf === undefined || conf === null) {
          const t = parseFloat((i.temperature || '').replace('°C', '').replace(',', '.'));
          if (!isNaN(t)) conf = i.typeTemp === 'chaud' ? t >= 63 : t <= 3;
        }
        return { ...i, conforme: conf, _by: e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '' };
      }));
      if (livraisonItems.length > 0) {
        const departs = livraisonItems.filter(i => i.direction === 'Départ');
        const arrivees = livraisonItems.filter(i => i.direction === 'Arrivée');
        const matched = new Set();
        let rows = '';

        departs.forEach(dep => {
          const arrIdx = arrivees.findIndex((arr, i) => !matched.has(i) && arr.produit === dep.produit && arr.tempDepart === dep.temperature);
          const arr = arrIdx >= 0 ? arrivees[arrIdx] : null;
          if (arrIdx >= 0) matched.add(arrIdx);
          rows += `<tr><td>${dep.typeTemp === 'chaud' ? '🔥' : '❄'} ${dep.produit}</td><td>${dep.site}</td><td style="font-weight:700">${dep.temperature}</td><td>${dep.heure}</td><td>${dep._by}</td><td>${arr?.site || '—'}</td><td style="font-weight:700">${arr?.temperature || '—'}</td><td>${arr?.heure || '—'}</td><td>${arr ? confCell(arr.conforme) : '—'}</td><td>${arr?._by || '—'}</td><td style="font-size:9px;color:#C7793A">${arr?.observation || dep.observation || '—'}</td></tr>`;
        });
        arrivees.forEach((arr, i) => {
          if (matched.has(i)) return;
          rows += `<tr><td>${arr.typeTemp === 'chaud' ? '🔥' : '❄'} ${arr.produit}</td><td>${arr.siteDepart || '—'}</td><td>${arr.tempDepart || '—'}</td><td>${arr.heureDepart || '—'}</td><td>—</td><td>${arr.site}</td><td style="font-weight:700">${arr.temperature}</td><td>${arr.heure}</td><td>${confCell(arr.conforme)}</td><td>${arr._by}</td><td style="font-size:9px;color:#C7793A">${arr.observation || '—'}</td></tr>`;
        });
        body += section('Départ / Arrivée', '#689F38', `<table><thead><tr><th>Produit</th><th colspan="4" style="background:#689F38;color:#fff;text-align:center">DÉPART</th><th colspan="5" style="background:#558B2F;color:#fff;text-align:center">ARRIVÉE</th><th>Observation</th></tr><tr><th></th><th>Destination</th><th>Température</th><th>Heure</th><th>Opérateur</th><th>Site</th><th>Température</th><th>Heure</th><th>Conformité</th><th>Opérateur</th><th></th></tr></thead><tbody>${rows}</tbody></table>`);
      }

      // Huile
      const oilItems = entries.filter(e => e.type === 'oilTest').flatMap(e => (e.data?.dataOil || []).map(i => {
        let conf = i.conforme;
        if (conf === undefined || conf === null) {
          const t = parseFloat((i.tpc || '').replace('%', '').replace(',', '.'));
          conf = !isNaN(t) ? t <= 25 : undefined;
        }
        return { ...i, conforme: conf, _date: new Date(e.createdAt).toLocaleDateString('fr-FR'), _by: e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '' };
      }));
      if (oilItems.length > 0) {
        let rows = oilItems.map(i => `<tr><td>${i._date}</td><td>${i.friteuse}</td><td style="font-weight:700">${i.tpc}</td><td>${confCell(i.conforme)}</td><td>${i.action}</td><td style="font-size:9px;color:#C7793A">${i.observation || '—'}</td><td style="font-size:9px">${i._by}</td></tr>`).join('');
        body += section('Test huile', '#A0742D', `<table><thead><tr><th>Date</th><th>Friteuse</th><th>Résultat</th><th>Conformité</th><th>Action</th><th>Observation</th><th>Opérateur</th></tr></thead><tbody>${rows}</tbody></table>`);
      }

      // Étalonnage
      const etalItems = entries.filter(e => e.type === 'etalonnage').flatMap(e => (e.data?.dataEtalonnage || []).map(i => {
        let conf = i.conforme;
        if (conf === undefined || conf === null) {
          const ecart = parseFloat((i.ecart || '').replace('°C', '').replace(',', '.'));
          conf = !isNaN(ecart) ? Math.abs(ecart) <= 1 : undefined;
        }
        return { ...i, conforme: conf, _date: new Date(e.createdAt).toLocaleDateString('fr-FR'), _by: e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '' };
      }));
      if (etalItems.length > 0) {
        let rows = etalItems.map(i => `<tr><td>${i._date}</td><td>${i.sonde}</td><td>${i.reference}</td><td style="font-weight:700">${i.mesure}</td><td>${i.ecart}</td><td>${confCell(i.conforme)}</td><td style="font-size:9px;color:#C7793A">${i.observation || '—'}</td><td style="font-size:9px">${i._by}</td></tr>`).join('');
        body += section('Étalonnage', '#5C6BC0', `<table><thead><tr><th>Date</th><th>Sonde</th><th>Référence</th><th>Mesure</th><th>Écart</th><th>Conformité</th><th>Observation</th><th>Opérateur</th></tr></thead><tbody>${rows}</tbody></table>`);
      }

      // Camion
      const camionEntries = entries.filter(e => e.type === 'nettoyageCamion');
      if (camionEntries.length > 0) {
        let rows = camionEntries.map(e => `<tr><td>${new Date(e.createdAt).toLocaleDateString('fr-FR')}</td><td>${e.data?.camion || '—'}</td><td>${(e.data?.items || []).join(', ')}</td><td style="font-size:9px">${e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : ''}</td></tr>`).join('');
        body += section('Nettoyage camion', '#546E7A', `<table><thead><tr><th>Date</th><th>Camion</th><th>Éléments nettoyés</th><th>Opérateur</th></tr></thead><tbody>${rows}</tbody></table>`);
      }

      // Nettoyage — groupé par date
      const cleanEntries = entries.filter(e => e.type === 'cleaning');
      if (cleanEntries.length > 0) {
        const byDate = {};
        cleanEntries.forEach(e => {
          const dateKey = new Date(e.createdAt).toLocaleDateString('fr-FR');
          if (!byDate[dateKey]) byDate[dateKey] = [];
          byDate[dateKey].push(e);
        });
        let content = '';
        Object.entries(byDate).forEach(([date, dayEntries]) => {
          const zoneMap = {};
          const zoneBy = {};
          dayEntries.forEach(e => {
            const c = e.data?.cleaning;
            if (!c) return;
            const by = e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '';
            Object.entries(c).filter(([k]) => k !== 'observation' && k !== '_id').forEach(([zone, tasks]) => {
              if (!Array.isArray(tasks) || tasks.length === 0) return;
              if (!zoneMap[zone]) { zoneMap[zone] = new Set(); zoneBy[zone] = new Set(); }
              tasks.forEach(t => zoneMap[zone].add(t));
              if (by) zoneBy[zone].add(by);
            });
          });
          let rows = '';
          Object.entries(zoneMap).forEach(([zone, tasks]) => {
            rows += `<tr><td style="font-weight:600;vertical-align:middle">${zone}</td><td style="vertical-align:middle">${[...tasks].join(', ')}</td><td style="font-size:9px;vertical-align:middle">${[...zoneBy[zone]].join(', ')}</td></tr>`;
          });
          if (rows) content += `<div style="margin-bottom:14px;"><div style="font-weight:700;font-size:11px;color:#26A69A;margin-bottom:4px;">📅 ${date}</div><table style="table-layout:fixed;"><colgroup><col style="width:10%"/><col style="width:75%"/><col style="width:15%"/></colgroup><thead><tr><th>Zone</th><th>Tâches réalisées</th><th>Opérateur</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        });
        if (content) body += section('Plan de nettoyage', '#26A69A', content);
      }

      // Étiquettes / DLC — groupé par date
      const labelEntries = entries.filter(e => e.type === 'label');
      if (labelEntries.length > 0) {
        const byDate = {};
        labelEntries.forEach(e => {
          const dateKey = new Date(e.createdAt).toLocaleDateString('fr-FR');
          if (!byDate[dateKey]) byDate[dateKey] = [];
          (e.data?.photos || []).forEach(p => {
            byDate[dateKey].push({ url: p.url || p, by: e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '' });
          });
        });
        const totalPhotos = Object.values(byDate).reduce((s, arr) => s + arr.length, 0);
        if (totalPhotos > 0) {
          let content = `<p style="font-size:10px;margin-bottom:8px;">${totalPhotos} photo(s) — preuve de traçabilité produits</p>`;
          Object.entries(byDate).forEach(([date, photos]) => {
            const urls = photos.map(p => p.url);
            const imgs = photos.map((p, pi) => `<div style="display:inline-block;text-align:center;margin:4px;"><img src="${p.url}" data-group='${JSON.stringify(urls)}' data-idx="${pi}" onclick="openLb(JSON.parse(this.dataset.group),+this.dataset.idx)" style="width:100px;height:100px;object-fit:cover;border-radius:6px;border:1px solid #ddd;cursor:pointer;" /><div style="font-size:8px;color:#888;">${p.by}</div></div>`).join('');
            content += `<div style="margin-bottom:14px;"><div style="font-weight:700;font-size:11px;color:#C7793A;margin-bottom:4px;">📅 ${date}</div>${imgs}</div>`;
          });
          body += section('Étiquettes / Traçabilité DLC', '#C7793A', content);
        }
      }

      // Réception marchandise — groupé par réception
      const receptionEntries = entries.filter(e => e.type === 'controleReception');
      if (receptionEntries.length > 0) {
        let content = '';
        receptionEntries.forEach(e => {
          const d2 = e.data;
          if (Array.isArray(d2?.photosBL) && d2.photosBL.length > 0) {
            allBLPhotos.push({ etab: et.nom, fournisseur: d2.fournisseur || '—', date: new Date(e.createdAt).toLocaleDateString('fr-FR'), urls: d2.photosBL });
          }
          const date = new Date(e.createdAt).toLocaleDateString('fr-FR');
          const heure = new Date(e.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          const by = e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '';
          const items = d2?.items || [];
          let prodRows = '';
          const allPhotos = items.flatMap(item => item.photos || []);
          items.forEach(item => {
            const photoUrls = item.photos || [];
            const photos = photoUrls.map((url, pi) => `<img src="${url}" data-group='${JSON.stringify(allPhotos)}' data-idx="${allPhotos.indexOf(url)}" onclick="openLb(JSON.parse(this.dataset.group),+this.dataset.idx)" style="width:70px;height:70px;object-fit:cover;border-radius:4px;border:1px solid #ddd;cursor:pointer;" />`).join(' ');
            const prodName = item.nomProduit || (photoUrls.length > 0 ? 'Voir l\'image' : '—');
            const isCfTemoin = (item.temperature || '').includes('témoin');
            const tempDisplay = isCfTemoin ? '<span style="color:#2D6A4F;font-style:italic;">cf. témoin</span>' : `${item.temperature || '—'}°C`;
            const lot = item.lotVisible ? 'Visible ✓' : (item.numeroDuLot || '—');
            prodRows += `<tr><td style="vertical-align:middle">${prodName}</td><td style="font-weight:700;vertical-align:middle">${tempDisplay}</td><td style="vertical-align:middle">${item.dlc || '—'}</td><td style="vertical-align:middle">${lot}</td><td style="vertical-align:middle">${photos || '—'}</td></tr>`;
          });
          content += `<div style="margin-bottom:16px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
            <div style="background:#EAF4EC;padding:8px 12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
                <span style="font-weight:700;color:#2D6A4F;">📅 ${date} à ${heure} — ${d2.fournisseur}</span>
                <span style="font-size:9px;color:#666;">Opérateur : ${by}</span>
              </div>
              <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:10px;margin-top:4px;">
                <span><strong>État camion :</strong> ${d2.etatCamion || '—'}</span>
                <span><strong>Température camion :</strong> ${d2.tempCamion || '—'}°C</span>
                ${d2.numeroBL ? `<span><strong>N° BL :</strong> ${d2.numeroBL}</span>` : ''}
                ${Array.isArray(d2.photosBL) && d2.photosBL.length > 0 ? `<span><strong>BL :</strong> <em style="color:#4A90D9;">cf. annexe</em></span>` : ''}
                <span><strong>Produits :</strong> ${items.length}</span>
              </div>
            </div>
            <table style="margin:0;table-layout:fixed;"><colgroup><col style="width:25%"/><col style="width:15%"/><col style="width:15%"/><col style="width:15%"/><col style="width:30%"/></colgroup><thead><tr><th>Produit</th><th>Température</th><th>DLC</th><th>Lot</th><th>Photos</th></tr></thead><tbody>${prodRows}</tbody></table>
          </div>`;
        });
        body += section('Réception marchandise', '#2D6A4F', content);
      }

      // NC fiches
      const ncFiches = entries.filter(e => e.type === 'nonConformite');
      if (ncFiches.length > 0) {
        let rows = ncFiches.map(e => {
          const d2 = e.data;
          return `<tr style="background:#FFF5F5"><td style="font-size:9px">${new Date(e.createdAt).toLocaleDateString('fr-FR')}</td><td>${d2?.source || '—'}</td><td style="color:#E05C5C;font-weight:700">${d2?.typeNC || '—'}</td><td>${d2?.produit || '—'}</td><td style="font-weight:700">${d2?.valeur || '—'}</td><td>${d2?.seuil || '—'}</td><td>${d2?.actionCorrective || '—'}</td><td style="font-size:9px;color:#C7793A">${d2?.observations || '—'}</td><td style="font-size:9px">${d2?.responsable || ''}</td></tr>`;
        }).join('');
        body += section('Fiches de non-conformité', '#C0392B', `<table><thead><tr><th>Date</th><th>Source</th><th>Type NC</th><th>Produit / Objet</th><th>Valeur</th><th>Seuil</th><th>Action corrective</th><th>Description</th><th>Responsable</th></tr></thead><tbody>${rows}</tbody></table>`);
      }

      body += '</div></div>';
    });

    const html = `<html><head><meta charset="utf-8"/><style>
      @page { margin: 15mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #333; }
      h1 { text-align: center; color: #2D6A4F; font-size: 22px; margin-bottom: 2px; }
      .subtitle { text-align: center; color: #888; font-size: 13px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin: 6px 0; }
      th { background: #EAF4EC; color: #2D6A4F; padding: 6px 8px; text-align: left; font-size: 9px; border: 1px solid #ddd; text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap; }
      td { padding: 5px 8px; border: 1px solid #e8e8e8; font-size: 10px; vertical-align: middle; }
      tr:nth-child(even) td { background: #fafafa; }
      .footer { text-align: center; color: #aaa; font-size: 9px; margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; }
      .logo { text-align: center; margin-bottom: 8px; }
      .logo span { font-size: 28px; font-weight: 700; color: #2D6A4F; }
      .logo .safe { color: #4CAF50; }
      .lb-overlay { display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:9999;justify-content:center;align-items:center;flex-direction:column; }
      .lb-overlay.active { display:flex; }
      .lb-img { max-width:90vw;max-height:80vh;object-fit:contain;border-radius:8px; }
      .lb-close { position:absolute;top:20px;right:30px;color:#fff;font-size:32px;cursor:pointer;font-weight:700;z-index:10000; }
      .lb-nav { position:absolute;top:50%;transform:translateY(-50%);color:#fff;font-size:40px;cursor:pointer;user-select:none;padding:10px 18px;z-index:10000; }
      .lb-prev { left:20px; }
      .lb-next { right:20px; }
      .lb-counter { color:#fff;font-size:14px;margin-top:12px; }
    </style></head><body>
    <div class="lb-overlay" id="lightbox" onclick="if(event.target===this)closeLb()">
      <span class="lb-close" onclick="closeLb()">&times;</span>
      <span class="lb-nav lb-prev" onclick="navLb(-1)">&#8249;</span>
      <img class="lb-img" id="lbImg" />
      <span class="lb-nav lb-next" onclick="navLb(1)">&#8250;</span>
      <div class="lb-counter" id="lbCounter"></div>
    </div>
      <div class="logo"><span>Food</span><span class="safe">Safe</span></div>
      <h1>Rapport multi-établissements</h1>
      <p class="subtitle">${dateLabel} — ${pdfEtabs.length} établissement${pdfEtabs.length > 1 ? 's' : ''}</p>
      ${body}
      ${allBLPhotos.length > 0 ? `<div style="page-break-before:always;"><div style="background:#2D6A4F;color:#fff;padding:12px 16px;border-radius:8px;font-weight:700;font-size:14px;margin-bottom:16px;">📎 Annexe — Bons de livraison</div>${allBLPhotos.map(bl => bl.urls.map((url, i) => `<div style="page-break-inside:avoid;margin-bottom:20px;"><div style="font-weight:700;font-size:12px;color:#2D6A4F;margin-bottom:6px;">📄 ${bl.etab} — ${bl.fournisseur} — ${bl.date}${bl.urls.length > 1 ? ` (${i+1}/${bl.urls.length})` : ''}</div><img src="${url}" style="max-width:100%;max-height:700px;object-fit:contain;border-radius:8px;border:1px solid #ddd;" /></div>`).join('')).join('')}</div>` : ''}
      <div class="footer">Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — FoodSafe</div>
    <script>
      var lbPhotos=[], lbIdx=0;
      function openLb(group,idx){ lbPhotos=group; lbIdx=idx; showLb(); }
      function showLb(){ document.getElementById('lbImg').src=lbPhotos[lbIdx]; document.getElementById('lbCounter').textContent=(lbIdx+1)+' / '+lbPhotos.length; document.getElementById('lightbox').classList.add('active'); }
      function closeLb(){ document.getElementById('lightbox').classList.remove('active'); }
      function navLb(dir){ lbIdx=(lbIdx+dir+lbPhotos.length)%lbPhotos.length; showLb(); }
      document.addEventListener('keydown',function(e){ if(!document.getElementById('lightbox').classList.contains('active'))return; if(e.key==='Escape')closeLb(); if(e.key==='ArrowLeft')navLb(-1); if(e.key==='ArrowRight')navLb(1); });
    </script>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const totalEntries = Object.values(allData).reduce((sum, d) => sum + (d.entries?.length || 0), 0);
  const totalNCs = Object.values(allData).reduce((sum, d) => sum + getNCs(d.entries || []).length, 0);
  const allNCs = Object.values(allData).flatMap(d => getNCs(d.entries || []).map(nc => ({ ...nc, site: d.nom })));

  return (
    <div>
      <div className="page-header">
        <h1>Vue d'ensemble</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            style={{ padding: '8px 14px', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '14px' }}
          />
          <button className="btn btn-green" onClick={() => { setExportStart(selectedDate); setExportEnd(selectedDate); setShowExportModal(true); }}>📄 Export PDF</button>
        </div>
      </div>

      {loading ? <p>Chargement...</p> : (
        <>
          {/* Stats globaux */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--green-light)' }}>🏫</div>
              <div>
                <div className="stat-value">{etabs.length}</div>
                <div className="stat-label">Établissements</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--green-light)' }}>📋</div>
              <div>
                <div className="stat-value">{totalEntries}</div>
                <div className="stat-label">Enregistrements</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: totalNCs > 0 ? 'var(--red-light)' : 'var(--green-light)' }}>
                {totalNCs > 0 ? '⚠️' : '✅'}
              </div>
              <div>
                <div className="stat-value" style={{ color: totalNCs > 0 ? 'var(--red)' : 'var(--green)' }}>{totalNCs}</div>
                <div className="stat-label">Non-conformités</div>
              </div>
            </div>
          </div>

          {/* Complétion par commune / établissement */}
          {(() => {
            const communes = {};
            etabs.forEach(et => {
              const cName = et.commune?.nom || 'Autre';
              if (!communes[cName]) communes[cName] = [];
              communes[cName].push(et);
            });
            const multiCommune = Object.keys(communes).length > 1;
            return Object.entries(communes).map(([cName, cEtabs]) => {
              const isCommuneOpen = multiCommune ? openCommunes[cName] : true;
              const communeEntries = cEtabs.flatMap(et => allData[et._id]?.entries || []);
              const communeNCs = getNCs(communeEntries).length;
              const communeTotal = communeEntries.length;
              return (
                <div key={cName} style={{ marginBottom: '16px' }}>
                  {multiCommune && (
                    <div
                      onClick={() => setOpenCommunes(p => ({ ...p, [cName]: !p[cName] }))}
                      style={{
                        background: 'var(--green)', color: '#fff', padding: '14px 20px',
                        borderRadius: isCommuneOpen ? '14px 14px 0 0' : '14px',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontWeight: '700', fontSize: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                    >
                      <span>🏛️ {cName}</span>
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 10px', borderRadius: '10px' }}>{cEtabs.length} cantine{cEtabs.length > 1 ? 's' : ''}</span>
                        <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 10px', borderRadius: '10px' }}>{communeTotal} enreg.</span>
                        {communeNCs > 0 && <span style={{ background: 'rgba(255,80,80,0.8)', padding: '2px 10px', borderRadius: '10px' }}>{communeNCs} NC</span>}
                        <span>{isCommuneOpen ? '▲' : '▼'}</span>
                      </span>
                    </div>
                  )}
                  {isCommuneOpen && (
                    <div style={{ background: '#fff', borderRadius: multiCommune ? '0 0 14px 14px' : '14px', padding: '12px', border: '1px solid #e0e0e0', borderTop: multiCommune ? 'none' : undefined }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Établissement</th>
                            {DAILY_TYPES.map(t => <th key={t.type}>{t.label}</th>)}
                            <th>Complétion</th>
                            <th>NC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cEtabs.map(et => {
                            const data = allData[et._id];
                            const entries = data?.entries || [];
                            const eq = data?.equipement;
                            const pct = getCompletionPct(entries, eq);
                            const ncs = getNCs(entries);
                            const isToday = selectedDate === new Date().toISOString().split('T')[0];
                            const isAfternoon = new Date().getHours() >= 15;
                            const missing = DAILY_TYPES.filter(t => getTypeDetail(t.type, entries, eq).done === 0).map(t => t.label);
                            return (
                              <React.Fragment key={et._id}>
                                <tr><td colSpan={DAILY_TYPES.length + 3} style={{ padding: '10px 0', border: 'none' }}></td></tr>
                                <tr style={{ background: '#f9f9f9' }}>
                                  <td><a href="#" onClick={e2 => { e2.preventDefault(); onNavigate('history', et._id, selectedDate); }} style={{ color: 'var(--green)', fontWeight: '700', textDecoration: 'underline', cursor: 'pointer' }}>{et.nom}</a></td>
                                  {DAILY_TYPES.map(t => {
                                    const stats = getTypeDetail(t.type, entries, eq);
                                    const complete = stats.total > 0 && stats.done >= stats.total;
                                    return (
                                      <td key={t.type}>
                                        {stats.done > 0 ? (
                                          <span className={`badge ${complete ? 'badge-green' : 'badge-gold'}`}>
                                            {complete ? '✅' : '⏳'} {stats.done}/{stats.total}
                                          </span>
                                        ) : (
                                          <span className="badge badge-gray">0/{stats.total}</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{ flex: 1, height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                                        {pct >= 0 && <div style={{ width: `${pct}%`, height: '100%', borderRadius: '4px', background: pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)' }} />}
                                      </div>
                                      <span style={{ fontSize: '13px', fontWeight: '700', color: pct < 0 ? '#999' : pct === 100 ? 'var(--green)' : pct >= 50 ? '#8D6E00' : 'var(--red)' }}>{pct < 0 ? 'Fermé' : `${pct}%`}</span>
                                    </div>
                                  </td>
                                  <td>
                                    {ncs.length > 0 ? (
                                      <span className="badge badge-red">{ncs.length} NC</span>
                                    ) : (
                                      <span className="badge badge-green">OK</span>
                                    )}
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            });
          })()}

          {/* Alertes NC */}
          {allNCs.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header" style={{ background: 'var(--red)' }}>
                ⚠️ Non-conformités du jour
              </div>
              <div className="card-body">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Site</th>
                      <th>Type</th>
                      <th>Produit</th>
                      <th>Valeur</th>
                      <th>Observation</th>
                      <th>Opérateur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allNCs.map((nc, i) => (
                      <tr key={i} className="nc-row">
                        <td style={{ fontSize: '12px' }}>{nc.date}</td>
                        <td><strong>{nc.site}</strong></td>
                        <td>{nc.type}</td>
                        <td>{nc.produit || '—'}</td>
                        <td style={{ color: 'var(--red)', fontWeight: '700' }}>{nc.valeur || '—'}</td>
                        <td style={{ fontSize: '12px', color: '#C7793A' }}>{nc.observation || '—'}</td>
                        <td style={{ fontSize: '12px' }}>{nc.by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


        </>
      )}

      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>📄 Export PDF</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Choisissez la période et les établissements à exporter.</p>
            <label>Établissement</label>
            <select id="exportEtab" defaultValue="all" style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '10px', fontSize: '14px', background: 'white', cursor: 'pointer' }}>
              <option value="all">Tous les établissements</option>
              {etabs.map(et => <option key={et._id} value={et._id}>{et.nom}</option>)}
            </select>
            <label>Du</label>
            <input type="date" value={exportStart} onChange={e => { setExportStart(e.target.value); setExportPreset(''); }} max={new Date().toISOString().split('T')[0]} />
            <label>Au</label>
            <input type="date" value={exportEnd} onChange={e => { setExportEnd(e.target.value); setExportPreset(''); }} min={exportStart} max={new Date().toISOString().split('T')[0]} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button className={exportPreset === 'today' ? 'btn btn-green' : 'btn btn-outline'} onClick={() => { const t = new Date().toISOString().split('T')[0]; setExportStart(t); setExportEnd(t); setExportPreset('today'); }}>Aujourd'hui</button>
              <button className={exportPreset === '7days' ? 'btn btn-green' : 'btn btn-outline'} onClick={() => { const d = new Date(); const s = new Date(d); s.setDate(s.getDate() - 6); setExportStart(s.toISOString().split('T')[0]); setExportEnd(d.toISOString().split('T')[0]); setExportPreset('7days'); }}>7 derniers jours</button>
              <button className={exportPreset === 'month' ? 'btn btn-green' : 'btn btn-outline'} onClick={() => { const d = new Date(); setExportStart(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]); setExportEnd(d.toISOString().split('T')[0]); setExportPreset('month'); }}>Ce mois</button>
              <button className={exportPreset === 'prevMonth' ? 'btn btn-green' : 'btn btn-outline'} onClick={() => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth() - 1, 1); const e = new Date(d.getFullYear(), d.getMonth(), 0); setExportStart(s.toISOString().split('T')[0]); setExportEnd(e.toISOString().split('T')[0]); setExportPreset('prevMonth'); }}>Mois précédent</button>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowExportModal(false)}>Annuler</button>
              <button className="btn btn-green" onClick={launchExport} disabled={exportLoading}>
                {exportLoading ? 'Chargement...' : 'Générer le rapport'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
