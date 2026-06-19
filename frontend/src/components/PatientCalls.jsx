import React, { useState, useEffect } from 'react';
import { Bell, Check, Edit2 } from 'lucide-react';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

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
      body: JSON.stringify({ 
        status: 'Resolved', 
        resolvedBy: username,
        resolvedByRole: role,
        ...(notes !== undefined && { notes }) 
      })
    }).then(() => {
      fetchCalls();
      setEditingId(null);
    });
  };

  const handleForward = (id) => {
    fetch(`${API_URL}/api/patient-calls/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'Forwarded',
        resolvedBy: username,
        resolvedByRole: role
      })
    }).then(() => {
      fetchCalls();
      setEditingId(null);
    });
  };

  const handleUpdateNotes = (id) => {
    const newNote = {
      role: normalizedRole,
      author: username,
      text: tempNotes,
      timestamp: new Date().toISOString()
    };
    fetch(`${API_URL}/api/patient-calls/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: newNote })
    }).then(() => {
      fetchCalls();
      setEditingId(null);
    });
  };

  const normalizedRole = role?.toUpperCase();
  if (normalizedRole !== 'NURSE' && normalizedRole !== 'DOCTOR' && normalizedRole !== 'ADMIN') return null;

  const displayCalls = calls.filter(c => {
    if (normalizedRole === 'NURSE') return c.status === 'Active' || c.status === 'Forwarded';
    if (normalizedRole === 'DOCTOR') return c.status === 'Forwarded';
    return c.status === 'Active' || c.status === 'Forwarded'; // Admin sees all
  });

  return (
    <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px' }}>
      <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4d6a' }}>
        <Bell size={18} /> Patient Assistance Requests
        {displayCalls.length > 0 && (
          <span style={{ background: '#ff4d6a', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
            {displayCalls.length} Pending
          </span>
        )}
      </h3>

      {displayCalls.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '10px' }}>
          No active patient requests.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayCalls.map(call => (
            <div key={call.id} style={{ padding: '12px', background: call.status === 'Forwarded' ? 'rgba(255, 165, 0, 0.05)' : 'rgba(255, 77, 106, 0.05)', borderLeft: call.status === 'Forwarded' ? '3px solid orange' : '3px solid #ff4d6a', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>Patient Request: {call.patientName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(call.timestamp).toLocaleTimeString()} - Status: <span style={{ color: call.status === 'Forwarded' ? 'orange' : '#ff4d6a' }}>{call.status}</span></div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {normalizedRole === 'NURSE' && call.status === 'Active' && (
                    <>
                      <button onClick={() => handleForward(call.id)} className="btn" style={{ background: 'orange', color: 'white', border: 'none', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>
                        Forward to Doctor
                      </button>
                      <button onClick={() => handleResolve(call.id)} className="btn" style={{ background: 'var(--teal)', color: 'var(--bg)', border: 'none', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px', cursor: 'pointer' }}>
                        <Check size={14} /> Resolve
                      </button>
                    </>
                  )}
                  {normalizedRole === 'DOCTOR' && call.status === 'Forwarded' && (
                    <button onClick={() => handleResolve(call.id)} className="btn" style={{ background: 'var(--teal)', color: 'var(--bg)', border: 'none', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px', cursor: 'pointer' }}>
                      <Check size={14} /> Mark as Solved
                    </button>
                  )}
                </div>
              </div>
              
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '8px' }}>
                  {Array.isArray(call.notes) && call.notes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {call.notes.map((n, i) => (
                        <div key={i} style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '4px', borderLeft: n.role === 'DOCTOR' ? '2px solid #38bdf8' : '2px solid var(--teal)' }}>
                          <span style={{ color: n.role === 'DOCTOR' ? '#38bdf8' : 'var(--teal)', fontWeight: 'bold', marginRight: '6px' }}>[{n.role} - {new Date(n.timestamp).toLocaleTimeString()}]:</span>
                          {n.text}
                        </div>
                      ))}
                    </div>
                  ) : typeof call.notes === 'string' && call.notes ? (
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '4px', borderLeft: '2px solid var(--teal)' }}>
                      <span style={{ color: 'var(--teal)', fontWeight: 'bold', marginRight: '6px' }}>[Note]:</span>
                      {call.notes}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>No notes added.</span>
                  )}
                </div>

                {editingId === call.id ? (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input 
                      type="text" 
                      value={tempNotes} 
                      onChange={e => setTempNotes(e.target.value)} 
                      placeholder="Add a new note..." 
                      style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.8rem' }}
                      autoFocus
                    />
                    <button onClick={() => handleUpdateNotes(call.id)} style={{ background: 'var(--teal)', color: 'var(--bg)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Send Note</button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {(normalizedRole === 'NURSE' || normalizedRole === 'DOCTOR') && (
                      <button onClick={() => { setEditingId(call.id); setTempNotes(''); }} style={{ background: 'transparent', border: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Edit2 size={12} /> Reply Note
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
