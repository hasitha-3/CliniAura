import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../App';
import { AlertTriangle, Clock, Activity, FileText, User, CheckCircle, Bell, MessageSquare, Clipboard, Sliders, Search, Shield, CornerDownRight } from 'lucide-react';

const AlertHistory = () => {
  const { user } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

  const fetchHistory = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token || '';
      const res = await fetch(`${API_URL}/api/clinical-history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) throw new Error('Failed to fetch clinical event history from main server');
      
      const data = await res.json();
      setEvents(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  // Filter events based on search term and category selection
  const filteredEvents = events.filter(e => {
    // 1. Search term match
    const searchString = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      (e.patientName && e.patientName.toLowerCase().includes(searchString)) ||
      (e.patientId && e.patientId.toLowerCase().includes(searchString)) ||
      (e.actor && e.actor.toLowerCase().includes(searchString)) ||
      (e.type && e.type.toLowerCase().includes(searchString)) ||
      (e.details && JSON.stringify(e.details).toLowerCase().includes(searchString));

    // 2. Category selection match
    let matchesCategory = true;
    if (activeCategory === 'ALERTS') {
      matchesCategory = e.type === 'ALERT' || e.type === 'ABG_ALERT';
    } else if (activeCategory === 'INTERVENTIONS') {
      matchesCategory = e.type === 'INTERVENTION';
    } else if (activeCategory === 'NURSE_CALLS') {
      matchesCategory = ['NURSE_CALL', 'NURSE_NOTE', 'DOCTOR_NOTE', 'NURSE_CALL_UPDATE'].includes(e.type);
    } else if (activeCategory === 'ACKNOWLEDGEMENTS') {
      matchesCategory = e.type === 'ACKNOWLEDGEMENT';
    }

    return matchesSearch && matchesCategory;
  });

  const getEventBadgeStyle = (type) => {
    switch (type) {
      case 'ALERT':
        return { bg: 'rgba(239, 68, 68, 0.1)', text: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' };
      case 'ABG_ALERT':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' };
      case 'INTERVENTION':
        return { bg: 'rgba(56, 189, 248, 0.1)', text: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)' };
      case 'NURSE_CALL':
        return { bg: 'rgba(251, 146, 60, 0.1)', text: '#fb923c', border: '1px solid rgba(251, 146, 60, 0.2)' };
      case 'NURSE_CALL_UPDATE':
        return { bg: 'rgba(251, 146, 60, 0.05)', text: '#f97316', border: '1px solid rgba(251, 146, 60, 0.1)' };
      case 'NURSE_NOTE':
      case 'DOCTOR_NOTE':
        return { bg: 'rgba(16, 185, 129, 0.1)', text: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' };
      case 'ACKNOWLEDGEMENT':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.2)' };
    }
  };

  const getEventName = (type) => {
    switch (type) {
      case 'ALERT': return 'Vitals Alert';
      case 'ABG_ALERT': return 'ABG Alert';
      case 'INTERVENTION': return 'Intervention';
      case 'NURSE_CALL': return 'Patient Call';
      case 'NURSE_CALL_UPDATE': return 'Call Updated';
      case 'NURSE_NOTE': return 'Nurse Note';
      case 'DOCTOR_NOTE': return 'Doctor Note';
      case 'ACKNOWLEDGEMENT': return 'Acknowledgement';
      default: return type;
    }
  };

  const renderEventDetails = (event) => {
    const details = event.details || {};
    switch (event.type) {
      case 'ALERT':
        return (
          <div>
            <div style={{ fontWeight: '600', color: 'var(--text)' }}>{details.message}</div>
            {details.vitals && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                <span>HR: <strong>{details.vitals.heartRate || '--'}</strong> bpm</span> |
                <span>SpO2: <strong>{details.vitals.spO2 || '--'}</strong>%</span> |
                <span>BP: <strong>{details.vitals.bloodPressureSys || '--'}/{details.vitals.bloodPressureDia || '--'}</strong> mmHg</span> |
                <span>RR: <strong>{details.vitals.respirationRate || '--'}</strong> rpm</span>
              </div>
            )}
          </div>
        );
      case 'ABG_ALERT':
        return (
          <div>
            <div style={{ fontWeight: '600', color: '#f87171' }}>{details.primary_concern || 'Critical ABG Alert'}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>{details.summary || details.message}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span>pH: <strong style={{color:'var(--text)'}}>{details.ph}</strong></span> |
              <span>PaO2: <strong style={{color:'var(--text)'}}>{details.pao2_mmhg}</strong> mmHg</span> |
              <span>PaCO2: <strong style={{color:'var(--text)'}}>{details.paco2_mmhg}</strong> mmHg</span> |
              <span>HCO3: <strong style={{color:'var(--text)'}}>{details.hco3}</strong> mEq/L</span> |
              <span>Lactate: <strong style={{color:'#ff4d6a'}}>{details.lactate}</strong> mmol/L</span>
            </div>
          </div>
        );
      case 'INTERVENTION':
        return (
          <div>
            <div>
              Logged Intervention: <strong style={{ color: 'var(--cyan)' }}>{details.action}</strong>
            </div>
            {details.notes && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                <CornerDownRight size={12} /> {details.notes}
              </div>
            )}
          </div>
        );
      case 'NURSE_CALL':
        return (
          <div>
            <div>Requested assistance: <span style={{ color: '#fb923c', fontWeight: '500' }}>"{details.message}"</span></div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Call ID: {details.callId}</div>
          </div>
        );
      case 'NURSE_CALL_UPDATE':
        return (
          <div>
            Assistance call <strong style={{ color: details.newStatus === 'Resolved' ? 'var(--teal)' : 'orange' }}>{details.newStatus}</strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Call ID: {details.callId}</div>
          </div>
        );
      case 'NURSE_NOTE':
      case 'DOCTOR_NOTE':
        return (
          <div style={{ fontStyle: 'italic', color: 'var(--text-dim)' }}>
            "{details.text}"
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'normal', marginTop: '2px' }}>Added to Patient Call {details.callId} ({details.callStatus})</div>
          </div>
        );
      case 'ACKNOWLEDGEMENT':
        return (
          <div>
            Acknowledged Alert: <span style={{ color: 'var(--text-muted)' }}>"{details.originalMessage}"</span>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Original Alert ID: {details.originalAlertId}</div>
          </div>
        );
      default:
        if (details && typeof details === 'object' && details.message) {
          return <div>{details.message}</div>;
        }
        return <div>{typeof details === 'string' ? details : JSON.stringify(details)}</div>;
    }
  };

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading Unified Event History...</div>;
  }

  const categories = [
    { id: 'ALL', label: 'All Events' },
    { id: 'ALERTS', label: 'Alarms / Alerts' },
    { id: 'INTERVENTIONS', label: 'Interventions' },
    { id: 'NURSE_CALLS', label: 'Nurse Assistance' },
    { id: 'ACKNOWLEDGEMENTS', label: 'Acknowledgements' }
  ];

  return (
    <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>
            <Clipboard className="text-gradient" size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> 
            Unified Clinical History
          </h2>
          <p style={{ color: 'var(--text-dim)', margin: '4px 0 0 0' }}>
            Central record of clinical alerts, nurse assistance calls, staff interventions, and response logs.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert-banner">
          <AlertTriangle size={20} />
          <div><strong>Connection Error:</strong> {error}. Could not pull the unified clinical events log.</div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        {/* Categories Tab Selector */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg2)', padding: '4px', borderRadius: '100px', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '100px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: activeCategory === cat.id ? '600' : '500',
                background: activeCategory === cat.id ? 'var(--teal)' : 'transparent',
                color: activeCategory === cat.id ? 'var(--bg)' : 'var(--text-dim)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search Patient, ID, Actor, or Notes..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
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

      {/* Main Events Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}><Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Time</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}><User size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Patient</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Event Category</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Executing Actor</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Clinical Details / Notes</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}><Shield size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Acknowledge Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((event) => {
              const badgeStyle = getEventBadgeStyle(event.type);
              
              // Format actor role context
              const actorRoleText = event.actorRole ? `(${event.actorRole})` : '';

              return (
                <tr key={event.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,212,170,0.01)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  {/* Timestamp */}
                  <td style={{ padding: '14px 18px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                    {new Date(event.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                  
                  {/* Patient Info */}
                  <td style={{ padding: '14px 18px', fontWeight: '500' }}>
                    <div>{event.patientName || 'Unknown Patient'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{event.patientId}</div>
                  </td>
                  
                  {/* Category Badge */}
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '100px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      background: badgeStyle.bg,
                      color: badgeStyle.text,
                      border: badgeStyle.border,
                      display: 'inline-block'
                    }}>
                      {getEventName(event.type)}
                    </span>
                  </td>
                  
                  {/* Actor Executing */}
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-dim)' }}>{event.actor}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{actorRoleText}</div>
                  </td>
                  
                  {/* Details */}
                  <td style={{ padding: '14px 18px', color: 'var(--text)', maxWidth: '400px', lineHeight: '1.4' }}>
                    {renderEventDetails(event)}
                  </td>
                  
                  {/* Acknowledge Status Column */}
                  <td style={{ padding: '14px 18px' }}>
                    {['ALERT', 'ABG_ALERT'].includes(event.type) ? (
                      event.acknowledged ? (
                        <div style={{ color: 'var(--teal)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={14} /> Acknowledged
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            by {event.acknowledgedBy} at {new Date(event.acknowledgedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </span>
                        </div>
                      ) : (
                        <div style={{ color: '#ff4d6a', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={14} /> Active / Unacknowledged
                        </div>
                      )
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>N/A</span>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {filteredEvents.length === 0 && (
              <tr>
                <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No historical clinical events match the active filters or query parameters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlertHistory;
