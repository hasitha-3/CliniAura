import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Heart, Wind, Droplet, AlertTriangle, LogOut, Shield, Stethoscope, User as UserIcon, ChevronDown, ChevronRight, CheckCircle, Info, Settings, FileText } from 'lucide-react';
import './index.css';

import CommandCentre from './pages/CommandCentre';
import AuditDashboard from './pages/AuditDashboard';
import AlarmSettings from './pages/AlarmSettings';
import HomePage from './pages/HomePage';

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
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid username or password' };
    } catch (err) {
      return { success: false, error: 'Cannot connect to server. Please verify backend is running.' };
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
      return { success: false, error: 'Cannot connect to server. Please verify backend is running.' };
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
      
      <div className="nav-links" style={{ display: window.innerWidth <= 900 && menuOpen ? 'flex' : undefined, flexDirection: window.innerWidth <= 900 ? 'column' : 'row', position: window.innerWidth <= 900 ? 'absolute' : 'static', top: '100%', left: 0, right: 0, background: window.innerWidth <= 900 ? 'var(--surface)' : 'transparent', padding: window.innerWidth <= 900 ? '1.5rem' : 0, borderBottom: window.innerWidth <= 900 ? '1px solid var(--border)' : 'none' }}>
        <a href="#problem" onClick={(e) => handleNavClick(e, '#problem')}>Problem</a>
        <a href="#solution" onClick={(e) => handleNavClick(e, '#solution')}>Solution</a>
        <a href="#technology" onClick={(e) => handleNavClick(e, '#technology')}>Technology</a>
        <a href="#team" onClick={(e) => handleNavClick(e, '#team')}>Team</a>
        <a href="#roadmap" onClick={(e) => handleNavClick(e, '#roadmap')}>Roadmap</a>
        <a href="#contact" onClick={(e) => handleNavClick(e, '#contact')} className="nav-cta">Get in Touch</a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {user ? (
          <>
            <button className="btn" style={{ background: 'transparent', color: 'var(--text)', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate('/dashboard')}>Dashboard</button>
            {(user.role === 'DOCTOR' || user.role === 'ADMIN') && (
              <button className="btn" style={{ background: 'transparent', color: 'var(--text)', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate('/command-centre')}>Command</button>
            )}
            {user.role === 'ADMIN' && (
              <>
                <button className="btn" style={{ background: 'transparent', color: 'var(--text)', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate('/admin/audit')}>Audit</button>
                <button className="btn" style={{ background: 'transparent', color: 'var(--text)', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate('/settings/alarms')}>Alarms</button>
              </>
            )}
            <span style={{ background: 'rgba(0, 212, 170, 0.08)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '100px', fontSize: '0.75rem', color: 'var(--teal)' }}>
              {user.username}
            </span>
            <button className="btn btn-danger" style={{ padding: '4px 8px', borderRadius: '8px' }} onClick={() => { logout(); navigate('/login'); }} title="Sign Out">
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
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

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
      alert('Error saving settings');
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
          
          {user?.role === 'PATIENT' && <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: '20px' }}>Save Changes</button>}
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
        navigate('/dashboard');
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
      .catch(console.error);
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
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            style={{
              background: 'var(--bg2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All System Roles</option>
            <option value="PATIENT">Patients Only</option>
            <option value="DOCTOR">Doctors</option>
            <option value="ADMIN">Admins</option>
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
          <Route path="/command-centre" element={<ProtectedRoute roleRequired={['DOCTOR', 'ADMIN']}><CommandCentre /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/settings/alarms" element={<ProtectedRoute roleRequired="ADMIN"><AlarmSettings /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute roleRequired="ADMIN"><AuditDashboard /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
