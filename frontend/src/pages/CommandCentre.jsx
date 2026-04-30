import React, { useEffect, useState } from 'react';
import useWardStore from '../stores/wardStore';
import io from 'socket.io-client';
import { Activity, Bell, CheckCircle, HeartPulse, Stethoscope, AlertTriangle } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

const CommandCentre = () => {
  const { beds, getActiveAlerts, updateVitals, acknowledgeAlert } = useWardStore();
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    fetch(`${API_URL}/api/patients`)
      .then(res => res.json())
      .then(data => setPatients(data));

    const socket = io(API_URL);
    
    // We want the backend to emit raw vitals and our frontend store catches it
    // In a real scenario, the backend emits 'ward:update' for all beds.
    // For this implementation, we rely on the existing 'vitals_update' and 'alarm:new'
    
    socket.on('vitals_update', (data) => {
      updateVitals(data.vitals.patientId, data.vitals, null);
    });

    socket.on('alarm:new', (data) => {
      updateVitals(data.patientId, null, data.message);
    });

    socket.on('alarm:escalation', (data) => {
      updateVitals(data.patientId, null, `ESCALATION: ${data.message}`);
    });

    // Automatically trigger monitoring for all patients for the demo
    fetch(`${API_URL}/api/patients`).then(r=>r.json()).then(pts => {
      pts.forEach(p => socket.emit('start_monitoring', p._id));
    });

    return () => socket.close();
  }, [updateVitals]);

  const activeAlerts = getActiveAlerts();

  return (
    <div style={{ padding: '20px', display: 'flex', gap: '20px', height: 'calc(100vh - 80px)' }}>
      {/* Alert Sidebar */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
          <AlertTriangle /> Active Alerts ({activeAlerts.length})
        </h3>
        <div style={{ flex: 1, overflowY: 'auto', marginTop: '15px' }}>
          {activeAlerts.map(alert => {
            const pt = patients.find(p => p._id === alert.patientId);
            return (
              <div key={alert.id} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                <div style={{ fontWeight: 'bold' }}>{pt?.username || 'Unknown Patient'}</div>
                <div style={{ fontSize: '0.85rem', color: '#fca5a5', margin: '5px 0' }}>{alert.message}</div>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '5px', fontSize: '0.8rem', background: '#ef4444' }}
                  onClick={() => acknowledgeAlert(alert.id)}
                >
                  <CheckCircle size={14} style={{ display: 'inline', marginRight: '5px' }}/> Acknowledge
                </button>
              </div>
            );
          })}
          {activeAlerts.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
              <CheckCircle size={32} style={{ margin: '0 auto 10px', color: '#22c55e' }} />
              <div>All clear</div>
            </div>
          )}
        </div>
      </div>

      {/* Bed Map Grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '20px' }}>Ward Command Overview</h2>
        <div className="grid grid-cols-3" style={{ gap: '20px' }}>
          {patients.map((pt, i) => {
            const bedData = beds.find(b => b.patientId === pt._id);
            const v = bedData?.latestVitals;
            const isCritical = activeAlerts.some(a => a.patientId === pt._id);
            
            // Format history for sparkline
            const sparkData = bedData?.history?.map(h => ({ val: Math.round((h.bloodPressureSys + (2 * h.bloodPressureDia)) / 3) })) || [];

            return (
              <div key={pt._id} className="glass-panel" style={{ 
                padding: '15px', 
                border: isCritical ? '2px solid #ef4444' : '1px solid #334155',
                animation: isCritical ? 'pulseAlert 2s infinite' : 'none'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Bed {i + 1}</span>
                  <span className={`badge-risk risk-${pt.riskScore}`}>{pt.riskScore}</span>
                </div>
                <div style={{ color: '#94a3b8', marginBottom: '15px' }}>{pt.username}</div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: v?.heartRate > 100 ? '#ef4444' : '#e2e8f0', fontSize: '1.2rem', fontWeight: 'bold' }}>{v?.heartRate || '--'}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>HR</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: v?.spO2 < 94 ? '#ef4444' : '#e2e8f0', fontSize: '1.2rem', fontWeight: 'bold' }}>{v?.spO2 || '--'}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>SpO2</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#38bdf8', fontSize: '1.2rem', fontWeight: 'bold' }}>
                      {v ? Math.round((v.bloodPressureSys + (2 * v.bloodPressureDia)) / 3) : '--'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>MAP</div>
                  </div>
                </div>

                <div style={{ height: '40px', width: '100%' }}>
                  {sparkData.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparkData}>
                        <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                        <Line type="monotone" dataKey="val" stroke={isCritical ? '#ef4444' : '#38bdf8'} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CommandCentre;
