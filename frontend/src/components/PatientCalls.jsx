import React, { useState, useEffect } from 'react';
import { Bell, Check, Edit2 } from 'lucide-react';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const PatientCalls = ({ role, username }) => {
  const [calls, setCalls] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [tempNotes, setTempNotes] = useState('');

  const fetchCalls = () => {
    fetch(`${API_URL}/api/patient-calls`)
      .then(res => res.json())
      .then(data => setCalls(data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchCalls();
    const socket = io(API_URL);
    socket.on('patient_call_alert', () => {
      fetchCalls();
    });
    return () => socket.disconnect();
  }, []);

  const handleResolve = (id, notes = undefined) => {
    fetch(`${API_URL}/api/patient-calls/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Resolved', ...(notes !== undefined && { notes }) })
    }).then(() => {
      fetchCalls();
      setEditingId(null);
    });
  };

  const handleUpdateNotes = (id) => {
    fetch(`${API_URL}/api/patient-calls/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: tempNotes })
    }).then(() => {
      fetchCalls();
      setEditingId(null);
    });
  };

  const activeCalls = calls.filter(c => c.status === 'Active');

  if (role !== 'NURSE' && role !== 'DOCTOR' && role !== 'ADMIN') return null;

  return (
    <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px' }}>
      <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4d6a' }}>
        <Bell size={18} /> Patient Assistance Requests
        {activeCalls.length > 0 && (
          <span style={{ background: '#ff4d6a', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
            {activeCalls.length} New
          </span>
        )}
      </h3>

      {activeCalls.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '10px' }}>
          No active patient requests.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeCalls.map(call => (
            <div key={call.id} style={{ padding: '12px', background: 'rgba(255, 77, 106, 0.05)', borderLeft: '3px solid #ff4d6a', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>Patient Request: {call.patientName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(call.timestamp).toLocaleTimeString()}</div>
                </div>
                {role === 'NURSE' && (
                  <button onClick={() => handleResolve(call.id)} className="btn" style={{ background: 'var(--teal)', color: 'var(--bg)', border: 'none', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Resolve
                  </button>
                )}
              </div>
              
              <div style={{ marginTop: '8px' }}>
                {editingId === call.id ? (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input 
                      type="text" 
                      value={tempNotes} 
                      onChange={e => setTempNotes(e.target.value)} 
                      placeholder="Add short note (e.g. Needs water)" 
                      style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.8rem' }}
                      autoFocus
                    />
                    <button onClick={() => handleUpdateNotes(call.id)} style={{ background: 'var(--teal)', color: 'var(--bg)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: call.notes ? 'var(--text)' : 'var(--text-muted)' }}>
                      {call.notes ? `Note: ${call.notes}` : 'No notes added.'}
                    </div>
                    {role === 'NURSE' && (
                      <button onClick={() => { setEditingId(call.id); setTempNotes(call.notes || ''); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientCalls;
