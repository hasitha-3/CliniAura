import React, { useEffect, useState } from 'react';
import { Shield, FileText, CheckCircle, AlertTriangle, Search, Filter } from 'lucide-react';

const AuditDashboard = () => {
  const [records, setRecords] = useState([]);
  const [verifyResult, setVerifyResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search and Filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;

    fetch(`${API_URL}/api/audit/report`, {
      headers: { 'Authorization': `Bearer ${token || ''}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to retrieve secure medicolegal blocks');
        return res.json();
      })
      .then(data => {
        setRecords(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleVerify = async () => {
    try {
      const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;
      
      const res = await fetch(`${API_URL}/api/audit/verify`, {
        headers: { 'Authorization': `Bearer ${token || ''}` }
      });
      const data = await res.json();
      setVerifyResult(data);
    } catch (err) {
      setVerifyResult({ valid: false, reason: 'Network failure verifying distributed ledger block chains.' });
    }
  };

  const handleDownloadPDF = () => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    // Passing token via query string or directly triggering secure tab
    window.open(`${API_URL}/api/audit/generate-pdf`, '_blank');
  };

  // Derive unique event types for simple dropdown selection
  const eventTypes = ['ALL', ...new Set(records.map(r => r.eventType))];

  // Filter records
  const filteredRecords = records.filter(r => {
    const matchesSearch = !searchTerm || 
      (r.patientId && r.patientId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.userId && r.userId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.currentHash && r.currentHash.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesEvent = eventTypeFilter === 'ALL' || r.eventType === eventTypeFilter;
    
    return matchesSearch && matchesEvent;
  });

  return (
    <div className="dashboard-container" style={{ padding: '24px 40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Title & Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield className="text-gradient" size={28} /> Medicolegal Cryptographic Ledger
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: '4px 0 0 0' }}>
            Unbroken SHA-256 state tracking for full medicolegal accountability and compliance verification.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleVerify}
            style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <CheckCircle size={15} /> Verify Distributed Hash Chain
          </button>
          <button 
            className="btn btn-primary" 
            style={{ background: '#0284c7', padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }} 
            onClick={handleDownloadPDF}
          >
            <FileText size={15} /> Generate PDF Certificate
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-banner" style={{ margin: 0 }}>
          <AlertTriangle size={20} />
          <div><strong>Audit Transport Error:</strong> {error}</div>
        </div>
      )}

      {/* Verification Feedback Badge */}
      {verifyResult && (
        <div style={{ 
          padding: '16px 20px', 
          borderRadius: '12px', 
          background: verifyResult.valid ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 77, 106, 0.08)', 
          border: `1px solid ${verifyResult.valid ? '#22c55e' : '#ff4d6a'}`,
          animation: 'fade-up 0.3s ease'
        }}>
          {verifyResult.valid ? (
            <div style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.95rem' }}>
              <CheckCircle size={20} style={{ flexShrink: 0 }} /> 
              <div>
                <strong>Cryptographic Chain Integrity Verified:</strong> Unbroken historical lineage. Absolute state proof mathematically confirmed across <strong>{verifyResult.count}</strong> chronological blocks.
              </div>
            </div>
          ) : (
            <div style={{ color: '#ff4d6a', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.95rem' }}>
              <AlertTriangle size={20} style={{ flexShrink: 0 }} /> 
              <div>
                <strong>Tamper / Desynchronization Discovered!</strong> Block link validation broken at block hash index timestamp {verifyResult.tamperedAt ? new Date(verifyResult.tamperedAt).toLocaleString() : 'UNKNOWN'} ({verifyResult.reason}).
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={13} /> Event Pipeline:
          </span>
          <select
            value={eventTypeFilter}
            onChange={e => setEventTypeFilter(e.target.value)}
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
            {eventTypes.map(type => (
              <option key={type} value={type}>
                {type === 'ALL' ? 'All Event Traces' : type}
              </option>
            ))}
          </select>
        </div>

        <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Filter Patient, Actor ID, or Hash..."
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

      {/* Main Ledger Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Retrieving Merkle Root blocks...
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: '600' }}>Block Creation Epoch</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: '600' }}>Event Subclass</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: '600' }}>Target Anchor ID</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: '600' }}>Executing Principal</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: '600' }}>Block Hash (Truncated)</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, index) => {
                const isAlarm = record.eventType.includes('ALARM');
                const isSystem = record.eventType.includes('SYSTEM') || record.eventType.includes('REGISTER');
                const typeColor = isAlarm ? '#ff4d6a' : isSystem ? 'var(--teal)' : '#38bdf8';
                const typeBg = isAlarm ? 'rgba(255,77,106,0.1)' : isSystem ? 'rgba(0,212,170,0.1)' : 'rgba(56,189,248,0.1)';

                return (
                  <tr 
                    key={record._id || index} 
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(0,212,170,0.02)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 18px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                      {new Date(record.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        background: typeBg, 
                        color: typeColor, 
                        fontWeight: 'bold', 
                        fontSize: '0.75rem',
                        display: 'inline-block' 
                      }}>
                        {record.eventType}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: '500', color: 'var(--text)' }}>
                      {record.patientId || <span style={{color:'var(--text-muted)'}}>GLOBAL_SCOPE</span>}
                    </td>
                    <td style={{ padding: '14px 18px', color: record.userId ? 'var(--text)' : 'var(--text-muted)' }}>
                      {record.userId || 'SYSTEM_CORE'}
                    </td>
                    <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: 'var(--text-muted)' }} title={record.currentHash}>
                      <span style={{background:'var(--bg2)', padding:'2px 6px', borderRadius:'4px', border:'1px solid var(--border)'}}>
                        {record.currentHash ? `${record.currentHash.substring(0, 20)}...` : 'HASH_PENDING'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No verifiable blocks pass the selected audit parameter queries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
};

export default AuditDashboard;
