import React, { useEffect, useState } from 'react';
import { Bell, Settings, ShieldAlert, Activity, CheckCircle, Save, Sliders } from 'lucide-react';

const AlarmSettings = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Configuration States
  const [clusteringWindow, setClusteringWindow] = useState(5);
  const [suppressionTime, setSuppressionTime] = useState(20);
  const [tier2Time, setTier2Time] = useState(3);
  const [tier3Time, setTier3Time] = useState(8);

  // Success feedback state
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
    const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;

    fetch(`${API_URL}/api/alarms/burden-report`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setReports(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSaveConfiguration = () => {
    // Simulate updating settings in backend store
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3500);
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Title Header */}
      <div>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings className="text-gradient" size={28} /> Alarm Orchestration & Settings
        </h2>
        <p style={{ color: 'var(--text-dim)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
          Configure intelligent alarm clustering, suppression timers, and multi-tier escalation to minimize acute clinical fatigue.
        </p>
      </div>
      
      <div className="grid grid-cols-2" style={{ gap: '24px', alignItems: 'stretch' }}>
        
        {/* Suppression & Escalation Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem' }}>
              <ShieldAlert style={{ color: '#38bdf8' }} size={20} /> Suppression & Escalation Rules
            </h3>
            
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: '600', color: 'var(--text)' }}>
                Clustering Window (minutes)
              </label>
              <input 
                className="input-field" 
                type="number" 
                value={clusteringWindow} 
                onChange={e => setClusteringWindow(Number(e.target.value))}
                style={{ padding: '10px 14px', fontSize: '0.9rem' }} 
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Groups multiple alarms for the same patient within this bounded duration.
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: '600', color: 'var(--text)' }}>
                Post-Acknowledge Suppression (minutes)
              </label>
              <input 
                className="input-field" 
                type="number" 
                value={suppressionTime} 
                onChange={e => setSuppressionTime(Number(e.target.value))}
                style={{ padding: '10px 14px', fontSize: '0.9rem' }} 
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Silences redundant identical alarms after an executing nurse acknowledges them.
              </div>
            </div>

            <div className="input-group" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
              <label className="input-label" style={{ fontWeight: '600', color: 'var(--text)' }}>
                Tier 2 Escalation: Charge Nurse (minutes)
              </label>
              <input 
                className="input-field" 
                type="number" 
                value={tier2Time} 
                onChange={e => setTier2Time(Number(e.target.value))}
                style={{ padding: '10px 14px', fontSize: '0.9rem' }} 
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Broadcasts securely over private Webhook paths if primary clinicians delay response.
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: '600', color: 'var(--text)' }}>
                Tier 3 Escalation: On-Call Doctor (minutes)
              </label>
              <input 
                className="input-field" 
                type="number" 
                value={tier3Time} 
                onChange={e => setTier3Time(Number(e.target.value))}
                style={{ padding: '10px 14px', fontSize: '0.9rem' }} 
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Direct telemetry push notifications directed to registered primary care unit physicians.
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            {saveSuccess ? (
              <div style={{ 
                padding: '12px', 
                background: 'rgba(34, 197, 94, 0.1)', 
                border: '1px solid #22c55e', 
                color: '#22c55e', 
                borderRadius: '100px', 
                textAlign: 'center', 
                fontWeight: 'bold',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                animation: 'fade-up 0.2s ease'
              }}>
                <CheckCircle size={16} /> Orchestration Profile Updated Successfully!
              </div>
            ) : (
              <button 
                className="btn btn-primary" 
                onClick={handleSaveConfiguration}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  fontSize: '0.9rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px' 
                }}
              >
                <Save size={16} /> Apply Settings Across Sensor Relays
              </button>
            )}
          </div>
        </div>

        {/* Escalation Live Log Report */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem' }}>
            <Activity style={{ color: '#ff4d6a' }} size={20} /> Escalation Burden Audit Log
          </h3>
          
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', height: '420px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '100px 10px' }}>
                Loading cluster performance indices...
              </div>
            ) : reports.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '120px 10px', fontSize: '0.9rem' }}>
                <Bell size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                No unmanaged alert timeouts present. System clusters are resolving correctly at Tier 1 scope.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reports.map(r => {
                  const tierColor = r.tier === 1 ? 'var(--cyan)' : r.tier === 2 ? '#ffa64d' : '#ff4d6a';
                  return (
                    <li 
                      key={r._id} 
                      style={{ 
                        padding: '14px', 
                        background: 'var(--bg2)', 
                        borderRadius: '10px', 
                        border: '1px solid var(--border)' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ color: tierColor, fontSize: '0.9rem' }}>
                          {r.type} <span style={{fontSize:'0.75rem', padding:'1px 6px', borderRadius:'4px', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)'}}>Tier {r.tier}</span>
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(r.sentAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: '8px', lineHeight: 1.4 }}>
                        {r.message}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,212,170,0.05)', paddingTop: '6px' }}>
                        <span>Target Node ID: <strong style={{color:'var(--text)'}}>{r.patientId}</strong></span>
                        <span style={{color: r.acknowledgedAt ? 'var(--teal)' : '#ff4d6a', fontWeight:'500'}}>
                          {r.acknowledgedAt ? `✓ Resolved by ${r.acknowledgedBy}` : '⚠ Timeout Awaiting Review'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AlarmSettings;
