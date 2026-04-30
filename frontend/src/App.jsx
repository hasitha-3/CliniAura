import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Heart, Wind, Droplet, AlertTriangle, LogOut, Shield, Stethoscope, User as UserIcon, ChevronDown, ChevronRight, CheckCircle, Info, Settings, FileText } from 'lucide-react';
import './index.css';

import CommandCentre from './pages/CommandCentre';
import AuditDashboard from './pages/AuditDashboard';
import AlarmSettings from './pages/AlarmSettings';

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('cliniaura_user');
    return saved ? JSON.parse(saved) : null;
  });

  const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  const login = async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('cliniaura_user', JSON.stringify(data));
        setUser(data);
        return true;
      }
      alert(data.error || 'Login failed');
      return false;
    } catch (err) {
      alert('Server connection error');
      return false;
    }
  };

  const register = async (payload) => {
    try {
      const res = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return true;
      const data = await res.json();
      alert(data.error);
      return false;
    } catch (err) {
      alert('Server connection error');
      return false;
    }
  }

  const logout = () => {
    localStorage.removeItem('cliniaura_user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
};

const ProtectedRoute = ({ children, roleRequired }) => {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" />;
  if (roleRequired && user.role !== roleRequired) return <Navigate to="/" />;
  return children;
};

// --- Components ---

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  return (
    <nav className="navbar">
      <div className="nav-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <Activity size={28} className="text-gradient" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
        Clini<span className="text-gradient">Aura</span> System
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {user ? (
          <>
            <button className="btn" style={{ background: 'transparent', color: '#e2e8f0' }} onClick={() => navigate('/dashboard')}>Dashboard</button>
            {(user.role === 'DOCTOR' || user.role === 'ADMIN') && (
              <button className="btn" style={{ background: 'transparent', color: '#e2e8f0' }} onClick={() => navigate('/command-centre')}>Command Centre</button>
            )}
            {user.role === 'ADMIN' && (
              <>
                <button className="btn" style={{ background: 'transparent', color: '#e2e8f0' }} onClick={() => navigate('/admin/audit')}>Audit Ledger</button>
                <button className="btn" style={{ background: 'transparent', color: '#e2e8f0' }} onClick={() => navigate('/settings/alarms')}>Alarms</button>
              </>
            )}
            <button className="btn" style={{ background: 'transparent', color: '#e2e8f0' }} onClick={() => navigate('/settings')}>Settings</button>
            <span className="glass-panel" style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem' }}>
              {user.role === 'ADMIN' && <Shield size={16} style={{ display: 'inline', marginRight: '5px' }} />}
              {user.role === 'DOCTOR' && <Stethoscope size={16} style={{ display: 'inline', marginRight: '5px' }} />}
              {user.role === 'PATIENT' && <UserIcon size={16} style={{ display: 'inline', marginRight: '5px' }} />}
              {user.username}
            </span>
            <button className="btn btn-danger" onClick={() => { logout(); navigate('/login'); }}>
              <LogOut size={16} style={{ verticalAlign: 'middle' }} />
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={() => navigate('/login')}>Sign In</button>
        )}
      </div>
    </nav>
  );
};

