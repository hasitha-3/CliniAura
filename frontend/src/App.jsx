import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Heart, Wind, Droplet, AlertTriangle, LogOut, Shield, ShieldAlert, Stethoscope, User as UserIcon, ChevronDown, ChevronRight, CheckCircle, Info, Settings, FileText, Thermometer, Footprints, Accessibility } from 'lucide-react';
import { generateDummyPatients, generateDummyVitals, generateMedGemmaAlert } from './utils/dummyDataSimulator';
import './index.css';

import CommandCentre from './pages/CommandCentre';
import AuditDashboard from './pages/AuditDashboard';
import AlarmSettings from './pages/AlarmSettings';
import AlertHistory from './pages/AlertHistory';
import HomePage from './pages/HomePage';
import EHRManager from './components/EHRManager';

export const AuthContext = createContext(null);

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
        return { success: true, role: data.role };
      }
      return { success: false, error: data.error || 'Invalid username or password' };
    } catch (err) {
      console.warn("Backend unavailable, falling back to dummy authentication.");
      const demoUser = { id: 'dummy-admin', username, role: username.toLowerCase().includes('patient') ? 'PATIENT' : 'ADMIN', token: 'demo-token' };
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
          <a href="#roadmap" onClick={(e) => handleNavClick(e, '#roadmap')}>Roadmap</a>
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
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
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
      fetch('http://localhost:8000/api/v1/health')
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
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
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

    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
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

              <button className="btn btn-secondary" type="submit" style={{ width: '100%', marginTop: '10px' }}>
                Update Password
              </button>
            </form>
          )}
        </div>

        {(user?.role === 'DOCTOR' || user?.role === 'ADMIN') && (
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
              <button className="btn btn-secondary" onClick={saveApiKey} style={{ width: '100%', marginTop: '10px' }}>
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

  useEffect(() => {
    const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
    fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setUsers(data || []))
      .catch(() => {
        console.warn("Using dummy data for AdminDashboard");
        setUsers(generateDummyPatients());
      });
  }, []);

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchTerm || u.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'ALL' || u.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="dashboard-container" style={{ padding: '16px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Global Treatment Compliance Audits</h2>
          <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Edge AI log tracking to summarize treatment efficiency across care units.
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>


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
      
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid #334155' }}>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>User ID / Node Name</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Assigned Clearance</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Therapeutic Status</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Compliance Ledger</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => (
              <React.Fragment key={u._id}>
                <tr style={{ borderBottom: '1px solid #334155', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,212,170,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '16px' }}>
                    <strong>{u.username}</strong>
                    {u.role === 'PATIENT' && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ward: {u.ward || 'General Ward'}</div>}
                  </td>
                  <td style={{ padding: '16px' }}><span className="text-gradient font-bold">{u.role}</span></td>
                  <td style={{ padding: '16px' }}>
                    {u.role === 'PATIENT' ? (
                      <span className={`badge-risk risk-${u.riskScore}`}>{u.riskScore} Risk</span>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>System Sentinel</span>}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {u.role === 'PATIENT' && (
                      <button className="btn" style={{ background: expandedRow === u._id ? 'var(--teal)' : 'transparent', border: '1px solid var(--border)', color: expandedRow === u._id ? 'var(--bg)' : 'var(--teal)', padding: '4px 12px', fontSize: '0.8rem' }}
                        onClick={() => setExpandedRow(expandedRow === u._id ? null : u._id)}>
                        {expandedRow === u._id ? 'Hide Logs' : 'View AI Audits'}
                      </button>
                    )}
                  </td>
                </tr>
                {expandedRow === u._id && u.role === 'PATIENT' && (
                  <tr style={{ background: 'var(--bg2)' }}>
                    <td colSpan="4" style={{ padding: '20px', borderBottom: '2px solid var(--teal)' }}>
                      <div className="grid grid-cols-4 mb-4" style={{ gap: '12px' }}>
                        <div className="metric-box">
                          <div style={{fontSize: '0.75rem', color: '#94a3b8'}}>Protocol</div>
                          <div className="metric-val" style={{fontSize: '0.95rem'}}>{u.activeProtocol || 'None'}</div>
                        </div>
                        <div className="metric-box">
                          <div style={{fontSize: '0.75rem', color: '#94a3b8'}}>Target MAP</div>
                          <div className="metric-val" style={{fontSize: '0.95rem'}}>{u.targetMAP} mmHg</div>
                        </div>
                        <div className="metric-box">
                          <div style={{fontSize: '0.75rem', color: '#94a3b8'}}>Base Cardiac Output</div>
                          <div className="metric-val" style={{fontSize: '0.95rem'}}>{u.baselineCO} L/min</div>
                        </div>
                        <div className="metric-box">
                          <div style={{fontSize: '0.75rem', color: '#94a3b8'}}>Base Stroke Volume</div>
                          <div className="metric-val" style={{fontSize: '0.95rem'}}>{u.baselineSV} mL</div>
                        </div>
                      </div>
                      
                      <h4 style={{marginBottom: '10px', fontSize: '0.9rem', color: 'var(--teal)'}}>
                        AI Treatment Audit Ledger Events
                      </h4>
                      {(!u.auditLogs || u.auditLogs.length === 0) ? <p style={{color: '#94a3b8', fontSize: '0.85rem'}}>No offline audits pending.</p> : (
                        <ul className="audit-list" style={{ marginTop: 0 }}>
                          {u.auditLogs.map((log, i) => (
                            <li key={i} className={`audit-item audit-${log.status.toLowerCase()}`}>
                              <span style={{color: '#94a3b8', marginRight: '10px', fontSize: '0.75rem'}}>{new Date(log.timestamp).toLocaleTimeString()}</span>
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
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No node stream matches the criteria.</td>
              </tr>
            )}
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
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
    fetch(`${API_URL}/api/patients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setPatients(data || []))
      .catch(() => {
        console.warn("Using dummy data for DoctorDashboard");
        setPatients(generateDummyPatients());
      });

    const role = JSON.parse(localStorage.getItem('cliniaura_user'))?.role;
    const newSocket = io(API_URL, { auth: { token, role } });
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
    if (selectedPatient) {
      setVitalsData([]);
      setAlert(null);
      if (socket) socket.emit('start_monitoring', selectedPatient._id);
      
      // Setup demo interval if backend is unavailable
      if (!socket || !socket.connected) {
         if (window.doctorDemoInterval) clearInterval(window.doctorDemoInterval);
         window.lastDocVitals = null;
         window.doctorDemoInterval = setInterval(() => {
           const vitals = generateDummyVitals(selectedPatient._id, window.lastDocVitals);
           window.lastDocVitals = vitals;
           setVitalsData(prev => [...prev, vitals].slice(-20));
           const al = generateMedGemmaAlert(selectedPatient._id, vitals);
           if (al) setAlert(al.message);
         }, 3000);
      }
    }
    return () => {
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

  const filteredPatients = patients.filter(p => {
    if (!searchTerm) return true;
    return p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (p.activeProtocol && p.activeProtocol.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="dashboard-container" style={{ padding: '16px 32px' }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch' }}>
        
        {/* System Patient Roster */}
        <div style={{ flex: 1, height: '82vh', overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0 }}>Thermodynamic Roster</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{filteredPatients.length} Connected</span>
          </div>

          <input
            type="text"
            placeholder="Search patient or protocol..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 14px',
              borderRadius: '100px',
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              fontSize: '0.85rem',
              outline: 'none',
              marginBottom: '16px'
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            {filteredPatients.map(p => (
              <div key={p._id} className="patient-card" style={{ borderColor: selectedPatient?._id === p._id ? '#38bdf8' : '#334155', margin: 0 }}>
                <div className="patient-header" onClick={() => setExpandedPatientId(expandedPatientId === p._id ? null : p._id)}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{p.username} <span style={{fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal'}}>{p.age}yrs</span></div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--teal-dim)', marginTop: '2px' }}>{p.activeProtocol || 'No Protocol Assigned'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge-risk risk-${p.riskScore}`}>{p.riskScore}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{expandedPatientId === p._id ? '▲' : '▼'}</span>
                  </div>
                </div>
                
                {expandedPatientId === p._id && (
                  <div className="patient-details-expanded" style={{ animation: 'fade-up 0.2s ease' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <div className="metric-box" style={{flex: 1, padding: '6px'}}>
                        <div style={{fontSize: '0.65rem', color: '#94a3b8'}} title="Mean Arterial Pressure">Target MAP</div>
                        <div className="metric-val" style={{fontSize: '0.9rem'}}>{p.targetMAP} <span style={{fontSize: '0.65rem', fontWeight:'normal'}}>mmHg</span></div>
                      </div>
                      <div className="metric-box" style={{flex: 1, padding: '6px'}}>
                        <div style={{fontSize: '0.65rem', color: '#94a3b8'}} title="Cardiac Output">Base CO</div>
                        <div className="metric-val" style={{fontSize: '0.9rem'}}>{p.baselineCO} <span style={{fontSize: '0.65rem', fontWeight:'normal'}}>L/m</span></div>
                      </div>
                      <div className="metric-box" style={{flex: 1, padding: '6px'}}>
                        <div style={{fontSize: '0.65rem', color: '#94a3b8'}} title="Stroke Volume">Base SV</div>
                        <div className="metric-val" style={{fontSize: '0.9rem'}}>{p.baselineSV} <span style={{fontSize: '0.65rem', fontWeight:'normal'}}>mL</span></div>
                      </div>
                    </div>
                    
                    <div style={{fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px'}}>Recent AI Treatment Audits:</div>
                    <ul className="audit-list" style={{ marginTop: 0, fontSize: '0.75rem' }}>
                      {p.auditLogs?.slice(0, 2).map((log, i) => (
                        <li key={i} className={`audit-item audit-${log.status.toLowerCase()}`} style={{ padding: '4px 8px', marginBottom: '4px' }}>
                          <strong>[{log.status}]</strong> {log.event}
                        </li>
                      )) || <li style={{color:'var(--text-muted)'}}>No audits logged.</li>}
                    </ul>

                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px', padding: '6px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); setSelectedPatient(p); }}>
                      Monitor Live Edge Stream
                    </button>
                  </div>
                )}
              </div>
            ))}
            {filteredPatients.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active patients match your search criteria.
              </div>
            )}
          </div>
        </div>
        
        {/* Active Stream View */}
        <div style={{ flex: 2.5, display: 'flex', flexDirection: 'column' }}>
          {!selectedPatient ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '100px 50px', color: '#94a3b8', margin: 'auto 0' }}>
              <Activity size={64} style={{ opacity: 0.2, marginBottom: '20px', margin: '0 auto' }} />
              <h2>No Stream Connected</h2>
              <p style={{ fontSize: '0.9rem' }}>Expand a patient card in the roster and initialize the Edge Stream.</p>
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

                  <div className="grid grid-cols-4 mb-4" style={{ gap: '12px' }}>
                    <div className="glass-panel vital-card" style={{ padding: '12px' }}>
                      <div className="vital-value" style={{ margin: '2px 0', fontSize: '1.5rem', color: 'var(--text)' }}>{latestVitals.respirationRate || '--'}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center' }}>Respiration (BrPM)</div>
                    </div>
                    <div className="glass-panel vital-card" style={{ padding: '12px' }}>
                      <div className="vital-value" style={{ margin: '2px 0', fontSize: '1.5rem', color: 'var(--text)' }}>{latestVitals.steps || '--'}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center' }}>Steps (Count)</div>
                    </div>
                    <div className="glass-panel vital-card" style={{ padding: '12px' }}>
                      <div className="vital-value" style={{ margin: '2px 0', fontSize: '1.5rem', color: 'var(--text)' }}>{latestVitals.posture || '--'}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center' }}>Posture</div>
                    </div>
                    <div className="glass-panel vital-card" style={{ padding: '12px' }}>
                      <div className="vital-value" style={{ margin: '2px 0', fontSize: '1.1rem', color: latestVitals.fallDetected ? '#ff4d6a' : 'var(--teal)' }}>
                        {latestVitals.fallDetected ? 'Fall Detected' : 'No Falls'}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center' }}>Fall Detection</div>
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
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
    
    fetch(`${API_URL}/api/patients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        const me = Array.isArray(data) ? data.find(p => p.username === user.username) : null;
        if (me) setProfile(me);
      })
      .catch(console.error);

    const socket = io(API_URL);
    if (user && user.role === 'PATIENT') {
      const savedUser = JSON.parse(localStorage.getItem('cliniaura_user'));
      // Using username to map to ID since our in-memory DB uses 1, 2 etc. 
      // A quick fetch of me gets the id. 
      // We will emit start monitoring with '1' or '2'
      fetch(`${API_URL}/api/patients`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
           const me = Array.isArray(data) ? data.find(p => p.username === user.username) : null;
           if (me) {
             socket.emit('start_monitoring', me._id);
             socket.on('vitals_update', (socketData) => {
               if (socketData.vitals.patientId === me._id) {
                 setLatestVitals(socketData.vitals);
               }
             });
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
       socket.disconnect();
       if (window.patientDemoInterval) clearInterval(window.patientDemoInterval);
    };
  }, [user]);

  return (
    <div className="dashboard-container" style={{ padding: '24px', animation: 'fade-up 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0 }}>{profile ? `${profile.name} - Dashboard` : `${user.username}`}</h2>
          {profile && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '6px' }}>
              <strong>ID:</strong> {profile.patientId || 'Pending'} &nbsp;|&nbsp; 
              <strong>Age/Sex:</strong> {profile.age}{profile.gender ? ` / ${profile.gender}` : ''} &nbsp;|&nbsp; 
              <strong>Diagnosis:</strong> {profile.primaryDiagnosis || 'Under Evaluation'}
            </div>
          )}
        </div>
        <div style={{ color: 'var(--teal)', fontSize: '0.9rem', fontWeight: 'bold' }}>
          <span className="live-pulse"></span> Dashboard Connected
        </div>
      </div>
      
      {profile ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          
          <div className="glass-panel vital-card" style={{ padding: '20px', background: 'rgba(185, 28, 28, 0.2)', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <Wind size={18} color="#f87171" /> Respiration
            </div>
            <div className="vital-value" style={{ margin: '15px 0 5px 0', fontSize: '3rem', color: '#fff', fontWeight: 'bold' }}>
              {latestVitals?.respirationRate || '--'}
            </div>
            <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>BrPM</div>
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

          <div style={{ gridColumn: 'span 3' }}>
            <EHRManager 
              patientId={profile._id} 
              patientName={profile.name || profile.username} 
              patientAge={profile.age}
            />
          </div>

        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-muted)' }}>Loading your dashboard...</div>
      )}
    </div>
  );
};

const DashboardRouter = () => {
  const { user } = useContext(AuthContext);
  const [personalInfo, setPersonalInfo] = useState(null);

  useEffect(() => {
    if (user) {
      const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
      
      if (user.role === 'PATIENT') {
        fetch(`${API_URL}/api/patients`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            const me = Array.isArray(data) ? data.find(p => p.username === user.username) : null;
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
    <div style={{ animation: 'fade-up 0.3s ease' }}>
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

        {personalInfo && user.role === 'PATIENT' && (
          <div className="grid grid-cols-4 mt-4" style={{ borderTop: '1px solid rgba(0, 212, 170, 0.1)', paddingTop: '1.2rem', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Age Profile</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text)' }}>{personalInfo.age} <span style={{fontSize: '0.75rem', fontWeight:'normal', color:'var(--text-muted)'}}>yrs</span></div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audited Protocol</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--teal)' }} className="truncate" title={personalInfo.activeProtocol}>{personalInfo.activeProtocol}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target MAP</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--cyan)' }}>{personalInfo.targetMAP} <span style={{fontSize: '0.75rem', fontWeight:'normal', color:'var(--text-muted)'}}>mmHg</span></div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>HPI Status</div>
              <div><span className={`badge-risk risk-${personalInfo.riskScore}`} style={{ marginTop: '2px', display: 'inline-block' }}>{personalInfo.riskScore} Risk</span></div>
            </div>
          </div>
        )}

        {personalInfo && (user.role === 'DOCTOR' || user.role === 'ADMIN') && (
          <div className="mt-3" style={{ fontSize: '0.85rem', color: 'var(--text-dim)', borderTop: '1px solid rgba(0, 212, 170, 0.1)', paddingTop: '0.8rem' }}>
            <strong>System Registry Key:</strong> {personalInfo._id} | <strong>Authority Clearance:</strong> Complete administrative diagnostic and real-time hemodynamic command streams enabled.
          </div>
        )}
      </div>

      {/* Embedded Component Interfaces */}
      {user.role === 'ADMIN' && <AdminDashboard />}
      {user.role === 'DOCTOR' && <DoctorDashboard />}
      {user.role === 'PATIENT' && <PatientDashboard />}
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
