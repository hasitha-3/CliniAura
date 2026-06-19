import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Heart, Wind, Droplet, AlertTriangle, LogOut, Shield, ShieldAlert, Stethoscope, User as UserIcon, ChevronDown, ChevronRight, CheckCircle, Info, Settings, FileText, Thermometer, Footprints, Accessibility, Bell } from 'lucide-react';
import { generateDummyPatients, generateDummyVitals, generateMedGemmaAlert } from './utils/dummyDataSimulator';
import './index.css';

import CommandCentre from './pages/CommandCentre';
import AuditDashboard from './pages/AuditDashboard';
import AlarmSettings from './pages/AlarmSettings';
import AlertHistory from './pages/AlertHistory';
import HomePage from './pages/HomePage';
import EHRManager from './components/EHRManager';
import CareSchedule from './components/CareSchedule';
import useWardStore from './stores/wardStore';
import PatientCalls from './components/PatientCalls';
import ABGManager from './components/ABGManager';

export const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('cliniaura_user');
    return saved ? JSON.parse(saved) : null;
  });

  const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

  const login = async (username, password) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('cliniaura_user', JSON.stringify(data));
        setUser(data);
        return { success: true, role: data.role };
      }
      return { success: false, error: data.error || 'Invalid username or password' };
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn("Backend unavailable, falling back to dummy authentication.");
      let fallbackRole = 'ADMIN';
      const lowerName = username.toLowerCase();
      if (lowerName.includes('patient')) fallbackRole = 'PATIENT';
      else if (lowerName.includes('nurse')) fallbackRole = 'NURSE';
      else if (lowerName.includes('doctor')) fallbackRole = 'DOCTOR';

      const demoUser = { id: 'dummy-admin', username, role: fallbackRole, token: 'demo-token' };
      localStorage.setItem('cliniaura_user', JSON.stringify(demoUser));
      setUser(demoUser);
      return { success: true, role: demoUser.role };
    }
  };

  const register = async (payload) => {
    try {
      const res = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return { success: true };
      const data = await res.json();
      let msg = data.error || 'Registration failed';
      if (msg.includes('E11000') || msg.includes('duplicate key')) {
        msg = 'Username is already taken. Please choose another one.';
      }
      return { success: false, error: msg };
    } catch (err) {
      console.warn("Backend unavailable, falling back to dummy registration.");
      return { success: true };
    }
  };

  const logout = () => {
    localStorage.removeItem('cliniaura_user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
};

const ProtectedRoute = ({ children, roleRequired }) => {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" />;
  if (roleRequired) {
    if (Array.isArray(roleRequired)) {
      if (!roleRequired.includes(user.role)) return <Navigate to="/" />;
    } else if (user.role !== roleRequired) {
      return <Navigate to="/" />;
    }
  }
  return children;
};

// --- Components ---

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e, hash) => {
    e.preventDefault();
    setMenuOpen(false);
    if (window.location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav id="navbar" className={scrolled ? 'scrolled' : ''}>
      <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); window.scrollTo({top:0, behavior:'smooth'}); }} className="nav-logo">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2C10.06 2 2 10.06 2 20s8.06 18 18 18 18-8.06 18-18S29.94 2 20 2z" stroke="#00d4aa" strokeWidth="2" fill="none"/>
          <path d="M14 20c0-3.31 2.69-6 6-6" stroke="#00d4aa" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M20 14c3.31 0 6 2.69 6 6" stroke="#00c2e0" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M26 20c0 3.31-2.69 6-6 6" stroke="#00d4aa" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M20 26c-3.31 0-6-2.69-6-6" stroke="#00c2e0" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="20" cy="20" r="2.5" fill="#00d4aa"/>
        </svg>
        CliniAura
      </a>
      
      {!user && (
        <div className="nav-links" style={{ display: window.innerWidth <= 900 && menuOpen ? 'flex' : undefined, flexDirection: window.innerWidth <= 900 ? 'column' : 'row', position: window.innerWidth <= 900 ? 'absolute' : 'static', top: '100%', left: 0, right: 0, background: window.innerWidth <= 900 ? 'var(--surface)' : 'transparent', padding: window.innerWidth <= 900 ? '1.5rem' : 0, borderBottom: window.innerWidth <= 900 ? '1px solid var(--border)' : 'none' }}>
          <a href="#problem" onClick={(e) => handleNavClick(e, '#problem')}>Problem</a>
          <a href="#solution" onClick={(e) => handleNavClick(e, '#solution')}>Solution</a>
          <a href="#technology" onClick={(e) => handleNavClick(e, '#technology')}>Technology</a>
          <a href="#team" onClick={(e) => handleNavClick(e, '#team')}>Team</a>
          <a href="#contact" onClick={(e) => handleNavClick(e, '#contact')} className="nav-cta">Get in Touch</a>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {user ? (
          <>
            <button className="btn" style={{ background: 'transparent', color: 'var(--text)', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate('/dashboard')}>Dashboard</button>
            {(user.role === 'DOCTOR' || user.role === 'ADMIN' || user.role === 'NURSE') && (
              <>
                <button className="btn" style={{ background: 'transparent', color: 'var(--text)', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate('/command-centre')}>Command</button>
                <button className="btn" style={{ background: 'transparent', color: 'var(--text)', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate('/alert-history')}>History</button>
              </>
            )}
            {user.role === 'ADMIN' && (
              <>
                <button className="btn" style={{ background: 'transparent', color: 'var(--text)', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate('/admin/audit')}>Audit</button>
                <button className="btn" style={{ background: 'transparent', color: 'var(--text)', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate('/settings/alarms')}>Alarms</button>
              </>
            )}
            <button className="btn" style={{ background: 'transparent', color: 'var(--text)', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate('/settings')}>Settings</button>
            <span style={{ background: 'rgba(0, 212, 170, 0.08)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '100px', fontSize: '0.75rem', color: 'var(--teal)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'middle' }} title={user.username}>
              {user.username}
            </span>
            <button className="btn btn-danger" style={{ padding: '4px 8px', borderRadius: '8px', flexShrink: 0 }} onClick={() => { logout(); navigate('/login'); }} title="Sign Out">
              <LogOut size={14} style={{ verticalAlign: 'middle' }} />
            </button>
          </>
        ) : (
          <button className="btn btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }} onClick={() => navigate('/login')}>Sign In</button>
        )}
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
    </nav>
  );
};

const SettingsPage = () => {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [showPwdSection, setShowPwdSection] = useState(false);

  // MedGemma Integrations
  const [apiKey, setApiKey] = useState(localStorage.getItem('medgemma_api_key') || '');
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://10.2.195.143:5000';
    if (user && user.role === 'PATIENT') {
      const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
      fetch(`${API_URL}/api/patients`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          const me = Array.isArray(data) ? data.find(p => p.username === user.username) : null;
          if (me) setProfile(me);
          setLoading(false);
        })
        .catch(() => {
          console.warn("Using dummy data for settings");
          const localProf = localStorage.getItem(`dummy_profile_${user.username}`);
          if (localProf) {
            setProfile(JSON.parse(localProf));
          } else {
            const pts = generateDummyPatients();
            const me = pts[0];
            setProfile(me);
          }
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [user]);

  // Fetch MedGemma Health Status
  useEffect(() => {
    if (user?.role === 'DOCTOR' || user?.role === 'ADMIN') {
      fetch('http://100.104.109.66:8000/health')
        .then(res => res.json())
        .then(data => setHealth(data))
        .catch(() => setHealth({ status: 'unreachable' }));
    }
  }, [user]);

  const saveApiKey = () => {
    localStorage.setItem('medgemma_api_key', apiKey);
    alert('MedGemma API Key Saved Locally!');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
    const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
    try {
      const res = await fetch(`${API_URL}/api/users/${profile._id || user.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });
      if (res.ok) alert('Settings saved successfully!');
      else alert('Failed to save settings.');
    } catch (err) {
      console.warn("Backend down. Saving settings to local storage dummy profile.");
      localStorage.setItem(`dummy_profile_${user.username}`, JSON.stringify(profile));
      alert('Settings saved locally (Demo Mode)!');
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPwdError('Password must be min 8 characters, containing at least 1 uppercase letter and 1 number.');
      return;
    }

    const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
    const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
    try {
      const res = await fetch(`${API_URL}/api/users/${profile._id || user.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setPwdSuccess('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        setPwdError(data.error || 'Failed to update password.');
      }
    } catch (err) {
      setPwdError('Error connecting to server.');
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
            <input className="input-field" type="text" value={user?.username || ''} disabled />
          </div>
          <div className="input-group">
            <label className="input-label">Role</label>
            <input className="input-field" type="text" value={user?.role || ''} disabled />
          </div>
          
          {user?.role === 'PATIENT' && (
            <div style={{ padding: '16px', background: 'rgba(0, 212, 170, 0.05)', borderRadius: '8px', marginTop: '20px', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 8px 0' }}>Need Help?</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '12px' }}>Your medical settings are managed by your assigned nurse. If you have any concerns or need assistance, please reach out to them directly.</p>
              <button 
                type="button"
                className="btn" 
                style={{ background: 'var(--teal)', color: 'white', fontSize: '0.85rem', padding: '6px 12px' }}
                onClick={() => alert("Your assigned nurse has been notified. They will contact you shortly.")}
              >
                Contact Assigned Nurse
              </button>
            </div>
          )}
        </form>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: '30px', paddingTop: '20px' }}>
          <button 
            type="button" 
            onClick={() => setShowPwdSection(!showPwdSection)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--teal)', 
              fontWeight: '600', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.95rem'
            }}
          >
            <Settings size={16} /> {showPwdSection ? 'Hide Password Settings' : 'Change Account Password'}
          </button>

          {showPwdSection && (
            <form onSubmit={handlePasswordSave} style={{ marginTop: '20px', animation: 'fade-up 0.4s ease' }}>
              {pwdError && (
                <div style={{ padding: '12px', background: 'rgba(255,77,106,0.1)', border: '1px solid #ff4d6a', color: '#ff4d6a', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                  {pwdError}
                </div>
              )}
              {pwdSuccess && (
                <div style={{ padding: '12px', background: 'rgba(0,212,170,0.1)', border: '1px solid var(--teal)', color: 'var(--teal)', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                  {pwdSuccess}
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    className="input-field" 
                    type={showCurrentPwd ? 'text' : 'password'} 
                    value={currentPassword} 
                    onChange={e => setCurrentPassword(e.target.value)} 
                    style={{ paddingRight: '50px' }}
                    required 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                  >
                    {showCurrentPwd ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    className="input-field" 
                    type={showNewPwd ? 'text' : 'password'} 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    style={{ paddingRight: '50px' }}
                    required 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                  >
                    {showNewPwd ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Min 8 chars, 1 uppercase, 1 number required.
                </div>
              </div>

              <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: '10px', background: 'var(--teal)', color: '#050a10', fontWeight: 'bold' }}>
                Update Password
              </button>
            </form>
          )}
        </div>

        {['DOCTOR', 'ADMIN', 'NURSE'].includes(user?.role) && (
          <div style={{ borderTop: '1px solid var(--border)', marginTop: '30px', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>MedGemma AI Integration</h3>
            <div className="glass-panel" style={{ background: 'rgba(0, 212, 170, 0.05)', borderColor: 'var(--teal)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <strong style={{ fontSize: '0.9rem' }}>Agent Connection Status</strong>
                <span className={`badge-risk ${health?.status === 'healthy' ? 'risk-Low' : 'risk-Critical'}`}>
                  {health ? health.status.toUpperCase() : 'CHECKING...'}
                </span>
              </div>
              
              {health && (
                <div className="grid grid-cols-2" style={{ gap: '8px', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '20px' }}>
                  <div>Ollama: <span style={{color: health.ollama === 'ok' ? 'var(--teal)' : '#ff4d6a'}}>{health.ollama}</span></div>
                  <div>ChromaDB: <span style={{color: health.chromadb === 'ok' ? 'var(--teal)' : '#ff4d6a'}}>{health.chromadb}</span></div>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">MedGemma API Key</label>
                <input 
                  className="input-field" 
                  type="password" 
                  value={apiKey} 
                  onChange={e => setApiKey(e.target.value)} 
                  placeholder="Enter Agent API Key"
                />
              </div>
              <button className="btn btn-primary" onClick={saveApiKey} style={{ width: '100%', marginTop: '10px' }}>
                Save API Key
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const AuthPage = () => {
  const { login, register, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('DOCTOR');
  const [age, setAge] = useState(50);
  const [activeProtocol, setActiveProtocol] = useState('Sepsis Resuscitation Bundles');
  const [targetMAP, setTargetMAP] = useState(65);
  const [baselineCO, setBaselineCO] = useState(4.5);
  const [baselineSV, setBaselineSV] = useState(60);
  const [riskScore, setRiskScore] = useState('Moderate');

  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (mode === 'login') {
      const res = await login(username, password);
      if (res.success) {
        if (res.role === 'DOCTOR' || res.role === 'ADMIN' || res.role === 'NURSE') {
          navigate('/command-centre');
        } else {
          navigate('/dashboard');
        }
      } else {
        setAuthError(res.error);
      }
    } else {
      if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        setAuthError('Password must be min 8 characters, containing at least 1 uppercase letter and 1 number.');
        return;
      }

      let payload = { username, password, role };
      if (role === 'PATIENT') {
        payload = { ...payload, age, activeProtocol, targetMAP, baselineCO, baselineSV, riskScore };
      }
      const res = await register(payload);
      if (res.success) {
        setAuthSuccess('Account created successfully! You can now sign in.');
        setPassword('');
        setMode('login');
      } else {
        setAuthError(res.error);
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel auth-form" style={{ maxWidth: mode === 'register' && role === 'PATIENT' ? '600px' : '400px' }}>
        <div className="auth-tabs">
          <div className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setAuthError(''); setAuthSuccess(''); }}>Sign In</div>
          <div className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setAuthError(''); setAuthSuccess(''); }}>Sign Up</div>
        </div>

        {authError && (
          <div style={{ padding: '12px', background: 'rgba(255,77,106,0.1)', border: '1px solid #ff4d6a', color: '#ff4d6a', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', animation: 'fade-up 0.3s ease' }}>
            {authError}
          </div>
        )}
        {authSuccess && (
          <div style={{ padding: '12px', background: 'rgba(0,212,170,0.1)', border: '1px solid var(--teal)', color: 'var(--teal)', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', animation: 'fade-up 0.3s ease' }}>
            {authSuccess}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Username</label>
            <input className="input-field" type="text" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                className="input-field" 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                style={{ paddingRight: '50px' }}
                required 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            {mode === 'register' && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Min 8 chars, 1 uppercase, 1 number required.
              </div>
            )}
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  
  // New Admin Filters
  const [selectedWard, setSelectedWard] = useState('ALL');
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('DESC'); // Admission Date Sorting
  
  // Assignment UI State
  const [editingAssignmentFor, setEditingAssignmentFor] = useState(null);
  const [tempDoctor, setTempDoctor] = useState('');
  const [tempNurse, setTempNurse] = useState('');

  const [adminVitals, setAdminVitals] = useState({});

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
    const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
    fetch(`${API_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setUsers(data || []))
      .catch(() => {
        console.warn("Using dummy data for AdminDashboard");
        setUsers(generateDummyPatients());
      });

    const role = JSON.parse(localStorage.getItem('cliniaura_user'))?.role;
    const newSocket = io(API_URL, { auth: { token, role } });
    
    newSocket.on('vitals_update', (data) => {
      setAdminVitals(prev => ({
        ...prev,
        [data.vitals.patientId]: data.vitals
      }));
    });

    return () => newSocket.close();
  }, []);

  const handleReassign = async (patientId) => {
    try {
      const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`}/api/patients/${patientId}/assign`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedDoctor: tempDoctor, assignedNurse: tempNurse })
      });
      if(res.ok) {
        setUsers(users.map(u => u._id === patientId ? { ...u, assignedDoctor: tempDoctor, assignedNurse: tempNurse } : u));
        setEditingAssignmentFor(null);
      }
    } catch (e) { console.error('Failed to reassign staff'); }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchTerm || u.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'ALL' || u.role === selectedRole;
    const matchesWard = selectedWard === 'ALL' || u.ward === selectedWard;
    const matchesRisk = selectedRisk === 'ALL' || u.riskScore === selectedRisk;
    return matchesSearch && matchesRole && matchesWard && matchesRisk;
  }).sort((a, b) => {
    if (a.role === 'PATIENT' && b.role === 'PATIENT' && a.admissionDate && b.admissionDate) {
      return sortOrder === 'DESC' ? new Date(b.admissionDate) - new Date(a.admissionDate) : new Date(a.admissionDate) - new Date(b.admissionDate);
    }
    return 0;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Global Treatment Compliance Audits</h2>
          <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Edge AI log tracking to summarize treatment efficiency across care units.
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>


          <select
            value={selectedWard}
            onChange={e => setSelectedWard(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '100px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}
          >
            <option value="ALL">All Wards</option>
            <option value="ICU">ICU</option>
            <option value="Step-down Unit">Step-down Unit</option>
            <option value="General Ward">General Ward</option>
          </select>
          <select
            value={selectedRisk}
            onChange={e => setSelectedRisk(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '100px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}
          >
            <option value="ALL">All Risks</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Moderate">Moderate</option>
            <option value="Low">Low</option>
          </select>
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '100px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}
          >
            <option value="DESC">Newest First</option>
            <option value="ASC">Oldest First</option>
          </select>

          <input
            type="text"
            placeholder="Search username ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '100px',
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              fontSize: '0.85rem',
              outline: 'none',
              width: '200px'
            }}
          />
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* Patient Directory */}
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid #334155', fontWeight: 'bold' }}>Patient Directory</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.5)', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Patient ID / Name</th>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Location</th>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Assigned Staff</th>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Risk / Protocols</th>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Audit Logs</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.filter(u => u.role === 'PATIENT').map(u => (
                <React.Fragment key={u._id}>
                  <tr style={{ borderBottom: '1px solid #334155', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,212,170,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '16px' }}>
                      <strong>{u.username}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{u.primaryDiagnosis || 'Pending'}</div>
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.85rem' }}>{u.ward || 'General Ward'}</td>
                    <td style={{ padding: '16px', fontSize: '0.85rem' }}>
                      <div><span style={{ color: 'var(--text-dim)' }}>Dr:</span> {u.assignedDoctor || 'N/A'}</div>
                      <div><span style={{ color: 'var(--text-dim)' }}>Rn:</span> {u.assignedNurse || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={`badge-risk risk-${u.riskScore}`}>{u.riskScore} Risk</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--teal)', marginTop: '4px' }} className="truncate" title={u.activeProtocol}>{u.activeProtocol}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <button className="btn" style={{ background: expandedRow === u._id ? 'var(--teal)' : 'transparent', border: '1px solid var(--border)', color: expandedRow === u._id ? 'var(--bg)' : 'var(--teal)', padding: '4px 12px', fontSize: '0.8rem' }}
                        onClick={() => {
                          setExpandedRow(expandedRow === u._id ? null : u._id);
                          setTempDoctor(u.assignedDoctor || '');
                          setTempNurse(u.assignedNurse || '');
                          setEditingAssignmentFor(expandedRow === u._id ? null : u._id);
                        }}>
                        {expandedRow === u._id ? 'Hide Details' : 'View Full Details & Assign'}
                      </button>
                    </td>
                  </tr>

                </React.Fragment>
              ))}
              {filteredUsers.filter(u => u.role === 'PATIENT').length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No patients match the criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Staff Directory */}
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid #334155', fontWeight: 'bold' }}>Clinical Staff Directory</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.5)', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Staff Member</th>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Clearance Role</th>
                <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Assigned Patients under care</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.filter(u => u.role === 'DOCTOR' || u.role === 'NURSE').map(u => {
                // Find patients assigned to this staff member
                const staffPatients = users.filter(p => p.role === 'PATIENT' && (p.assignedDoctor === u.username || p.assignedNurse === u.username));
                
                return (
                  <tr key={u._id} style={{ borderBottom: '1px solid #334155', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,212,170,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '16px' }}>
                      <strong>{u.name || u.username}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>@{u.username}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className="text-gradient font-bold">{u.role}</span>
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                      {staffPatients.length > 0 ? (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {staffPatients.map(sp => (
                            <span key={sp._id} style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{sp.username}</span>
                          ))}
                        </div>
                      ) : (
                        <span>No patients currently assigned.</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.filter(u => u.role === 'DOCTOR' || u.role === 'NURSE').length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No staff members found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
      
      {/* Patient Details Full-Screen Modal */}
      {expandedRow && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(5, 10, 16, 0.95)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg2)', padding: '40px', position: 'relative', border: '1px solid var(--teal)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <button onClick={() => setExpandedRow(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--teal)', color: 'var(--bg)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
            {(() => {
              const u = filteredUsers.find(user => user._id === expandedRow);
              if (!u) return null;
              return (
                <div style={{ animation: 'fade-up 0.3s ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <h2 style={{ color: 'var(--teal)', margin: 0, fontSize: '1.8rem' }}>Patient Details: {u.name || u.username}</h2>
                    <div style={{ background: 'rgba(255, 77, 106, 0.1)', padding: '8px 16px', borderRadius: '8px', border: '1px solid #ff4d6a', color: '#ff4d6a', fontWeight: 'bold' }}>
                      Status: {u.riskScore} Risk
                    </div>
                  </div>
                  
                  {/* Real-time Vitals & Alerts Block */}
                  {(() => {
                    const v = adminVitals[u._id] || {};
                    return (
                      <div className="grid grid-cols-4 mb-4" style={{ gap: '16px' }}>
                        <div className="metric-box" style={{ background: 'rgba(0, 212, 170, 0.05)', border: '1px solid var(--teal)' }}>
                          <div style={{fontSize: '0.8rem', color: 'var(--teal)', textTransform: 'uppercase'}}>Heart Rate</div>
                          <div className="metric-val" style={{fontSize: '1.5rem', color: 'var(--text)'}}>{v.heartRate || '--'} <span style={{fontSize:'0.9rem', color:'var(--text-dim)'}}>bpm</span></div>
                        </div>
                        <div className="metric-box" style={{ background: 'rgba(0, 212, 170, 0.05)', border: '1px solid var(--teal)' }}>
                          <div style={{fontSize: '0.8rem', color: 'var(--teal)', textTransform: 'uppercase'}}>SpO2</div>
                          <div className="metric-val" style={{fontSize: '1.5rem', color: 'var(--text)'}}>{v.spO2 || '--'} <span style={{fontSize:'0.9rem', color:'var(--text-dim)'}}>%</span></div>
                        </div>
                        <div className="metric-box" style={{ background: 'rgba(0, 212, 170, 0.05)', border: '1px solid var(--teal)' }}>
                          <div style={{fontSize: '0.8rem', color: 'var(--teal)', textTransform: 'uppercase'}}>Blood Pressure</div>
                          <div className="metric-val" style={{fontSize: '1.5rem', color: 'var(--text)'}}>{v.bloodPressureSys || '--'}/{v.bloodPressureDia || '--'}</div>
                        </div>
                        <div className="metric-box" style={{ background: 'rgba(0, 212, 170, 0.05)', border: '1px solid var(--teal)' }}>
                          <div style={{fontSize: '0.8rem', color: 'var(--teal)', textTransform: 'uppercase'}}>Respiration</div>
                          <div className="metric-val" style={{fontSize: '1.5rem', color: 'var(--text)'}}>{v.respirationRate || '--'} <span style={{fontSize:'0.9rem', color:'var(--text-dim)'}}>rpm</span></div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-4 mb-4" style={{ gap: '16px' }}>
                    <div className="metric-box" style={{ gridColumn: 'span 4', display: 'flex', flexWrap: 'wrap', gap: '24px', padding: '20px', background: 'rgba(15, 23, 42, 0.5)' }}>
                      <div style={{ flex: '1 1 200px' }}>
                        <div style={{fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase'}}>Full Name</div>
                        <div className="metric-val" style={{fontSize: '1.2rem'}}>{u.name || u.username}</div>
                      </div>
                      <div style={{ flex: '1 1 100px' }}>
                        <div style={{fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase'}}>Patient ID</div>
                        <div className="metric-val" style={{fontSize: '1.2rem'}}>{u.patientId || u._id}</div>
                      </div>
                      <div style={{ flex: '1 1 100px' }}>
                        <div style={{fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase'}}>Age / Gender</div>
                        <div className="metric-val" style={{fontSize: '1.2rem'}}>{u.age ? `${u.age} yrs` : 'N/A'} / {u.gender || 'N/A'}</div>
                      </div>
                      <div style={{ flex: '1 1 200px' }}>
                        <div style={{fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase'}}>Location</div>
                        <div className="metric-val" style={{fontSize: '1.2rem'}}>{u.ward || 'General Ward'} {u.bedId ? `- ${u.bedId}` : ''}</div>
                      </div>
                    </div>
                    <div className="metric-box" style={{ gridColumn: 'span 4', display: 'flex', flexWrap: 'wrap', gap: '24px', padding: '20px', background: 'rgba(15, 23, 42, 0.5)' }}>
                      <div style={{ flex: '1 1 200px' }}>
                        <div style={{fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase'}}>Primary Diagnosis</div>
                        <div className="metric-val" style={{fontSize: '1.2rem', color: '#38bdf8'}}>{u.primaryDiagnosis || u.diagnosis || 'Pending'}</div>
                      </div>
                      <div style={{ flex: '1 1 200px' }}>
                        <div style={{fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase'}}>Protocol</div>
                        <div className="metric-val" style={{fontSize: '1.2rem'}}>{u.activeProtocol || 'None'}</div>
                      </div>
                      <div style={{ flex: '1 1 200px' }}>
                        <div style={{fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase'}}>Admission Date</div>
                        <div className="metric-val" style={{fontSize: '1.2rem'}}>{u.admissionDate || u.admittedOn ? new Date(u.admissionDate || u.admittedOn).toLocaleString() : 'N/A'}</div>
                      </div>
                    </div>
                    <div className="metric-box" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.5)' }}>
                      <div style={{fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase'}}>Target MAP</div>
                      <div className="metric-val" style={{fontSize: '1.2rem'}}>{u.targetMAP} mmHg</div>
                    </div>
                    <div className="metric-box" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.5)' }}>
                      <div style={{fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase'}}>Base Cardiac Output</div>
                      <div className="metric-val" style={{fontSize: '1.2rem'}}>{u.baselineCO} L/min</div>
                    </div>
                    <div className="metric-box" style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.5)' }}>
                      <div style={{fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase'}}>Base Stroke Volume</div>
                      <div className="metric-val" style={{fontSize: '1.2rem'}}>{u.baselineSV} mL</div>
                    </div>
                  </div>

                  {/* Admin Reassignment & Full Details */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '24px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #334155' }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--teal)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      Clinical Staff Assignment
                      <button onClick={() => handleReassign(u._id)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Save Assignment</button>
                    </h4>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Assign Doctor (Filtered by Specialty & Shift)</label>
                        <select value={tempDoctor} onChange={e => setTempDoctor(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.9rem' }}>
                          <option value="">-- Select Doctor --</option>
                          {users.filter(staff => staff.role === 'DOCTOR').map(doc => (
                            <option key={doc._id} value={doc.username}>{doc.name} ({doc.specialty || 'General'}) - {doc.shift || 'Any'} Shift</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Assign Nurse (Filtered by Shift)</label>
                        <select value={tempNurse} onChange={e => setTempNurse(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.9rem' }}>
                          <option value="">-- Select Nurse --</option>
                          {users.filter(staff => staff.role === 'NURSE').map(nurse => (
                            <option key={nurse._id} value={nurse.username}>{nurse.name} - {nurse.shift || 'Any'} Shift</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Care Schedule Preview */}
                  <div style={{ marginBottom: '20px' }}>
                     <CareSchedule patientId={u.patientId || u._id} patientName={u.name || u.username} role="ADMIN" />
                  </div>
                  
                  {/* Clinical Documents & ABG */}
                  <div style={{ marginBottom: '20px' }}>
                     <ABGManager patientId={u.patientId || u._id} patientName={u.name || u.username} />
                  </div>
                  
                  <h4 style={{marginBottom: '12px', fontSize: '1.1rem', color: 'var(--teal)'}}>
                    AI Treatment Audit Ledger Events
                  </h4>
                  {(!u.auditLogs || u.auditLogs.length === 0) ? <p style={{color: '#94a3b8', fontSize: '0.9rem'}}>No offline audits pending.</p> : (
                    <ul className="audit-list" style={{ marginTop: 0, background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px' }}>
                      {u.auditLogs.map((log, i) => (
                        <li key={i} className={`audit-item audit-${log.status.toLowerCase()}`}>
                          <span style={{color: '#94a3b8', marginRight: '10px', fontSize: '0.85rem'}}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <strong>[{log.status}]</strong> {log.event}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

const DoctorDashboard = () => {
  const { user } = useContext(AuthContext);
  const { activeAlerts, updateVitals, acknowledgeAlert } = useWardStore();
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [vitalsData, setVitalsData] = useState([]);
  const [alert, setAlert] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New filters for clinicians
  const [selectedWard, setSelectedWard] = useState('ALL');
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('DESC');

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
    const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
    fetch(`${API_URL}/api/patients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setPatients(Array.isArray(data) ? data : []))
      .catch(() => {
        console.warn("Using dummy data for DoctorDashboard");
        setPatients(generateDummyPatients());
      });

    const role = JSON.parse(localStorage.getItem('cliniaura_user'))?.role;
    const newSocket = io(API_URL, { auth: { token, role } });
    setSocket(newSocket);

    newSocket.on('vitals_update', (data) => {
      setVitalsData(prev => {
        // only keep vitals if they match the selected patient.
        // wait, we don't have access to selectedPatient here directly unless we use a ref or depend on it.
        // It's better to handle the filtering inside the effect that depends on selectedPatient.
        return prev;
      });
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    const handleVitals = (data) => {
      if (data.vitals.patientId === selectedPatient._id) {
        setVitalsData(prev => [...prev, data.vitals].slice(-20));
        if (data.alert) setAlert(data.alert);
      }
    };
    
    if (selectedPatient) {
      setVitalsData([]);
      setAlert(null);
      if (socket) {
        socket.emit('start_monitoring', selectedPatient._id);
        socket.on('vitals_update', handleVitals);
      }
      
      // Continuously poll the Jetson Nano Edge API for live telemetry
      if (window.doctorDemoInterval) clearInterval(window.doctorDemoInterval);
      window.doctorDemoInterval = setInterval(async () => {
        try {
          const nanoRes = await fetch('http://100.104.109.66:8000/dashboard/live');
          if (nanoRes.ok) {
            const liveData = await nanoRes.json();
            const myData = liveData.find(d => d.patient_id === selectedPatient._id || d.patient_id === selectedPatient.username);
            
            if (myData) {
              const vitals = {
                respirationRate: myData.respiration_rate || 16,
                heartRate: myData.heart_rate,
                bloodPressureSys: myData.systolic_bp,
                bloodPressureDia: myData.diastolic_bp,
                spO2: myData.spo2,
                temperature: 36.8,
                posture: 'Supine',
                steps: 0,
                fallDetected: false,
                ecgAnomaly: false,
                timestamp: new Date()
              };
              
              setVitalsData(prev => [...prev, vitals].slice(-20));
              
              if (myData.alerts && myData.alerts.length > 0) {
                setAlert(myData.alerts[0].reason);
              } else {
                setAlert(null);
              }
            }
          }
        } catch (e) {
          // Silently ignore connection errors
        }
      }, 2000);
    }
    return () => {
       if (socket) socket.off('vitals_update', handleVitals);
       if (window.doctorDemoInterval) clearInterval(window.doctorDemoInterval);
    };
  }, [selectedPatient, socket]);

  const latestVitals = vitalsData[vitalsData.length - 1];
  
  // Calculate displayed MAP from synthetic vitals for graphing
  const mapData = vitalsData.map(v => ({
    timestamp: v.timestamp,
    MAP: Math.round((v.bloodPressureSys + (2 * v.bloodPressureDia)) / 3),
    HeartRate: v.heartRate
  }));

  const [showMyPatientsOnly, setShowMyPatientsOnly] = useState(user?.role === 'NURSE');

  const filteredPatients = (Array.isArray(patients) ? patients : []).filter(p => {
    const matchesSearch = !searchTerm || p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (p.activeProtocol && p.activeProtocol.toLowerCase().includes(searchTerm.toLowerCase()));
    const isMyPatientsView = showMyPatientsOnly || user?.role === 'NURSE';
    const matchesMyPatients = !isMyPatientsView || p.assignedNurse === user?.username || p.assignedDoctor === user?.username;
    const matchesWard = selectedWard === 'ALL' || p.ward === selectedWard;
    const matchesRisk = selectedRisk === 'ALL' || p.riskScore === selectedRisk;
    
    console.log("Patient filter check:", p.username, { isMyPatientsView, matchesMyPatients, matchesWard, matchesRisk, assignedDoctor: p.assignedDoctor, username: user?.username });

    return matchesSearch && matchesMyPatients && matchesWard && matchesRisk;
  }).sort((a, b) => {
    if (a.admissionDate && b.admissionDate) {
      return sortOrder === 'DESC' ? new Date(b.admissionDate) - new Date(a.admissionDate) : new Date(a.admissionDate) - new Date(b.admissionDate);
    }
    return 0;
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch' }}>
        
        {/* System Patient Roster */}
        <div style={{ flex: 1, height: '82vh', overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0 }}>Thermodynamic Roster</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{filteredPatients.length} Connected</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search patient or protocol..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                flex: 1, minWidth: '150px', padding: '8px 12px', borderRadius: '100px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none'
              }}
            />
            <select
              value={selectedWard}
              onChange={e => setSelectedWard(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '100px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}
            >
              <option value="ALL">All Wards</option>
              <option value="ICU">ICU</option>
              <option value="General Ward">General Ward</option>
              <option value="Step-down Unit">Step-down Unit</option>
            </select>
            <select
              value={selectedRisk}
              onChange={e => setSelectedRisk(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '100px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}
            >
              <option value="ALL">All Risks</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '100px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}
            >
              <option value="DESC">Newest First</option>
              <option value="ASC">Oldest First</option>
            </select>
            {user?.role === 'DOCTOR' && (
              <button
                onClick={() => setShowMyPatientsOnly(!showMyPatientsOnly)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '100px',
                  border: `1px solid ${showMyPatientsOnly ? 'var(--teal)' : 'var(--border)'}`,
                  background: showMyPatientsOnly ? 'rgba(0, 212, 170, 0.15)' : 'var(--bg2)',
                  color: showMyPatientsOnly ? 'var(--teal)' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                My Patients
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            {filteredPatients.map(p => (
              <div key={p._id} className="patient-card" style={{ borderColor: selectedPatient?._id === p._id ? '#38bdf8' : '#334155', margin: 0, cursor: 'pointer' }} onClick={() => setSelectedPatient(p)}>
                <div className="patient-header">
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{p.username} <span style={{fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal'}}>{p.age}yrs</span></div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--teal-dim)', marginTop: '2px' }}>{p.activeProtocol || 'No Protocol Assigned'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge-risk risk-${p.riskScore}`}>{p.riskScore}</span>
                  </div>
                </div>
              </div>
            ))}
            {filteredPatients.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active patients match your search criteria.
              </div>
            )}
          </div>
        </div>
        
        <div style={{ flex: 2.5, display: 'flex', flexDirection: 'column' }}>
          {!selectedPatient ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '100px 50px', color: '#94a3b8', margin: 'auto 0' }}>
              <Activity size={64} style={{ opacity: 0.2, marginBottom: '20px', margin: '0 auto' }} />
              <h2>No Stream Connected</h2>
              <p style={{ fontSize: '0.9rem' }}>Select a patient from the roster to initialize the Edge Stream.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ display: 'inline', marginRight: '15px', fontSize: '1.4rem' }}>{selectedPatient.username} - Hemodynamic Trajectory</h2>
                  <span className={`badge-risk risk-${selectedPatient.riskScore}`} style={{ verticalAlign: 'middle' }}>{selectedPatient.riskScore} HPI Risk</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--teal)', fontWeight: 'bold' }}>
                  <span className="live-pulse"></span>Live Stream Operational
                </div>
              </div>
              
              {alert && (
                <div className="alert-banner">
                  <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Thermodynamic Instability Detected</strong>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>{alert}</p>
                  </div>
                </div>
              )}

              {latestVitals ? (
                <>
                  <div className="grid grid-cols-4 mb-4" style={{ gap: '12px' }}>
                    <div className="glass-panel vital-card" style={{ padding: '12px' }}>
                      <div className="vital-value" style={{ color: latestVitals.heartRate > 100 ? '#ff4d6a' : 'white', margin: '2px 0', fontSize: '2rem' }}>{latestVitals.heartRate}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center' }}>Heart Rate (bpm)</div>
                    </div>
                    <div className="glass-panel vital-card" style={{ padding: '12px' }}>
                      <div className="vital-value" style={{ margin: '2px 0', fontSize: '2rem' }}>{latestVitals.bloodPressureSys}/{latestVitals.bloodPressureDia}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center' }}>NIBP (mmHg)</div>
                    </div>
                    <div className="glass-panel vital-card" style={{ padding: '12px', borderColor: mapData[mapData.length-1]?.MAP < selectedPatient.targetMAP ? '#ff4d6a' : 'var(--border)' }}>
                      <div className="vital-value" style={{ color: mapData[mapData.length-1]?.MAP < selectedPatient.targetMAP ? '#ff4d6a' : '#38bdf8', margin: '2px 0', fontSize: '2rem' }}>
                        {mapData[mapData.length-1]?.MAP}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center' }}>MAP (mmHg)</div>
                    </div>
                    <div className="glass-panel vital-card" style={{ padding: '12px', background: 'rgba(0, 212, 170, 0.05)', borderColor: 'var(--teal)' }}>
                      <div className="vital-value truncate" style={{ color: 'var(--teal)', margin: '2px 0', fontSize: '1.1rem', maxWidth: '100%' }} title={selectedPatient.activeProtocol}>
                        {selectedPatient.activeProtocol || 'None'}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center' }}>Currently Auditing</div>
                    </div>
                  </div>

                  <div className="glass-panel chart-container" style={{ height: '360px', padding: '16px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      Continuous Physiology Relationship View (MAP vs HR)
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <LineChart data={mapData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="timestamp" tick={false} stroke="var(--text-muted)" />
                        <YAxis yAxisId="left" stroke="#38bdf8" domain={['dataMin - 10', 'dataMax + 10']} style={{fontSize:'0.75rem'}} />
                        <YAxis yAxisId="right" orientation="right" stroke="#ff4d6a" domain={['dataMin - 20', 'dataMax + 20']} style={{fontSize:'0.75rem'}} />
                        <Tooltip contentStyle={{ backgroundColor: '#050a10', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.75rem' }} />
                        <Line yAxisId="left" type="monotone" dataKey="MAP" stroke="#38bdf8" name="MAP (mmHg)" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line yAxisId="right" type="monotone" dataKey="HeartRate" stroke="#ff4d6a" name="Heart Rate (bpm)" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                  Awaiting edge synchronization broadcast packets...
                </div>
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
  const [latestVitals, setLatestVitals] = useState(null);
  const [socket, setSocket] = useState(null);
  const [callStatus, setCallStatus] = useState('');
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
    const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
    
    fetch(`${API_URL}/api/patients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        // Robust fallback for older cached sessions missing user.username
        const me = Array.isArray(data) ? (data.find(p => p.username === user?.username || p._id === user?.id) || data[0]) : null;
        if (me) setProfile(me);
      })
      .catch(() => {
        console.warn("Using dummy data for profile");
        const pts = generateDummyPatients();
        const me = pts.find(p => p.username === user.username) || pts[0];
        setProfile(me);
      });

    const newSocket = io(API_URL, { auth: { token, role: user?.role } });
    setSocket(newSocket);
    
    if (user && user.role?.toUpperCase() === 'PATIENT') {
      const savedUser = JSON.parse(localStorage.getItem('cliniaura_user'));
      // Using username to map to ID since our in-memory DB uses 1, 2 etc. 
      // A quick fetch of me gets the id. 
      // We will emit start monitoring with '1' or '2'
      fetch(`${API_URL}/api/patients`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
           const me = Array.isArray(data) ? (data.find(p => p.username === user?.username || p._id === user?.id) || data[0]) : null;
           if (me) {
             newSocket.emit('start_monitoring', me._id);
             newSocket.on('vitals_update', (socketData) => {
               if (String(socketData.vitals.patientId) === String(me._id)) {
                 setLatestVitals(socketData.vitals);
               }
             });
             
             // Fallback if no vitals received from Edge stream after 5 seconds
             setTimeout(() => {
               setLatestVitals(current => {
                 if (!current) {
                   console.warn("No edge vitals received. Using simulated dummy telemetry.");
                   if (window.patientDemoInterval) clearInterval(window.patientDemoInterval);
                   window.lastPatVitals = null;
                   
                   // Generate first frame immediately to avoid blank screen
                   const firstDummy = generateDummyVitals(me._id, window.lastPatVitals);
                   window.lastPatVitals = firstDummy;
                   
                   // Fallback to Jetson Nano Edge Polling
                   window.patientDemoInterval = setInterval(async () => {
                     try {
                       const nanoRes = await fetch('http://100.104.109.66:8000/dashboard/live');
                       if (nanoRes.ok) {
                         const liveData = await nanoRes.json();
                         const myData = liveData.find(d => d.patient_id === me._id || d.patient_id === me.username);
                         if (myData) {
                           setLatestVitals({
                             respirationRate: myData.respiration_rate || 16,
                             heartRate: myData.heart_rate,
                             bloodPressureSys: myData.systolic_bp,
                             bloodPressureDia: myData.diastolic_bp,
                             spO2: myData.spo2,
                             temperature: 36.8,
                             posture: 'Supine',
                             steps: 0,
                             fallDetected: false,
                             ecgAnomaly: false
                           });
                           return; // Skip dummy if Nano succeeds
                         }
                       }
                     } catch (e) {
                       // Silently ignore errors
                     }
                   }, 3000);
                   return firstDummy;
                 }
                 return current;
               });
             }, 5000);
           }
        })
        .catch(() => {
           console.warn("Using dummy data for PatientDashboard socket mapping");
           const pts = generateDummyPatients();
           const me = pts[0];
           if (me) {
             if (window.patientDemoInterval) clearInterval(window.patientDemoInterval);
             window.lastPatVitals = null;
             window.patientDemoInterval = setInterval(() => {
               const vitals = generateDummyVitals(me._id, window.lastPatVitals);
               window.lastPatVitals = vitals;
               setLatestVitals(vitals);
             }, 3000);
           }
         });
    }

    return () => {
       newSocket.disconnect();
       if (window.patientDemoInterval) clearInterval(window.patientDemoInterval);
    };
  }, [user]);

  return (
    <div style={{ animation: 'fade-up 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            {profile ? `${profile.name} - Dashboard` : `${user.username}`}
            {profile && <span style={{ fontSize: '0.8rem', padding: '4px 12px', borderRadius: '100px', background: 'var(--surface2)', color: 'var(--text-dim)', border: '1px solid var(--border)', verticalAlign: 'middle', fontWeight: 'normal' }}>ID: {profile.patientId || 'Pending'}</span>}
          </h2>
          {profile && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <span><strong>Admitted:</strong> {profile.admissionDate ? new Date(profile.admissionDate).toLocaleString() : '--'}</span>
              <span><strong>Diagnosed:</strong> {profile.diagnosisDate ? new Date(profile.diagnosisDate).toLocaleString() : '--'}</span>
              <span><strong>Nurse:</strong> {profile.assignedNurse || 'Unassigned'}</span>
              <span><strong>Doctor:</strong> {profile.assignedDoctor || 'Unassigned'}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
          <div style={{ color: 'var(--teal)', fontSize: '0.9rem', fontWeight: 'bold' }}>
            <span className="live-pulse"></span> Dashboard Connected
          </div>
          <button 
            onClick={() => {
              if (!profile || !socket) return;
              const callData = { patientId: profile._id, patientName: profile.name || profile.username, timestamp: new Date().toISOString() };
              fetch(`${import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`}/api/patient-calls`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(callData)
              }).then(res => res.json()).then(data => {
                socket.emit('patient_call', data);
                setCallStatus('Nurse has been notified!');
                setTimeout(() => setCallStatus(''), 5000);
              });
            }}
            className="btn"
            style={{ background: '#ff4d6a', color: 'white', border: 'none', padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(255, 77, 106, 0.3)' }}
          >
            <Bell size={18} /> Call Nurse / Request Assistance
          </button>
          {callStatus && <div style={{ color: '#ff4d6a', fontSize: '0.85rem', fontWeight: 'bold' }}>{callStatus}</div>}
        </div>
      </div>
      
      {profile && (
        <div className="glass-panel mb-4" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: 'rgba(0, 212, 170, 0.05)' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Age / Diagnosis</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text)' }}>{profile.age} <span style={{fontSize: '0.75rem', fontWeight:'normal', color:'var(--text-muted)'}}>yrs</span> <span style={{color: 'var(--text-dim)', fontWeight: 'normal', margin: '0 8px'}}>|</span> {profile.primaryDiagnosis || 'Under Evaluation'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audited Protocol</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--teal)' }} className="truncate" title={profile.activeProtocol}>{profile.activeProtocol || 'Standard Care'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target MAP</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--cyan)' }}>{profile.targetMAP || '--'} <span style={{fontSize: '0.75rem', fontWeight:'normal', color:'var(--text-muted)'}}>mmHg</span></div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>HPI Status</div>
            <div><span className={`badge-risk risk-${profile.riskScore}`} style={{ marginTop: '2px', display: 'inline-block' }}>{profile.riskScore || 'Unknown'} Risk</span></div>
          </div>
        </div>
      )}

      {profile ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          
          <div className="glass-panel vital-card" style={{ padding: '20px', 
              background: (latestVitals?.respirationRate < 12 || latestVitals?.respirationRate > 20) ? 'rgba(185, 28, 28, 0.2)' : 'rgba(16, 185, 129, 0.15)', 
              borderColor: (latestVitals?.respirationRate < 12 || latestVitals?.respirationRate > 20) ? 'rgba(239, 68, 68, 0.4)' : 'rgba(52, 211, 153, 0.3)' 
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', 
                color: (latestVitals?.respirationRate < 12 || latestVitals?.respirationRate > 20) ? '#fca5a5' : '#6ee7b7', 
                fontSize: '0.8rem', textTransform: 'uppercase' 
              }}>
              <Wind size={18} color={(latestVitals?.respirationRate < 12 || latestVitals?.respirationRate > 20) ? '#f87171' : '#34d399'} /> Respiration
            </div>
            <div className="vital-value" style={{ margin: '15px 0 5px 0', fontSize: '3rem', color: '#fff', fontWeight: 'bold' }}>
              {latestVitals?.respirationRate || '--'}
            </div>
            <div style={{ color: (latestVitals?.respirationRate < 12 || latestVitals?.respirationRate > 20) ? '#fca5a5' : '#6ee7b7', fontSize: '0.85rem' }}>BrPM</div>
          </div>

          <div className="glass-panel vital-card" style={{ padding: '20px', background: 'rgba(14, 165, 233, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#bae6fd', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <Heart size={18} color="#38bdf8" /> Heart Rate
            </div>
            <div className="vital-value" style={{ margin: '15px 0 5px 0', fontSize: '3rem', color: '#fff', fontWeight: 'bold' }}>
              {latestVitals?.heartRate || '--'}
            </div>
            <div style={{ color: '#bae6fd', fontSize: '0.85rem' }}>BPM</div>
          </div>

          <div className="glass-panel vital-card" style={{ padding: '20px', background: 'rgba(14, 165, 233, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#bae6fd', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <Activity size={18} color="#38bdf8" /> Blood Pressure
            </div>
            <div className="vital-value" style={{ margin: '15px 0 5px 0', fontSize: '3rem', color: '#fff', fontWeight: 'bold' }}>
              {latestVitals ? `${latestVitals.bloodPressureSys}/${latestVitals.bloodPressureDia}` : '--/--'}
            </div>
            <div style={{ color: '#bae6fd', fontSize: '0.85rem' }}>mmHg</div>
          </div>

          <div className="glass-panel vital-card" style={{ gridColumn: 'span 3', padding: '20px', background: 'rgba(14, 165, 233, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#bae6fd', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '15px' }}>
              <Activity size={18} color="#38bdf8" /> ECG
            </div>
            <div style={{ height: '100px', width: '100%', position: 'relative', overflow: 'hidden' }}>
              <svg viewBox="0 0 500 100" style={{ width: '100%', height: '100%', stroke: '#38bdf8', fill: 'none', strokeWidth: 2 }}>
                <path className={latestVitals ? "ecg-line-animate" : ""} d="M0,50 L50,50 L60,30 L70,70 L80,50 L100,50 L110,40 L120,60 L130,50 L180,50 L190,10 L210,90 L220,50 L250,50 L260,30 L270,70 L280,50 L300,50 L310,40 L320,60 L330,50 L380,50 L390,10 L410,90 L420,50 L500,50" />
              </svg>
            </div>
          </div>

          <div className="glass-panel vital-card" style={{ padding: '20px', background: 'rgba(14, 165, 233, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#bae6fd', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <Thermometer size={18} color="#38bdf8" /> Temperature
            </div>
            <div className="vital-value" style={{ margin: '15px 0 5px 0', fontSize: '3rem', color: '#fff', fontWeight: 'bold' }}>
              {latestVitals ? '36.8' : '--'}
            </div>
            <div style={{ color: '#bae6fd', fontSize: '0.85rem' }}>°C</div>
          </div>

          <div className="glass-panel vital-card" style={{ padding: '20px', background: 'rgba(14, 165, 233, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#bae6fd', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <Droplet size={18} color="#38bdf8" /> SpO2
            </div>
            <div className="vital-value" style={{ margin: '15px 0 5px 0', fontSize: '3rem', color: '#fff', fontWeight: 'bold' }}>
              {latestVitals?.spO2 || '--'}
            </div>
            <div style={{ color: '#bae6fd', fontSize: '0.85rem' }}>%</div>
          </div>

          <div className="glass-panel vital-card" style={{ padding: '20px', background: 'rgba(14, 165, 233, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#bae6fd', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <Footprints size={18} color="#38bdf8" /> Steps
            </div>
            <div className="vital-value" style={{ margin: '15px 0 5px 0', fontSize: '3rem', color: '#fff', fontWeight: 'bold' }}>
              {latestVitals?.steps || '--'}
            </div>
            <div style={{ color: '#bae6fd', fontSize: '0.85rem' }}>Count</div>
          </div>

          <div className="glass-panel vital-card" style={{ padding: '20px', background: 'rgba(14, 165, 233, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)', gridColumn: 'span 1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#bae6fd', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <Accessibility size={18} color="#38bdf8" /> Posture
            </div>
            <div className="vital-value" style={{ margin: '15px 0 5px 0', fontSize: '2rem', color: '#fff', fontWeight: 'bold' }}>
              {latestVitals?.posture || '--'}
            </div>
          </div>

          <div className="glass-panel vital-card" style={{ padding: '20px', background: 'rgba(14, 165, 233, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)', gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#bae6fd', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        <ShieldAlert size={18} color="#38bdf8" /> Fall Detection
            </div>
            <div className="vital-value" style={{ margin: '15px 0 5px 0', fontSize: '2rem', color: latestVitals?.fallDetected ? '#ff4d6a' : 'var(--teal)', fontWeight: 'bold' }}>
              {latestVitals ? (latestVitals.fallDetected ? 'Fall Detected' : 'No falls detected') : '--'}
            </div>
          </div>

          {profile && (
            <>
              <div style={{ gridColumn: 'span 3' }}>
                <EHRManager 
                  patientId={profile._id} 
                  patientName={profile.name || profile.username} 
                  patientAge={profile.age}
                />
              </div>

              <div style={{ gridColumn: 'span 3' }}>
                <CareSchedule 
                  patientId={profile._id} 
                  patientName={profile.name || profile.username} 
                  role="PATIENT"
                />
              </div>
            </>
          )}

        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-muted)' }}>Loading dashboard data...</div>
      )}
    </div>
  );
};

const DashboardRouter = () => {
  const { user } = useContext(AuthContext);
  const [personalInfo, setPersonalInfo] = useState(null);

  useEffect(() => {
    if (user) {
      const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
      const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
      
      if (user.role?.toUpperCase() === 'PATIENT') {
        fetch(`${API_URL}/api/patients`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            const me = Array.isArray(data) ? (data.find(p => p.username === user.username || p._id === user.id) || data[0]) : null;
            if (me) setPersonalInfo(me);
          }).catch(console.error);
      } else {
        fetch(`${API_URL}/api/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            const me = Array.isArray(data) ? data.find(u => u.username === user.username) : null;
            if (me) setPersonalInfo(me);
          }).catch(console.error);
      }
    }
  }, [user]);

  if (!user) return <Navigate to="/login" />;
  
  return (
    <div className="dashboard-container" style={{ animation: 'fade-up 0.3s ease' }}>
      {/* Prominent Unified Header for User Personal Context */}
      <div className="glass-panel mb-4" style={{ 
        background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.04) 0%, rgba(0, 194, 224, 0.04) 100%)', 
        border: '1px solid var(--border)', 
        padding: '1.5rem', 
        borderRadius: '16px',
        boxShadow: 'var(--glow)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--teal)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Authenticated Identity Overview</div>
            <h2 style={{ margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {user.username}
              <span style={{ fontSize: '0.8rem', padding: '2px 10px', borderRadius: '100px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', verticalAlign: 'middle', fontWeight: '500' }}>
                Role Context: <strong className="text-gradient">{user.role}</strong>
              </span>
            </h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Session Context</div>
            <div style={{ color: 'var(--teal)', fontWeight: '600', fontSize: '0.85rem' }}>Secure JWT Authorized Stream</div>
          </div>
        </div>


      </div>

      {/* Embedded Component Interfaces */}
      {user.role?.toUpperCase() === 'ADMIN' && <AdminDashboard />}
      {(user.role?.toUpperCase() === 'DOCTOR' || user.role?.toUpperCase() === 'NURSE') && <DoctorDashboard />}
      {user.role?.toUpperCase() === 'PATIENT' && <PatientDashboard />}
    </div>
  );
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
          <Route path="/command-centre" element={<ProtectedRoute roleRequired={['DOCTOR', 'ADMIN', 'NURSE']}><CommandCentre /></ProtectedRoute>} />
          <Route path="/alert-history" element={<ProtectedRoute roleRequired={['DOCTOR', 'ADMIN', 'NURSE']}><AlertHistory /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/settings/alarms" element={<ProtectedRoute roleRequired="ADMIN"><AlarmSettings /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute roleRequired="ADMIN"><AuditDashboard /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
