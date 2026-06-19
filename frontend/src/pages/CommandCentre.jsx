import React, { useEffect, useState } from 'react';
import useWardStore from '../stores/wardStore';
import io from 'socket.io-client';
import { Activity, Bell, CheckCircle, HeartPulse, Stethoscope, AlertTriangle, Search, Battery, Wifi, Zap, Plus, Sliders, Layers, RefreshCw, FileText, Users, X } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { generateDummyPatients, generateDummyVitals, generateMedGemmaAlert } from '../utils/dummyDataSimulator';
import EHRManager from '../components/EHRManager';
import ABGManager from '../components/ABGManager';
import CareSchedule from '../components/CareSchedule';
import PatientCalls from '../components/PatientCalls';

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
  const [managePtId, setManagePtId] = useState(null);
  const [activeTab, setActiveTab] = useState('SCHEDULE'); // SCHEDULE, EHR, ABG
  const user = JSON.parse(localStorage.getItem('cliniaura_user'));

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
    const token = user?.token;

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
        console.warn("Backend unavailable, falling back to dummy data simulator.");
        const dummyPts = generateDummyPatients();
        setPatients(dummyPts);
        setLoading(false);
        
        // Dummy interval fallback logic has been disabled here since Nano is the source of truth
      });

    // --- NEW: Jetson Nano Edge API Polling (Always runs) ---
    const NANO_API = 'http://100.104.109.66:8000/dashboard/live';
    const nanoIntervalId = setInterval(async () => {
      try {
        const nanoRes = await fetch(NANO_API);
        if (nanoRes.ok) {
          const liveData = await nanoRes.json();
          
          liveData.forEach(pData => {
            const vitals = {
              respirationRate: pData.respiration_rate || 16,
              heartRate: pData.heart_rate,
              bloodPressureSys: pData.systolic_bp,
              bloodPressureDia: pData.diastolic_bp,
              spO2: pData.spo2,
              temperature: 36.8,
              posture: 'Supine',
              steps: 0,
              fallDetected: false,
              ecgAnomaly: false,
            };
            
            let alertMsg = null;
            if (pData.alerts && pData.alerts.length > 0) {
              const latestAlert = pData.alerts[0];
              alertMsg = `${latestAlert.severity.toUpperCase()}: ${latestAlert.reason}`;
            }
            
            updateVitals(pData.patient_id, vitals, alertMsg);
            
            if (pData.assessment) {
              setPatients(prevPts => prevPts.map(pt => 
                pt.username === pData.patient_id || pt._id === pData.patient_id 
                  ? { ...pt, nanoAssessment: pData.assessment } 
                  : pt
              ));
            }
          });
        }
      } catch (e) {
        // Silently ignore connection errors to edge device
      }
    }, 2000);
    
    window.dummyIntervalId = nanoIntervalId;

    const socket = io(API_URL, { auth: { token, role: user?.role } });
    
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

    return () => {
      socket.close();
      if (window.dummyIntervalId) {
        clearInterval(window.dummyIntervalId);
      }
    };
  }, [updateVitals]);

  const activeAlerts = getActiveAlerts();

  const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

  const logIntervention = async (pt, actionName) => {
    const patientId = pt.patientId || pt._id;
    // Optimistic UI feedback
    setActionFeedback(prev => ({ ...prev, [pt._id]: `${actionName} Logged` }));
    setTimeout(() => {
      setActionFeedback(prev => {
        const next = { ...prev };
        delete next[pt._id];
        return next;
      });
    }, 3500);

    // Persist to backend audit log
    try {
      await fetch(`${API_URL}/api/interventions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
        body: JSON.stringify({
          patientId,
          patientName: pt.name || pt.username,
          action: actionName,
          actor: user?.username,
          actorRole: user?.role
        })
      });
    } catch (e) {
      console.warn('Intervention log failed:', e.message);
    }
  };

  const acknowledgeWithLog = async (alertId, pt, alertMessage) => {
    // Dismiss from local escalation desk
    acknowledgeAlert(alertId);
    // Persist acknowledgement to backend
    try {
      await fetch(`${API_URL}/api/alerts/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
        body: JSON.stringify({
          alertId,
          acknowledgedBy: user?.username,
          acknowledgedByRole: user?.role,
          patientId: pt?.patientId || pt?._id,
          patientName: pt?.name || pt?.username,
          alertMessage
        })
      });
    } catch (e) {
      console.warn('Acknowledgement log failed:', e.message);
    }
  };

  const [showMyPatientsOnly, setShowMyPatientsOnly] = useState(false);

  const filteredPatients = patients.filter(pt => {
    const matchesWard = selectedWard === 'All' || pt.ward === selectedWard;
    const matchesRisk = selectedRisk === 'All' || pt.riskScore === selectedRisk;
    const matchesSearch = !searchTerm || 
      pt.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pt.activeProtocol && pt.activeProtocol.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const currentUserUsername = user?.username;
    const currentUserRole = user?.role;
    
    const isMyPatientsView = showMyPatientsOnly || currentUserRole === 'NURSE';
    const matchesMyPatients = !isMyPatientsView || pt.assignedNurse === currentUserUsername || pt.assignedDoctor === currentUserUsername;
    
    return matchesWard && matchesRisk && matchesSearch && matchesMyPatients;
  });

  const wards = ['All', 'ICU', 'Emergency', 'Cardiology', 'General'];
  const risks = ['All', 'Critical', 'High', 'Medium', 'Moderate', 'Low'];

  if (loading) {
    return (
      <div className="dashboard-container" style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
        <RefreshCw size={32} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 16px', color: 'var(--teal)' }} />
        <h3>Initializing Edge Stream...</h3>
        <p>Connecting to distributed biosensor clusters</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
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

          {user?.role === 'DOCTOR' && (
            <button
              onClick={() => setShowMyPatientsOnly(!showMyPatientsOnly)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '100px',
                border: `1px solid ${showMyPatientsOnly ? 'var(--teal)' : 'var(--border)'}`,
                background: showMyPatientsOnly ? 'rgba(0, 212, 170, 0.15)' : 'var(--bg2)',
                color: showMyPatientsOnly ? 'var(--teal)' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Users size={14} /> My Patients
            </button>
          )}

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

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <div style={{ width: '30%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <PatientCalls role={user?.role} username={user?.username} />
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#ff4d6a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} /> Escalation Desk
              </h3>
              <span style={{ background: 'rgba(255,77,106,0.15)', color: '#ff4d6a', padding: '2px 8px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {activeAlerts.length}
              </span>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeAlerts.map(alert => {
                const pt = patients.find(p => p._id === alert.patientId || p.patientId === alert.patientId);
                return (
                  <div key={alert.id} style={{ background: 'rgba(255, 77, 106, 0.06)', border: '1px solid rgba(255, 77, 106, 0.3)', padding: '12px', borderRadius: '12px', animation: 'fade-up 0.3s ease-out' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                      {pt?.name || 'Unknown Patient'} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({pt?.patientId || alert.patient_id})</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#ff8093' }}>{alert.message}</div>
                    <button onClick={() => acknowledgeWithLog(alert.id, pt, alert.message)} style={{ marginTop: '8px', width: '100%', fontSize: '0.75rem', background: '#ff4d6a', color: 'white', border: 'none', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}>Acknowledge</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

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
                const bedData = beds.find(b => b.patientId === pt._id || b.patientId === pt.patientId);
                const v = bedData?.latestVitals;
                const isCritical = activeAlerts.some(a => a.patientId === pt._id || a.patientId === pt.patientId);
                const dynamicRiskScore = isCritical ? 'CRITICAL' : (pt.riskScore || 'LOW');
                const feedback = actionFeedback[pt._id];

                // Calculate history trends safely
                const sparkData = bedData?.history?.filter(h => h != null).map(h => ({ 
                  val: Math.round(((h.bloodPressureSys || 90) + (2 * (h.bloodPressureDia || 60))) / 3) 
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text)' }}>
                            {pt.name || pt.username}
                          </span>
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface2)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>
                            {pt.ward || 'General Ward'}
                          </span>
                        </div>
                          <span className={`badge-risk risk-${dynamicRiskScore}`}>{dynamicRiskScore}</span>
                      </div>
                      
                      {/* Clinical Demographics */}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{pt.patientId || 'ID Pending'}</span>
                        <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{pt.age}y {pt.gender ? `/ ${pt.gender.charAt(0)}` : ''}</span>
                        <span style={{ background: 'rgba(0, 212, 170, 0.1)', color: 'var(--teal)', padding: '2px 6px', borderRadius: '4px' }}>{pt.ward || 'Pending Ward'}</span>
                        <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }} className="truncate">{pt.primaryDiagnosis || 'Diagnosis Pending'}</span>
                      </div>

                      <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', background: 'var(--bg2)', padding: '8px', borderRadius: '6px' }}>
                        <div><strong>Admitted:</strong> {pt.admissionDate ? new Date(pt.admissionDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '--'}</div>
                        <div><strong>Diagnosed:</strong> {pt.diagnosisDate ? new Date(pt.diagnosisDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '--'}</div>
                        <div><strong>Nurse:</strong> {pt.assignedNurse || 'Unassigned'}</div>
                        <div><strong>Doctor:</strong> {pt.assignedDoctor || 'Unassigned'}</div>
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px', background: 'var(--bg2)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(0,212,170,0.05)' }}>
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

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '16px', background: 'var(--bg2)', padding: '6px', borderRadius: '10px', border: '1px solid rgba(0,212,170,0.05)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resp</div>
                          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: (v?.respirationRate < 12 || v?.respirationRate > 20) ? '#ff4d6a' : 'var(--text)' }}>
                            {v?.respirationRate || '--'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Steps</div>
                          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text)' }}>
                            {v?.steps || '--'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Posture</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text)', marginTop: '2px' }}>
                            {v?.posture || '--'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Falls</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: v?.fallDetected ? '#ff4d6a' : 'var(--teal)', marginTop: '2px' }}>
                            {v ? (v.fallDetected ? 'Yes' : 'No') : '--'}
                          </div>
                        </div>
                      </div>
                      
                      {/* AI ASSISTANT PANEL */}
                      <div className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', marginBottom: '12px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                          <Zap size={14} /> Edge AI Assessment
                        </div>
                        <div style={{ background: 'var(--bg)', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', lineHeight: '1.4', color: 'var(--text-dim)', flex: 1, overflowY: 'auto', maxHeight: '100px' }}>
                          {(() => {
                            let text = pt.nanoAssessment ? pt.nanoAssessment : "Stable telemetry stream. No acute intervention required at this moment.";
                            if (text.includes('MOCK INFERENCE')) {
                              text = "AI analysis pending...";
                            }
                            // Simple markdown bold parsing: replace **text** with <strong>text</strong>
                            const parts = text.split(/(\*\*.*?\*\*)/g);
                            return parts.map((part, index) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={index} style={{ color: 'var(--text)' }}>{part.slice(2, -2)}</strong>;
                              }
                              return part;
                            });
                          })()}
                        </div>
                        <button 
                          onClick={() => {
                            const printWindow = window.open('', '_blank');
                            printWindow.document.write(`
                              <html>
                                <head>
                                  <title>MedGemma Assessment - ${pt.name || pt.username}</title>
                                  <style>
                                    body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
                                    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
                                    .section { margin-bottom: 20px; }
                                  </style>
                                </head>
                                <body>
                                  <h1>MedGemma Clinical Assessment</h1>
                                  <div class="section">
                                    <strong>Patient:</strong> ${pt.name || pt.username} (${pt.patientId || 'N/A'})<br>
                                    <strong>Date:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                  </div>
                                  <div class="section">
                                    <h2>Vitals Snapshot</h2>
                                    HR: ${v?.heartRate || '--'} bpm | SpO2: ${v?.spO2 || '--'}% | MAP: ${v ? Math.round((v.bloodPressureSys + (2 * v.bloodPressureDia)) / 3) : '--'} mmHg
                                  </div>
                                  <div class="section">
                                    <h2>Assessment</h2>
                                    <p>${pt.nanoAssessment ? pt.nanoAssessment.replace(/MOCK INFERENCE:\\s*/g, '').replace(/\\*\\*/g, '') : "Stable telemetry stream."}</p>
                                  </div>
                                  <script>window.print(); window.close();</script>
                                </body>
                              </html>
                            `);
                            printWindow.document.close();
                          }}
                          style={{ marginTop: '8px', alignSelf: 'flex-start', padding: '6px 12px', background: 'rgba(0,212,170,0.1)', color: 'var(--teal)', border: '1px solid var(--teal)', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                        >
                          <FileText size={12} /> Download PDF
                        </button>
                      </div>
                    </div>

                    {/* Action Drawers / State Logging Buttons */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: 'auto' }}>
                      <button
                        onClick={() => setManagePtId(pt._id)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'var(--teal)',
                          border: 'none',
                          borderRadius: '6px',
                          color: 'var(--bg)',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Sliders size={14} /> Manage Patient
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Full-Screen Modals for Managing Patient */}
      {managePtId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(5, 10, 16, 0.95)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg2)', padding: '40px', position: 'relative', border: '1px solid var(--teal)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <button 
              onClick={() => { setManagePtId(null); setActiveTab('SCHEDULE'); }} 
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--teal)', color: 'var(--bg)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              &times;
            </button>
            <div style={{ animation: 'fade-up 0.3s ease' }}>
              {(() => {
                const pt = patients.find(p => p._id === managePtId) || {};
                const feedback = actionFeedback[pt._id];
                
                return (
                  <>
                    <h2 style={{ color: 'var(--teal)', marginBottom: '10px', marginTop: 0, fontSize: '1.8rem' }}>
                      Manage Patient - {pt.name || pt.username}
                    </h2>
                    
                    {/* Quick Interventions */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                      <button onClick={() => logIntervention(pt, 'Fluid Bolus')} className="btn" style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 'bold' }}>
                        <Plus size={16} style={{display:'inline', marginRight:'8px'}} /> Administer Fluid Bolus
                      </button>
                      <button onClick={() => logIntervention(pt, 'Vasopressor Titration')} className="btn" style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 'bold' }}>
                        <Zap size={16} style={{display:'inline', marginRight:'8px'}} /> Titrate Vasopressors
                      </button>
                      {feedback && (
                        <div style={{ flex: 1, padding: '12px', background: 'rgba(0,212,170,0.1)', color: 'var(--teal)', textAlign: 'center', borderRadius: '8px', fontWeight: 'bold', animation: 'fade-up 0.2s ease' }}>
                          ✓ {feedback}
                        </div>
                      )}
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                      <button onClick={() => setActiveTab('SCHEDULE')} style={{ padding: '8px 16px', borderRadius: '100px', border: 'none', background: activeTab === 'SCHEDULE' ? 'var(--teal)' : 'var(--surface2)', color: activeTab === 'SCHEDULE' ? 'var(--bg)' : 'var(--text)', fontWeight: 'bold', cursor: 'pointer' }}>Care Schedule</button>
                      {/* <button onClick={() => setActiveTab('EHR')} style={{ padding: '8px 16px', borderRadius: '100px', border: 'none', background: activeTab === 'EHR' ? 'var(--cyan)' : 'var(--surface2)', color: activeTab === 'EHR' ? 'var(--bg)' : 'var(--text)', fontWeight: 'bold', cursor: 'pointer' }}>EHR Documents</button> */}
                      <button onClick={() => setActiveTab('ABG')} style={{ padding: '8px 16px', borderRadius: '100px', border: 'none', background: activeTab === 'ABG' ? '#38bdf8' : 'var(--surface2)', color: activeTab === 'ABG' ? 'var(--bg)' : 'var(--text)', fontWeight: 'bold', cursor: 'pointer' }}>ABG Lab Results</button>
                    </div>
                    
                    {activeTab === 'SCHEDULE' && (
                      <CareSchedule 
                        patientId={pt.patientId || pt._id} 
                        patientName={pt.name || pt.username}
                        role={user?.role}
                      />
                    )}
                    
                    {/* activeTab === 'EHR' && (
                      <EHRManager 
                        patientId={pt._id} 
                        patientName={pt.name || pt.username} 
                        patientAge={pt.age}
                      />
                    ) */}
                    
                    {activeTab === 'ABG' && (
                      <ABGManager 
                        patientId={pt.patientId || pt._id} 
                        patientName={pt.name || pt.username}
                      />
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommandCentre;
