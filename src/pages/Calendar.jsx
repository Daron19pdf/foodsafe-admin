import React, { useState, useEffect } from 'react'
import { getSaveData } from '../api'

const DAILY_TYPES = ['tempFridge', 'tempCuisson', 'tempService', 'cleaning'];

function getDaysInMonth(year, month) {
  const days = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function fmtISO(d) { return d.toISOString().split('T')[0]; }

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function Calendar({ auth }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  const etabs = auth.etablissements || [];
  const days = getDaysInMonth(year, month);
  const firstDayOffset = (days[0].getDay() + 6) % 7;

  const monthLabel = new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  useEffect(() => {
    setLoading(true);
    const startDate = fmtISO(new Date(year, month, 1));
    const endDate = fmtISO(new Date(year, month + 1, 0));

    const promises = etabs.map(async (et) => {
      const res = await getSaveData(auth.token, et._id, startDate, endDate);
      return { id: et._id, nom: et.nom, entries: res.result ? res.data : [] };
    });

    Promise.all(promises).then(results => {
      const map = {};
      results.forEach(r => { map[r.id] = r; });
      setData(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [year, month]);

  const getDayStatus = (date, etabId) => {
    const dateStr = fmtISO(date);
    const entries = (data[etabId]?.entries || []).filter(e => e.createdAt?.startsWith(dateStr));
    if (entries.length === 0) return 'empty';
    const typesFound = new Set(entries.map(e => e.type));
    const done = DAILY_TYPES.filter(t => typesFound.has(t)).length;
    if (done >= DAILY_TYPES.length) return 'complete';
    if (done > 0) return 'partial';
    return 'empty';
  };

  const getDayColor = (status) => {
    if (status === 'complete') return '#2D6A4F';
    if (status === 'partial') return '#C49A3C';
    return '#E0E0E0';
  };

  const getDayEntries = (date, etabId) => {
    const dateStr = fmtISO(date);
    return (data[etabId]?.entries || []).filter(e => e.createdAt?.startsWith(dateStr));
  };

  const today = fmtISO(now);
  const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
  const isFuture = (d) => fmtISO(d) > today;

  return (
    <div>
      <div className="page-header">
        <h1>Calendrier</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-outline" onClick={prevMonth}>◀</button>
          <span style={{ fontSize: '16px', fontWeight: '600', minWidth: '160px', textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel}</span>
          <button className="btn btn-outline" onClick={nextMonth}>▶</button>
        </div>
      </div>

      {loading ? <p>Chargement...</p> : (
        etabs.map(et => (
          <div key={et._id} className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header" style={{ background: 'var(--green)' }}>
              {et.nom}
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                {WEEKDAYS.map(d => (
                  <div key={d} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', padding: '4px' }}>{d}</div>
                ))}
                {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}
                {days.map(day => {
                  const status = isWeekend(day) || isFuture(day) ? 'skip' : getDayStatus(day, et._id);
                  const isToday = fmtISO(day) === today;
                  const isSelected = selectedDay && fmtISO(selectedDay.date) === fmtISO(day) && selectedDay.etabId === et._id;
                  return (
                    <div
                      key={fmtISO(day)}
                      onClick={() => !isWeekend(day) && !isFuture(day) && setSelectedDay({ date: day, etabId: et._id, etabNom: et.nom })}
                      style={{
                        padding: '6px 2px',
                        borderRadius: '8px',
                        cursor: isWeekend(day) || isFuture(day) ? 'default' : 'pointer',
                        background: isSelected ? 'var(--green)' : status === 'skip' ? 'transparent' : getDayColor(status),
                        color: isSelected || status === 'complete' ? '#fff' : status === 'partial' ? '#fff' : 'var(--text)',
                        opacity: status === 'skip' ? 0.3 : 1,
                        fontSize: '13px',
                        fontWeight: isToday ? '700' : '400',
                        border: isToday ? '2px solid var(--green)' : '2px solid transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      {day.getDate()}
                    </div>
                  );
                })}
              </div>

              {/* Légende */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: '#2D6A4F', marginRight: '4px' }} />Complet</span>
                <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: '#C49A3C', marginRight: '4px' }} />Partiel</span>
                <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: '#E0E0E0', marginRight: '4px' }} />Rien</span>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Détail du jour sélectionné */}
      {selectedDay && (
        <div className="card">
          <div className="card-header" style={{ background: 'var(--blue)' }}>
            {selectedDay.etabNom} — {selectedDay.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            <button onClick={() => setSelectedDay(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer' }}>✕</button>
          </div>
          <div className="card-body">
            {(() => {
              const entries = getDayEntries(selectedDay.date, selectedDay.etabId);
              if (entries.length === 0) return <p style={{ color: 'var(--text-secondary)' }}>Aucun enregistrement ce jour</p>;
              const byType = {};
              entries.forEach(e => {
                if (!byType[e.type]) byType[e.type] = [];
                byType[e.type].push(e);
              });
              return Object.entries(byType).map(([type, list]) => (
                <div key={type} style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {type} ({list.length})
                  </div>
                  {list.map((e, i) => (
                    <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                      {new Date(e.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — {e.createdBy ? `${e.createdBy.prenom} ${e.createdBy.nom}` : '—'}
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
