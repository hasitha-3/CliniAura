import React, { useState, useEffect } from 'react';
import { Pill, Syringe, Clock, CheckCircle, XCircle, RotateCcw, Plus, Trash2 } from 'lucide-react';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const initialSchedules = [];

const CareSchedule = ({ patientId, patientName, role }) => {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [newMed, setNewMed] = useState({ type: 'Medication', name: '', dose: '', time: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [docNotes, setDocNotes] = useState('');
  const [socket, setSocket] = useState(null);

  // Role permissions
  const canPrescribe = role === 'DOCTOR';
  const canAdminister = role === 'NURSE' || role === 'DOCTOR';

  // Pre-configured Templates
  const templates = {
    'Sepsis Bundle (Medicines)': [
      { id: Date.now() + '1', type: 'Medication', name: 'Norepinephrine', dose: '0.05 mcg/kg/min', time: '08:00', status: 'Pending' },
      { id: Date.now() + '2', type: 'Injection', name: 'Broad-Spectrum Antibiotic', dose: '1g IV', time: '08:15', status: 'Pending' },
      { id: Date.now() + '3', type: 'Checkup', name: 'Lactate Level Draw', dose: '-', time: '08:30', status: 'Pending' }
    ],
    'Cardiac Recovery (Tonics/Meds)': [
      { id: Date.now() + '1', type: 'Medication', name: 'Beta Blocker', dose: '25mg', time: '09:00', status: 'Pending' },
      { id: Date.now() + '2', type: 'Medication', name: 'ACE Inhibitor', dose: '10mg', time: '09:00', status: 'Pending' },
      { id: Date.now() + '3', type: 'Checkup', name: 'ECG Check', dose: '-', time: '12:00', status: 'Pending' }
    ],
    'Physical Therapy (Exercises)': [
      { id: Date.now() + '1', type: 'Checkup', name: 'Bedside Mobilization', dose: '15 mins', time: '10:00', status: 'Pending' },
      { id: Date.now() + '2', type: 'Checkup', name: 'Incentive Spirometry', dose: '10 breaths', time: '14:00', status: 'Pending' }
    ]
  };

  useEffect(() => {
    // Fetch initial schedule
    fetch(`${API_URL}/api/care-schedule/${patientId}`)
      .then(res => res.json())
      .then(data => setSchedules(data))
      .catch(console.error);

    const savedNotes = localStorage.getItem(`doc_notes_${patientId}`);
    if (savedNotes) setDocNotes(savedNotes);

    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('schedule_updated', (data) => {
      if (data.patientId === patientId) {
        setSchedules(data.schedules);
      }
    });

    return () => newSocket.disconnect();
  }, [patientId]);

  const saveSchedules = async (updated) => {
    setSchedules(updated);
    try {
      await fetch(`${API_URL}/api/care-schedule/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (socket) {
        socket.emit('update_schedule', { patientId, schedules: updated });
      }
    } catch (e) {
      console.error('Failed to sync schedule', e);
    }
  };

  const saveDocNotes = (notes) => {
    setDocNotes(notes);
    localStorage.setItem(`doc_notes_${patientId}`, notes);
  };

  const handleStatusChange = (id, newStatus) => {
    if (!canAdminister) return;
    const actionTime = newStatus === 'Pending' ? null : new Date().toLocaleTimeString();
    const updated = schedules.map(s => s.id === id ? { ...s, status: newStatus, actionTime } : s);
    saveSchedules(updated);
  };

  const handleAddSchedule = () => {
    if (!newMed.name || !newMed.time || !canPrescribe) return;
    const newEntry = {
      id: Date.now().toString(),
      ...newMed,
      status: 'Pending',
      prescribedTime: new Date().toLocaleTimeString()
    };
    saveSchedules([...schedules, newEntry]);
    setNewMed({ type: 'Medication', name: '', dose: '', time: '' });
    setIsAdding(false);
  };

  const applyTemplate = (templateName) => {
    if (!templateName || !canPrescribe) return;
    const pTime = new Date().toLocaleTimeString();
    const newItems = templates[templateName].map(item => ({ ...item, prescribedTime: pTime }));
    saveSchedules([...schedules, ...newItems]);
    setIsAdding(false);
  };

  const handleDelete = (id) => {
    if (!canPrescribe) return;
    saveSchedules(schedules.filter(s => s.id !== id));
  };

  return (
    <div style={{ background: 'var(--surface2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--teal)' }}>
          <Clock size={18} /> Care Schedules & Interventions
        </h3>
        {canPrescribe && (
          <button 
            onClick={() => setIsAdding(!isAdding)}
            style={{ background: 'rgba(0, 212, 170, 0.1)', border: '1px solid var(--teal)', color: 'var(--teal)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {isAdding ? 'Cancel' : <><Plus size={14} /> Prescribe</>}
          </button>
        )}
      </div>

      {isAdding && canPrescribe && (
        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px dashed var(--border)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>Quick Template:</span>
            <select 
              onChange={e => applyTemplate(e.target.value)}
              style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px', fontSize: '0.8rem', flex: 1 }}
            >
              <option value="">-- Select a Category Template --</option>
              {Object.keys(templates).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', textAlign: 'center' }}>- OR CUSTOM ENTRY -</div>
          <div style={{ display: 'flex', gap: '8px' }}>
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
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Due: {s.time} | Prescribed at: {s.prescribedTime || '--:--'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {s.status === 'Pending' ? (
                    <>
                      {canAdminister && (
                        <>
                          <button onClick={() => handleStatusChange(s.id, 'Given')} style={{ background: 'none', border: '1px solid var(--teal)', color: 'var(--teal)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={12} /> Mark Given
                          </button>
                          <button onClick={() => handleStatusChange(s.id, 'Missed')} style={{ background: 'none', border: '1px solid #ff4d6a', color: '#ff4d6a', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <XCircle size={12} /> Missed
                          </button>
                        </>
                      )}
                      {!canAdminister && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending</span>}
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: isGiven ? 'var(--teal)' : '#ff4d6a', fontWeight: 'bold' }}>{s.status}</span>
                        {s.actionTime && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>at {s.actionTime}</span>}
                      </div>
                      {canAdminister && (
                        <button onClick={() => handleStatusChange(s.id, 'Pending')} title="Undo" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </>
                  )}
                  {canPrescribe && (
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
      {role === 'DOCTOR' && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#94a3b8' }}>Doctor's Quick Notes (Private)</h4>
          <textarea 
            value={docNotes}
            onChange={(e) => saveDocNotes(e.target.value)}
            placeholder="Add internal clinical observations here..."
            style={{ 
              width: '100%', 
              height: '80px', 
              background: 'rgba(0,0,0,0.2)', 
              border: '1px solid var(--border)', 
              color: 'var(--text)', 
              padding: '10px', 
              borderRadius: '6px',
              resize: 'vertical',
              fontSize: '0.85rem'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CareSchedule;
