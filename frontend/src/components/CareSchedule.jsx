import React, { useState, useEffect } from 'react';
import { Pill, Syringe, Clock, CheckCircle, XCircle, RotateCcw, Plus, Trash2 } from 'lucide-react';

const initialSchedules = [
  { id: '1', type: 'Medication', name: 'Norepinephrine', dose: '0.05 mcg/kg/min', time: '08:00', status: 'Pending' },
  { id: '2', type: 'Injection', name: 'Ceftriaxone', dose: '1g IV', time: '10:00', status: 'Pending' },
  { id: '3', type: 'Checkup', name: 'Vitals & GCS', dose: '-', time: '12:00', status: 'Pending' }
];

const CareSchedule = ({ patientId, patientName, role }) => {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [newMed, setNewMed] = useState({ type: 'Medication', name: '', dose: '', time: '' });
  const [isAdding, setIsAdding] = useState(false);

  // Load from local storage to mock backend persistence for this session
  useEffect(() => {
    const saved = localStorage.getItem(`care_schedules_${patientId}`);
    if (saved) {
      setSchedules(JSON.parse(saved));
    }
  }, [patientId]);

  const saveSchedules = (updated) => {
    setSchedules(updated);
    localStorage.setItem(`care_schedules_${patientId}`, JSON.stringify(updated));
  };

  const handleStatusChange = (id, newStatus) => {
    const updated = schedules.map(s => s.id === id ? { ...s, status: newStatus } : s);
    saveSchedules(updated);
  };

  const handleAddSchedule = () => {
    if (!newMed.name || !newMed.time) return;
    const newEntry = {
      id: Date.now().toString(),
      ...newMed,
      status: 'Pending'
    };
    saveSchedules([...schedules, newEntry]);
    setNewMed({ type: 'Medication', name: '', dose: '', time: '' });
    setIsAdding(false);
  };

  const handleDelete = (id) => {
    saveSchedules(schedules.filter(s => s.id !== id));
  };

  const canEdit = role === 'DOCTOR' || role === 'ADMIN';

  return (
    <div style={{ background: 'var(--surface2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--teal)' }}>
          <Clock size={18} /> Care Schedules & Interventions
        </h3>
        {canEdit && (
          <button 
            onClick={() => setIsAdding(!isAdding)}
            style={{ background: 'rgba(0, 212, 170, 0.1)', border: '1px solid var(--teal)', color: 'var(--teal)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {isAdding ? 'Cancel' : <><Plus size={14} /> Prescribe</>}
          </button>
        )}
      </div>

      {isAdding && canEdit && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
          <select 
            value={newMed.type} 
            onChange={e => setNewMed({...newMed, type: e.target.value})}
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px', fontSize: '0.8rem' }}
          >
            <option>Medication</option>
            <option>Injection</option>
            <option>Checkup</option>
          </select>
          <input type="text" placeholder="Name (e.g. Aspirin)" value={newMed.name} onChange={e => setNewMed({...newMed, name: e.target.value})} style={{ flex: 1, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px', fontSize: '0.8rem' }} />
          <input type="text" placeholder="Dose" value={newMed.dose} onChange={e => setNewMed({...newMed, dose: e.target.value})} style={{ width: '80px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px', fontSize: '0.8rem' }} />
          <input type="time" value={newMed.time} onChange={e => setNewMed({...newMed, time: e.target.value})} style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px', fontSize: '0.8rem' }} />
          <button onClick={handleAddSchedule} style={{ background: 'var(--teal)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Add</button>
        </div>
      )}

      {schedules.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px' }}>No pending care schedules for {patientName}.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {schedules.map(s => {
            const isGiven = s.status === 'Given';
            const isMissed = s.status === 'Missed';
            return (
              <div key={s.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '10px 12px', 
                background: isGiven ? 'rgba(0, 212, 170, 0.05)' : isMissed ? 'rgba(255, 77, 106, 0.05)' : 'rgba(255, 255, 255, 0.02)', 
                borderLeft: `3px solid ${isGiven ? 'var(--teal)' : isMissed ? '#ff4d6a' : 'var(--border)'}`,
                borderRadius: '4px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {s.type === 'Medication' ? <Pill size={16} color="var(--text-dim)" /> : s.type === 'Injection' ? <Syringe size={16} color="var(--text-dim)" /> : <Clock size={16} color="var(--text-dim)" />}
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isMissed ? '#ff4d6a' : 'var(--text)', textDecoration: isGiven ? 'line-through' : 'none' }}>
                      {s.name} {s.dose && <span style={{ fontWeight: 'normal', color: 'var(--text-dim)' }}>({s.dose})</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Due: {s.time}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {s.status === 'Pending' ? (
                    <>
                      <button onClick={() => handleStatusChange(s.id, 'Given')} style={{ background: 'none', border: '1px solid var(--teal)', color: 'var(--teal)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={12} /> Mark Given
                      </button>
                      <button onClick={() => handleStatusChange(s.id, 'Missed')} style={{ background: 'none', border: '1px solid #ff4d6a', color: '#ff4d6a', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <XCircle size={12} /> Missed
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '0.75rem', color: isGiven ? 'var(--teal)' : '#ff4d6a', fontWeight: 'bold', marginRight: '8px' }}>{s.status}</span>
                      <button onClick={() => handleStatusChange(s.id, 'Pending')} title="Undo" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <RotateCcw size={14} />
                      </button>
                    </>
                  )}
                  {canEdit && (
                    <button onClick={() => handleDelete(s.id)} title="Delete Prescription" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CareSchedule;
