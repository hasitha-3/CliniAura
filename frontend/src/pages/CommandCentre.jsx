import React, { useEffect, useState } from 'react';
import useWardStore from '../stores/wardStore';
import io from 'socket.io-client';
import { Activity, Bell, CheckCircle, HeartPulse, Stethoscope, AlertTriangle, Search, Battery, Wifi, Zap, Plus, Sliders, Layers, RefreshCw } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

const CommandCentre = () => {
  const { beds, getActiveAlerts, updateVitals, acknowledgeAlert } = useWardStore();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Advanced Filtering & Search States
  const [selectedWard, setSelectedWard] = useState('All');
  const [selectedRisk, setSelectedRisk] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Interactive Action Feedback State (patientId -> message)
  const [actionFeedback, setActionFeedback] = useState({});

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;

    // Fetch authorized patient listings
    fetch(`${API_URL}/api/patients`, {
      headers: { 
        'Authorization': `Bearer ${token || ''}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Authorization required or stream offline');
        return res.json();
      })
      .then(data => {
        setPatients(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });

    const socket = io(API_URL);
    
    socket.on('vitals_update', (data) => {
      if (data?.vitals) {
        updateVitals(data.vitals.patientId, data.vitals, null);
      }
    });

    socket.on('alarm:new', (data) => {
      updateVitals(data.patientId, null, data.message);
    });

    socket.on('alarm:escalation', (data) => {
      updateVitals(data.patientId, null, `ESCALATION: ${data.message}`);
    });

    // Automatically trigger monitoring for all loaded patients to keep telemetry live
    fetch(`${API_URL}/api/patients`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then(pts => {
        if (Array.isArray(pts)) {
          pts.forEach(p => socket.emit('start_monitoring', p._id));
        }
      })
      .catch(() => {});

    return () => socket.close();
  }, [updateVitals]);

  const activeAlerts = getActiveAlerts();

  // Handle local stateful intervention logging
  const logIntervention = (patientId, actionName) => {
    setActionFeedback(prev => ({ ...prev, [patientId]: `${actionName} Logged` }));
    setTimeout(() => {
      setActionFeedback(prev => {
        const next = { ...prev };
        delete next[patientId];
        return next;
      });
    }, 3500);
  };

  // Filter patients based on selected ward, risk, and search queries
  const filteredPatients = patients.filter(pt => {
    const matchesWard = selectedWard === 'All' || pt.ward === selectedWard;
    const matchesRisk = selectedRisk === 'All' || pt.riskScore === selectedRisk;
    const matchesSearch = !searchTerm || 
      pt.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pt.activeProtocol && pt.activeProtocol.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesWard && matchesRisk && matchesSearch;
  });

  const wards = ['All', 'Intensive Care', 'Step-Down Unit', 'General Ward'];
  const risks = ['All', 'Critical', 'High', 'Moderate', 'Low'];

  if (loading) {
    return (
      <div className="dashboard-container" style={{ textAlign: 'center', padding: '100px', color: 'var(--text-dim)' }}>
        <RefreshCw size={32} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 16px', color: 'var(--teal)' }} />
        <h3>Initializing Edge Stream...</h3>
        <p>Connecting to distributed biosensor clusters</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Advanced Control Bar */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Ward Quick Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Layers size={14} /> Ward:
          </span>
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg2)', padding: '4px', borderRadius: '100px', border: '1px solid var(--border)' }}>
            {wards.map(w => (
              <button
                key={w}
                onClick={() => setSelectedWard(w)}
                style={{
                  padding: '4px 14px',
                  borderRadius: '100px',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: selectedWard === w ? '600' : '500',
                  background: selectedWard === w ? 'var(--teal)' : 'transparent',
                  color: selectedWard === w ? 'var(--bg)' : 'var(--text-dim)',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Risk Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sliders size={14} /> HPI Tier:
          </span>
          <select 
            value={selectedRisk} 
            onChange={e => setSelectedRisk(e.target.value)}
            style={{
              background: 'var(--bg2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '500',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {risks.map(r => <option key={r} value={r}>{r} Risk</option>)}
          </select>
        </div>

        {/* Dynamic Search Box */}
        <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '350px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search patient name or protocol..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '100px',
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              fontSize: '0.85rem',
              outline: 'none',
              transition: 'border-color 0.3s'
            }}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'0.75rem' }}
            >
              ✕
            </button>
          )}
        </div>

      </div>

      {error && (
        <div className="alert-banner" style={{ margin: 0 }}>
          <AlertTriangle size={20} />
          <div><strong>Connection / Auth Warning:</strong> {error}</div>
        </div>
      )}

      {/* Main Grid View Area */}
      <div style={{ display: 'flex', gap: '24px', flex: 1, alignItems: 'stretch' }}>
        
        {/* Active Alerts Escalation Desk (Left Sidebar) */}
        <div className="glass-panel" style={{ width: '320px', display: 'flex', flexDirection: 'column', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4d6a', margin: 0 }}>
              <Bell size={18} /> Escalation Desk
            </h3>
            <span style={{ background: 'rgba(255,77,106,0.15)', color: '#ff4d6a', padding: '2px 8px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {activeAlerts.length}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
            {activeAlerts.map(alert => {
              const pt = patients.find(p => p._id === alert.patientId);
              return (
                <div key={alert.id} style={{ 
                  background: 'rgba(255, 77, 106, 0.06)', 
                  border: '1px solid rgba(255, 77, 106, 0.3)', 
                  padding: '12px', 
                  borderRadius: '12px',
                  animation: 'fade-up 0.3s ease'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text)' }}>{pt?.username || 'Biosensor Anchor'}</strong>
                    {pt && <span className={`badge-risk risk-${pt.riskScore}`}>{pt.riskScore}</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#ff8093', marginBottom: '10px', lineHeight: 1.4 }}>{alert.message}</div>
                  
                  <button 
                    onClick={() => acknowledgeAlert(alert.id)}
                    style={{ 
                      width: '100%', 
                      padding: '6px', 
                      borderRadius: '6px', 
                      border: 'none', 
                      background: '#ff4d6a', 
                      color: 'white', 
                      fontWeight: '600', 
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={e => e.target.style.background = '#e03c58'}
                    onMouseOut={e => e.target.style.background = '#ff4d6a'}
                  >
                    <CheckCircle size={14} /> Acknowledge Stream Alert
                  </button>
                </div>
              );
            })}

            {activeAlerts.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 10px', margin: 'auto 0' }}>
                <CheckCircle size={36} style={{ color: 'var(--teal)', opacity: 0.6, marginBottom: '10px' }} />
                <div style={{ fontSize: '0.95rem', fontWeight: '500', color: 'var(--text-dim)' }}>Zero Unacknowledged Alerts</div>
                <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>All multi-patient telemetry signals operational within nominal clinical limits.</div>
              </div>
            )}
          </div>
        </div>

        {/* Multi-Patient Bed Map Cards */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              Showing <strong style={{color:'var(--teal)'}}>{filteredPatients.length}</strong> of {patients.length} Registered Nodes
            </div>
            {searchTerm || selectedWard !== 'All' || selectedRisk !== 'All' ? (
              <button 
                onClick={() => { setSelectedWard('All'); setSelectedRisk('All'); setSearchTerm(''); }}
                style={{ background:'none', border:'none', color:'var(--cyan)', fontSize:'0.8rem', cursor:'pointer', textDecoration:'underline' }}
              >
                Reset All Filters
              </button>
            ) : null}
          </div>

          {filteredPatients.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
              <Activity size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
              <h4 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>No matching beds found</h4>
              <p style={{ fontSize: '0.85rem' }}>Adjust your ward filter, risk parameters, or search string.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2" style={{ gap: '20px' }}>
              {filteredPatients.map((pt, i) => {
                const bedData = beds.find(b => b.patientId === pt._id);
                const v = bedData?.latestVitals;
                const isCritical = activeAlerts.some(a => a.patientId === pt._id);
                const feedback = actionFeedback[pt._id];

                // Calculate history trends
                const sparkData = bedData?.history?.map(h => ({ 
                  val: Math.round((h.bloodPressureSys + (2 * h.bloodPressureDia)) / 3) 
                })) || [];

                // SQI Color rating
                const sqi = pt.signalQualityIndex !== undefined ? pt.signalQualityIndex : 95;
                const sqiColor = sqi > 90 ? 'var(--teal)' : sqi > 75 ? '#ffa64d' : '#ff4d6a';

                // Battery Rating
                const bat = pt.batteryLevel !== undefined ? pt.batteryLevel : 92;
                const batColor = bat > 50 ? '#22c55e' : bat > 20 ? '#ffa64d' : '#ff4d6a';

                return (
                  <div 
                    key={pt._id} 
                    className="glass-panel" 
                    style={{ 
                      padding: '20px', 
                      position: 'relative',
                      border: isCritical ? '2px solid #ff4d6a' : '1px solid var(--border)',
                      boxShadow: isCritical ? '0 0 25px rgba(255,77,106,0.2)' : 'var(--glow)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.3s'
                    }}
                  >
                    {/* Top Identifiers */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text)' }}>
                            {pt.username}
                          </span>
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface2)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>
                            {pt.ward || 'General Ward'}
                          </span>
                        </div>
                        <span className={`badge-risk risk-${pt.riskScore}`}>{pt.riskScore}</span>
                      </div>

                      {/* Device Metadata Badges (SQI, Battery, Adapter) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Signal Quality Index">
                          <Wifi size={12} color={sqiColor} />
                          <span>SQI: <strong style={{color: sqiColor}}>{sqi}%</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Sensor Battery Level">
                          <Battery size={12} color={batColor} />
                          <span>Bat: <strong style={{color: batColor}}>{bat}%</strong></span>
                        </div>
                        <div className="truncate" style={{ maxWidth: '130px' }} title="Assigned IoT Hardware Anchor">
                          ⚓ {pt.deviceType || 'MBS-Adapter'}
                        </div>
                      </div>

                      {/* Vitals Overview Metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px', background: 'var(--bg2)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(0,212,170,0.05)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Heart Rate</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: v?.heartRate > 100 ? '#ff4d6a' : 'var(--text)' }}>
                            {v?.heartRate || '--'} <span style={{fontSize:'0.65rem', fontWeight:'normal', color:'var(--text-muted)'}}>bpm</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SpO2 Sat</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: v?.spO2 < 94 ? '#ff4d6a' : 'var(--teal)' }}>
                            {v?.spO2 || '--'} <span style={{fontSize:'0.65rem', fontWeight:'normal', color:'var(--text-muted)'}}>%</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Calc MAP</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--cyan)' }}>
                            {v ? Math.round((v.bloodPressureSys + (2 * v.bloodPressureDia)) / 3) : '--'} <span style={{fontSize:'0.65rem', fontWeight:'normal', color:'var(--text-muted)'}}>mmHg</span>
                          </div>
                        </div>
                      </div>

                      {/* Active Audited Protocol */}
                      {pt.activeProtocol && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--teal-dim)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                          <Stethoscope size={13} style={{ flexShrink: 0 }} />
                          <span className="truncate" title={pt.activeProtocol}>Protocol: {pt.activeProtocol}</span>
                        </div>
                      )}

                      {/* Inline Sparkline Graphic */}
                      <div style={{ height: '35px', width: '100%', marginBottom: '12px' }}>
                        {sparkData.length > 1 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sparkData}>
                              <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                              <Tooltip 
                                contentStyle={{ background: '#050a10', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.75rem', padding: '2px 6px' }} 
                                labelStyle={{display:'none'}}
                              />
                              <Line type="monotone" dataKey="val" stroke={isCritical ? '#ff4d6a' : 'var(--cyan)'} strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textAlign:'center', lineHeight:'35px' }}>
                            Collecting edge points...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Drawers / State Logging Buttons */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: 'auto' }}>
                      {feedback ? (
                        <div style={{ padding: '6px', background: 'rgba(0,212,170,0.1)', color: 'var(--teal)', textAlign: 'center', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', animation: 'fade-up 0.2s ease' }}>
                          ✓ {feedback}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => logIntervention(pt._id, 'Fluid Bolus')}
                            style={{
                              flex: 1,
                              padding: '6px',
                              background: 'var(--surface2)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              color: 'var(--text)',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={e => { e.target.style.borderColor = 'var(--teal)'; e.target.style.color = 'var(--teal)'; }}
                            onMouseOut={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text)'; }}
                          >
                            <Plus size={12} /> Bolus
                          </button>
                          
                          <button
                            onClick={() => logIntervention(pt._id, 'Vasopressor Titration')}
                            style={{
                              flex: 1,
                              padding: '6px',
                              background: 'var(--surface2)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              color: 'var(--text)',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={e => { e.target.style.borderColor = 'var(--cyan)'; e.target.style.color = 'var(--cyan)'; }}
                            onMouseOut={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text)'; }}
                          >
                            <Zap size={12} /> Titrate
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default CommandCentre;
