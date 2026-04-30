import React, { useEffect, useState } from 'react';
import { Bell, Settings, ShieldAlert, Activity } from 'lucide-react';

const AlarmSettings = () => {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    fetch(`${API_URL}/api/alarms/burden-report`)
      .then(res => res.json())
      .then(data => setReports(data));
  }, []);

  return (
    <div className="dashboard-container" style={{ padding: '20px 40px' }}>
      <h2><Settings className="text-gradient" style={{ display: 'inline', marginRight: '10px' }} /> Alarm Orchestration & Settings</h2>
      <p style={{ color: '#94a3b8', marginBottom: '30px' }}>Configure intelligent alarm clustering, suppression timers, and multi-tier escalation to reduce nurse fatigue.</p>
      
      <div className="grid grid-cols-2" style={{ gap: '30px' }}>
        <div className="glass-panel">
          <h3 style={{ marginBottom: '20px' }}><ShieldAlert style={{ display: 'inline', marginRight: '10px', color: '#38bdf8' }} /> Suppression & Escalation Rules</h3>
          
          <div className="input-group">
            <label className="input-label">Clustering Window (minutes)</label>
            <input className="input-field" type="number" value="5" disabled style={{ opacity: 0.7 }} />
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '5px' }}>Groups multiple alarms for the same patient within this window.</div>
          </div>

          <div className="input-group">
            <label className="input-label">Post-Acknowledge Suppression (minutes)</label>
            <input className="input-field" type="number" value="20" disabled style={{ opacity: 0.7 }} />
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '5px' }}>Silences identical alarms after a nurse has acknowledged them.</div>
          </div>

          <div className="input-group" style={{ borderTop: '1px solid #334155', paddingTop: '20px', marginTop: '20px' }}>
            <label className="input-label">Tier 2 Escalation: Charge Nurse (minutes)</label>
            <input className="input-field" type="number" value="3" disabled style={{ opacity: 0.7 }} />
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '5px' }}>Notifies via WhatsApp if Tier 1 ignores the alarm.</div>
          </div>

          <div className="input-group">
            <label className="input-label">Tier 3 Escalation: On-Call Doctor (minutes)</label>
            <input className="input-field" type="number" value="8" disabled style={{ opacity: 0.7 }} />
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '5px' }}>Critical SMS sent to on-call physician.</div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px', opacity: 0.5 }}>Save Configuration (Admin Only)</button>
        </div>

        <div className="glass-panel">
          <h3 style={{ marginBottom: '20px' }}><Activity style={{ display: 'inline', marginRight: '10px', color: '#ef4444' }} /> Recent Escalation Report</h3>
          <div style={{ height: '400px', overflowY: 'auto' }}>
            {reports.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '100px' }}>No alarm events logged recently.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {reports.map(r => (
                  <li key={r._id} style={{ padding: '15px', borderBottom: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <strong style={{ color: r.tier === 1 ? '#e2e8f0' : r.tier === 2 ? '#fbbf24' : '#ef4444' }}>
                        {r.type} (Tier {r.tier})
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(r.sentAt).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '5px' }}>{r.message}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Patient ID: {r.patientId}</span>
                      <span>{r.acknowledgedAt ? `Ack'd by ${r.acknowledgedBy}` : 'Unacknowledged'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlarmSettings;