const HomePage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="dashboard-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
      <Activity size={80} className="text-gradient" style={{ margin: '0 auto 20px', animation: 'pulseAlert 3s infinite' }} />
      <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>Welcome to Clini<span className="text-gradient">Aura</span></h1>
      <p style={{ fontSize: '1.2rem', color: '#94a3b8', maxWidth: '600px', margin: '0 auto 40px' }}>
        A modern, intelligent healthcare monitoring platform. Real-time insights, edge AI analytics, and advanced patient care.
      </p>
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
        {user ? (
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ padding: '15px 30px', fontSize: '1.1rem' }}>Enter Dashboard</button>
        ) : (
          <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ padding: '15px 30px', fontSize: '1.1rem' }}>Access Portal</button>
        )}
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    if (user && user.role === 'PATIENT') {
      fetch(`${API_URL}/api/patients`)
        .then(res => res.json())
        .then(data => {
          const me = data.find(p => p.username === user.username);
          if (me) setProfile(me);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    try {
      const res = await fetch(`${API_URL}/api/users/${profile._id || user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (res.ok) alert('Settings saved successfully!');
      else alert('Failed to save settings.');
    } catch (err) {
      alert('Error saving settings');
    }
  };

  if (loading) return <div style={{padding: '50px', color: '#94a3b8'}}>Loading settings...</div>;

  return (
    <div className="dashboard-container">
      <h2>Account Settings</h2>
      <div className="glass-panel" style={{ maxWidth: '600px', marginTop: '20px' }}>
        <form onSubmit={handleSave}>
          <div className="input-group">
            <label className="input-label">Username</label>
            <input className="input-field" type="text" value={user.username} disabled />
          </div>
          <div className="input-group">
            <label className="input-label">Role</label>
            <input className="input-field" type="text" value={user.role} disabled />
          </div>
          
          {user.role === 'PATIENT' && (
            <div className="grid grid-cols-2 mt-4" style={{borderTop: '1px solid #334155', paddingTop: '20px'}}>
              <div className="input-group">
                <label className="input-label">Age</label>
                <input className="input-field" type="number" value={profile.age || ''} onChange={e => setProfile({...profile, age: Number(e.target.value)})} required />
              </div>
              <div className="input-group">
                <label className="input-label">Target MAP (mmHg)</label>
                <input className="input-field" type="number" value={profile.targetMAP || ''} onChange={e => setProfile({...profile, targetMAP: Number(e.target.value)})} required />
              </div>
              <div className="input-group">
                <label className="input-label">Baseline CO (L/min)</label>
                <input className="input-field" type="number" step="0.1" value={profile.baselineCO || ''} onChange={e => setProfile({...profile, baselineCO: Number(e.target.value)})} required />
              </div>
              <div className="input-group">
                <label className="input-label">Baseline SV (mL/beat)</label>
                <input className="input-field" type="number" value={profile.baselineSV || ''} onChange={e => setProfile({...profile, baselineSV: Number(e.target.value)})} required />
              </div>
            </div>
          )}
          
          {user.role === 'PATIENT' && <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: '20px' }}>Save Changes</button>}
          {user.role !== 'PATIENT' && <p style={{color: '#94a3b8', marginTop: '20px'}}>Additional settings are coming soon.</p>}
        </form>
      </div>
    </div>
  );
};

const AuthPage = () => {
  const { login, register, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  
  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('DOCTOR');
  const [age, setAge] = useState(50);
  const [activeProtocol, setActiveProtocol] = useState('Sepsis Resuscitation Bundles');
  const [targetMAP, setTargetMAP] = useState(65);
  const [baselineCO, setBaselineCO] = useState(4.5);
  const [baselineSV, setBaselineSV] = useState(60);
  const [riskScore, setRiskScore] = useState('Moderate');

  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'login') {
      if (await login(username, password)) navigate('/dashboard');
    } else {
      let payload = { username, password, role };
      if (role === 'PATIENT') {
        payload = { ...payload, age, activeProtocol, targetMAP, baselineCO, baselineSV, riskScore };
      }
      if (await register(payload)) {
        alert('Registration successful! Please sign in.');
        setMode('login');
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel auth-form" style={{ maxWidth: mode === 'register' && role === 'PATIENT' ? '600px' : '400px' }}>
        <div className="auth-tabs">
          <div className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Sign In</div>
          <div className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Sign Up</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Username</label>
            <input className="input-field" type="text" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input-field" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          
          {mode === 'register' && (
            <div className="input-group">
              <label className="input-label">System Role</label>
              <select className="input-field" value={role} onChange={e => setRole(e.target.value)}>
                <option value="DOCTOR">Clinical Staff (Doctor/Nurse)</option>
                <option value="PATIENT">Patient Setup</option>
                <option value="ADMIN">System Administrator</option>
              </select>
            </div>
          )}

          {mode === 'register' && role === 'PATIENT' && (
            <div className="grid grid-cols-2 mt-4" style={{borderTop: '1px solid #334155', paddingTop: '20px'}}>
              <div className="input-group">
                <label className="input-label">Age</label>
                <input className="input-field" type="number" value={age} onChange={e => setAge(Number(e.target.value))} required />
              </div>
              <div className="input-group">
                <label className="input-label">Initial Risk Score (HPI)</label>
                <select className="input-field" value={riskScore} onChange={e => setRiskScore(e.target.value)}>
                  <option value="Low">Low Risk</option>
                  <option value="Moderate">Moderate Risk</option>
                  <option value="High">High Risk</option>
                  <option value="Critical">Critical State</option>
                </select>
              </div>
              <div className="input-group" style={{gridColumn: '1 / -1'}}>
                <label className="input-label">Active Treatment Protocol</label>
                <input className="input-field" type="text" value={activeProtocol} onChange={e => setActiveProtocol(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Target MAP (mmHg)</label>
                <input className="input-field" type="number" value={targetMAP} onChange={e => setTargetMAP(Number(e.target.value))} required />
              </div>
              <div className="input-group">
                <label className="input-label">Baseline CO (L/min)</label>
                <input className="input-field" type="number" step="0.1" value={baselineCO} onChange={e => setBaselineCO(Number(e.target.value))} required />
              </div>
              <div className="input-group">
                <label className="input-label">Baseline SV (mL/beat)</label>
                <input className="input-field" type="number" value={baselineSV} onChange={e => setBaselineSV(Number(e.target.value))} required />
              </div>
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} type="submit">
            {mode === 'login' ? 'Enter System' : 'Register Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/users`)
      .then(res => res.json())
      .then(data => setUsers(data || []))
      .catch(console.error);
  }, []);

  return (
    <div className="dashboard-container">
      <h2 className="mb-4">Global Treatment Compliance Audits</h2>
      <p style={{ color: '#94a3b8', marginBottom: '20px' }}>
        This module utilizes Edge AI log tracking to summarize treatment efficiency across the thermodynamic care units.
      </p>
      
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid #334155' }}>
              <th style={{ padding: '16px' }}>User ID</th>
              <th style={{ padding: '16px' }}>Role</th>
              <th style={{ padding: '16px' }}>Therapeutic Status</th>
              <th style={{ padding: '16px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <React.Fragment key={u._id}>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '16px' }}><strong>{u.username}</strong></td>
                  <td style={{ padding: '16px' }}><span className="text-gradient font-bold">{u.role}</span></td>
                  <td style={{ padding: '16px' }}>
                    {u.role === 'PATIENT' ? (
                      <span className={`badge-risk risk-${u.riskScore}`}>{u.riskScore} Risk</span>
                    ) : 'N/A'}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {u.role === 'PATIENT' && (
                      <button className="btn" style={{ background: 'transparent', border: '1px solid #334155', color: '#e2e8f0', padding: '6px 12px' }}
                        onClick={() => setExpandedRow(expandedRow === u._id ? null : u._id)}>
                        {expandedRow === u._id ? 'Close Audit' : 'Target Audits'}
                      </button>
                    )}
                  </td>
                </tr>
                {expandedRow === u._id && u.role === 'PATIENT' && (
                  <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <td colSpan="4" style={{ padding: '20px' }}>
                      <div className="grid grid-cols-4 mb-4">
                        <div className="metric-box">
                          <div style={{fontSize: '0.8rem', color: '#94a3b8'}}>Protocol</div>
                          <div className="metric-val" style={{fontSize: '1rem'}}>{u.activeProtocol}</div>
                        </div>
                        <div className="metric-box">
                          <div style={{fontSize: '0.8rem', color: '#94a3b8'}}>Target MAP</div>
                          <div className="metric-val">{u.targetMAP} mmHg</div>
                        </div>
                        <div className="metric-box">
                          <div style={{fontSize: '0.8rem', color: '#94a3b8'}}>Base Cardiac Output</div>
                          <div className="metric-val">{u.baselineCO} L/min</div>
                        </div>
                        <div className="metric-box">
                          <div style={{fontSize: '0.8rem', color: '#94a3b8'}}>Base Stroke Volume</div>
                          <div className="metric-val">{u.baselineSV} mL</div>
                        </div>
                      </div>
                      
                      <h4 style={{marginBottom: '10px'}}><CheckCircle size={16} style={{display: 'inline', marginRight: '5px', color: '#22c55e'}}/> AI Treatment Audit History</h4>
                      {(!u.auditLogs || u.auditLogs.length === 0) ? <p style={{color: '#94a3b8', fontSize: '0.9rem'}}>No audits flagged.</p> : (
                        <ul className="audit-list">
                          {u.auditLogs.map((log, i) => (
                            <li key={i} className={`audit-item audit-${log.status.toLowerCase()}`}>
                              <span style={{color: '#94a3b8', marginRight: '10px'}}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                              <strong>[{log.status}]</strong> {log.event}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DoctorDashboard = () => {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [vitalsData, setVitalsData] = useState([]);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    fetch(`${API_URL}/api/patients`)
      .then(res => res.json())
      .then(data => setPatients(data || []));

    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('vitals_update', (data) => {
      setVitalsData(prev => {
        const updated = [...prev, data.vitals].slice(-20);
        return updated;
      });
      setAlert(data.alert);
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (socket && selectedPatient) {
      setVitalsData([]);
      setAlert(null);
      socket.emit('start_monitoring', selectedPatient._id);
    }
  }, [selectedPatient, socket]);

  const latestVitals = vitalsData[vitalsData.length - 1];
  
  // Calculate displayed MAP from synthetic vitals for graphing
  const mapData = vitalsData.map(v => ({
    timestamp: v.timestamp,
    MAP: Math.round((v.bloodPressureSys + (2 * v.bloodPressureDia)) / 3),
    HeartRate: v.heartRate
  }));

  return (
    <div className="dashboard-container" style={{ padding: '16px 32px' }}>
      <div style={{ display: 'flex', gap: '24px' }}>
        
        {/* System Patient Roster */}
        <div style={{ flex: 1, height: '80vh', overflowY: 'auto', paddingRight: '10px' }}>
          <h3 className="mb-4">Thermodynamic System Roster</h3>
          {patients.map(p => (
            <div key={p._id} className="patient-card" style={{ borderColor: selectedPatient?._id === p._id ? '#38bdf8' : '#334155' }}>
              <div className="patient-header" onClick={() => setExpandedPatientId(expandedPatientId === p._id ? null : p._id)}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{p.username} <span style={{fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal'}}>{p.age}yrs</span></div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>{p.activeProtocol}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`badge-risk risk-${p.riskScore}`}>{p.riskScore}</span>
                  {expandedPatientId === p._id ? <ChevronDown size={20} color="#94a3b8"/> : <ChevronRight size={20} color="#94a3b8"/>}
                </div>
              </div>
              
              {expandedPatientId === p._id && (
                <div className="patient-details-expanded">
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <div className="metric-box" style={{flex: 1}}>
                      <div style={{fontSize: '0.7rem', color: '#94a3b8'}} title="Mean Arterial Pressure">Target MAP <Info size={10}/></div>
                      <div className="metric-val" style={{fontSize: '1rem'}}>{p.targetMAP} <span style={{fontSize: '0.7rem', fontWeight:'normal'}}>mmHg</span></div>
                    </div>
                    <div className="metric-box" style={{flex: 1}}>
                      <div style={{fontSize: '0.7rem', color: '#94a3b8'}} title="Cardiac Output">Base CO <Info size={10}/></div>
                      <div className="metric-val" style={{fontSize: '1rem'}}>{p.baselineCO} <span style={{fontSize: '0.7rem', fontWeight:'normal'}}>L/m</span></div>
                    </div>
                    <div className="metric-box" style={{flex: 1}}>
                      <div style={{fontSize: '0.7rem', color: '#94a3b8'}} title="Stroke Volume">Base SV <Info size={10}/></div>
                      <div className="metric-val" style={{fontSize: '1rem'}}>{p.baselineSV} <span style={{fontSize: '0.7rem', fontWeight:'normal'}}>mL</span></div>
                    </div>
                  </div>
                  
                  <div style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '10px'}}>Recent AI Treatment Audits:</div>
                  <ul className="audit-list" style={{ marginTop: 0 }}>
                    {p.auditLogs?.slice(0, 2).map((log, i) => (
                      <li key={i} className={`audit-item audit-${log.status.toLowerCase()}`}>
                        <strong>[{log.status}]</strong> {log.event}
                      </li>
                    )) || <li>No audits logged.</li>}
                  </ul>

                  <button className="btn btn-primary" style={{ width: '100%', marginTop: '15px', padding: '8px' }} onClick={(e) => { e.stopPropagation(); setSelectedPatient(p); }}>
                    Monitor Edge Stream
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Active Stream View */}
        <div style={{ flex: 2.5 }}>
          {!selectedPatient ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '100px 50px', color: '#94a3b8' }}>
              <Activity size={64} style={{ opacity: 0.2, marginBottom: '20px' }} />
              <h2>No Stream Connected</h2>
              <p>Expand a patient card in the roster and initialize the Edge Stream.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ display: 'inline', marginRight: '15px' }}>{selectedPatient.username} - Hemodynamic Trajectory</h2>
                  <span className={`badge-risk risk-${selectedPatient.riskScore}`} style={{ verticalAlign: 'middle' }}>{selectedPatient.riskScore} HPI Risk</span>
                </div>
                <div><span className="live-pulse"></span>Live Edge Stream</div>
              </div>
              
              {alert && (
                <div className="alert-banner">
                  <AlertTriangle size={24} />
                  <div>
                    <strong>Thermodynamic Instability Detected</strong>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>{alert}</p>
                  </div>
                </div>
              )}

              {latestVitals ? (
                <>
                  <div className="grid grid-cols-4 mb-4">
                    <div className="glass-panel vital-card" style={{ padding: '15px' }}>
                      <div className="vital-value" style={{ color: latestVitals.heartRate > 100 ? '#ef4444' : 'white', margin: '5px 0' }}>{latestVitals.heartRate}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>Heart Rate (bpm) <Info size={12} title="Beats per minute. Critical > 100"/></div>
                    </div>
                    
                    <div className="glass-panel vital-card" style={{ padding: '15px' }}>
                      <div className="vital-value" style={{ margin: '5px 0' }}>{latestVitals.bloodPressureSys}/{latestVitals.bloodPressureDia}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>NIBP (mmHg) <Info size={12} title="Systolic / Diastolic Pressure"/></div>
                    </div>
                    
                    <div className="glass-panel vital-card" style={{ padding: '15px', borderColor: mapData[mapData.length-1]?.MAP < selectedPatient.targetMAP ? '#ef4444' : '#334155' }}>
                      <div className="vital-value" style={{ color: mapData[mapData.length-1]?.MAP < selectedPatient.targetMAP ? '#ef4444' : '#38bdf8', margin: '5px 0' }}>
                        {mapData[mapData.length-1]?.MAP}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>MAP (mmHg) <Info size={12} title={`Mean Arterial Pressure. Target: ${selectedPatient.targetMAP}`}/></div>
                    </div>

                    <div className="glass-panel vital-card" style={{ padding: '15px', background: 'rgba(34, 197, 94, 0.05)', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                      <div className="vital-value" style={{ color: '#22c55e', margin: '5px 0', fontSize: '1.2rem' }}>{selectedPatient.activeProtocol}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>Currently Auditing <Info size={12} title="The active treatment protocol being AI-audited."/></div>
                    </div>
                  </div>

                  <div className="glass-panel chart-container" style={{ height: '400px' }}>
                    <h4 style={{ color: '#94a3b8', marginBottom: '10px' }}>Continuous Physiology Relationship View (MAP vs HR)</h4>
                    <ResponsiveContainer width="100%" height="90%">
                      <LineChart data={mapData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="timestamp" tick={false} stroke="#94a3b8" />
                        <YAxis yAxisId="left" stroke="#38bdf8" domain={['dataMin - 10', 'dataMax + 10']} />
                        <YAxis yAxisId="right" orientation="right" stroke="#ef4444" domain={['dataMin - 20', 'dataMax + 20']} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                        <Line yAxisId="left" type="monotone" dataKey="MAP" stroke="#38bdf8" name="MAP (mmHg)" strokeWidth={3} dot={false} isAnimationActive={false} />
                        <Line yAxisId="right" type="monotone" dataKey="HeartRate" stroke="#ef4444" name="Heart Rate (bpm)" strokeWidth={3} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '50px' }}>Awaiting initial edge transmission...</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PatientDashboard = () => {
  const [profile, setProfile] = useState(null);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    fetch(`${API_URL}/api/patients`)
      .then(res => res.json())
      .then(data => {
        const me = data.find(p => p.username === user.username);
        if (me) setProfile(me);
      });
  }, [user.username]);

  return (
    <div className="dashboard-container">
      <h2>Patient Portal: {user.username}</h2>
      <p style={{ color: '#94a3b8', marginTop: '10px' }}>Your physiological metrics are being robustly monitored by the CliniAura Edge AI ecosystem.</p>
      
      {profile && (
        <div className="grid grid-cols-2 mt-4" style={{ gap: '24px', alignItems: 'start' }}>
          <div className="glass-panel">
            <h3 className="mb-4 text-gradient">My Prescribed Protocol</h3>
            
            <div style={{ padding: '16px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#22c55e', marginBottom: '5px' }}>{profile.activeProtocol}</div>
              <div style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>Your treatment plan is actively being audited by the medical intelligence layer to ensure highest quality care.</div>
            </div>

            <h4 style={{ marginBottom: '15px' }}>Assessed Baseline Metrics</h4>
            <div className="user-row"><span>Target Mean Arterial Pressure (MAP) <Info size={12} color="#94a3b8"/></span> <span className="font-bold">{profile.targetMAP} mmHg</span></div>
            <div className="user-row"><span>Baseline Cardiac Output (CO)</span> <span className="font-bold">{profile.baselineCO} L/min</span></div>
            <div className="user-row" style={{borderBottom: 'none'}}><span>Baseline Stroke Volume (SV)</span> <span className="font-bold">{profile.baselineSV} mL</span></div>
          </div>

          <div className="glass-panel" style={{ textAlign: 'center', padding: '50px 20px' }}>
            <Activity size={64} color="#38bdf8" style={{ marginBottom: '20px', animation: 'pulseAlert 3s infinite' }} />
            <h3 style={{color: '#38bdf8'}}>Edge Sentinel Active</h3>
            <p style={{color: '#94a3b8', marginTop: '10px', fontSize: '0.9rem'}}>No immediate action required. Sensor relays are continuous and optimal.</p>
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardRouter = () => {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" />;
  
  // Render specific dashboards based on path or role
  if (user.role === 'ADMIN') return <AdminDashboard />;
  if (user.role === 'DOCTOR') return <DoctorDashboard />;
  if (user.role === 'PATIENT') return <PatientDashboard />;
  return <Navigate to="/login" />;
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
          <Route path="/command-centre" element={<ProtectedRoute roleRequired="DOCTOR"><CommandCentre /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/settings/alarms" element={<ProtectedRoute roleRequired="ADMIN"><AlarmSettings /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute roleRequired="ADMIN"><AuditDashboard /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
