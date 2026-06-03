import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../App';
import { AlertTriangle, Clock, Activity, FileText } from 'lucide-react';

const AlertHistory = () => {
  const { user } = useContext(AuthContext);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const apiKey = localStorage.getItem('medgemma_api_key') || '';
        const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token || '';
        
        // Fetch from MedGemma Agent
        const res = await fetch('http://localhost:8000/api/v1/alerts?limit=50', {
          headers: {
            'X-API-Key': apiKey,
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!res.ok) throw new Error('Failed to fetch alerts from MedGemma Agent');
        
        const data = await res.json();
        setAlerts(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading Alert History...</div>;
  }

  return (
    <div className="dashboard-container" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2><AlertTriangle className="text-gradient" size={24} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Past Alert History</h2>
          <p style={{ color: 'var(--text-dim)', margin: '4px 0 0 0' }}>Historical record of AI-generated alerts and escalations from the MedGemma Agent.</p>
        </div>
      </div>

      {error && (
        <div className="alert-banner">
          <AlertTriangle size={20} />
          <div><strong>Connection Error:</strong> {error}. Ensure MedGemma API Key is set in Settings.</div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}><Clock size={14} style={{ verticalAlign: 'middle' }} /> Time</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Patient ID</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Risk Level</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Sepsis Risk</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.alert_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '14px 18px', color: 'var(--text-dim)' }}>
                  {new Date(alert.created_at).toLocaleString()}
                </td>
                <td style={{ padding: '14px 18px', fontWeight: '500' }}>
                  {alert.patient_id}
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <span className={`badge-risk risk-${alert.alert_level}`}>{alert.alert_level}</span>
                </td>
                <td style={{ padding: '14px 18px', color: alert.sepsis_risk_flag ? '#ff4d6a' : 'var(--teal)' }}>
                  {alert.sepsis_risk_flag ? 'FLAGGED' : 'LOW'} (qSOFA: {alert.qsofa_score})
                </td>
                <td style={{ padding: '14px 18px', color: 'var(--text-dim)' }}>
                  {alert.recommended_action || '--'}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && !error && (
              <tr>
                <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No historical alerts found.
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
