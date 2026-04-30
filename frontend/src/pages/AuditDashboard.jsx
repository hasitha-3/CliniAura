import React, { useEffect, useState } from 'react';
import { Shield, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

const AuditDashboard = () => {
  const [records, setRecords] = useState([]);
  const [verifyResult, setVerifyResult] = useState(null);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    fetch(`${API_URL}/api/audit/report`)
      .then(res => res.json())
      .then(data => setRecords(data));
  }, []);

  const handleVerify = async () => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const res = await fetch(`${API_URL}/api/audit/verify`);
    const data = await res.json();
    setVerifyResult(data);
  };

  const handleDownloadPDF = () => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    window.open(`${API_URL}/api/audit/generate-pdf`, '_blank');
  };

  return (
    <div className="dashboard-container" style={{ padding: '20px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2><Shield className="text-gradient" style={{ display: 'inline', marginRight: '10px' }} /> Medicolegal Audit Ledger</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={handleVerify}>Verify Hash Chain</button>
          <button className="btn btn-primary" style={{ background: '#0284c7' }} onClick={handleDownloadPDF}>
            <FileText size={16} style={{ display: 'inline', marginRight: '5px' }} /> Generate PDF Report
          </button>
        </div>
      </div>

      {verifyResult && (
        <div style={{ padding: '15px', borderRadius: '8px', marginBottom: '20px', background: verifyResult.valid ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${verifyResult.valid ? '#22c55e' : '#ef4444'}` }}>
          {verifyResult.valid ? (
            <div style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle /> <strong>Integrity Verified</strong>: The hash chain is completely unbroken. Cryptographic proof confirmed for {verifyResult.count} records.
            </div>
          ) : (
            <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle /> <strong>Tamper Detected!</strong> Ledger integrity compromised at {new Date(verifyResult.tamperedAt).toLocaleString()} ({verifyResult.reason}).
            </div>
          )}
        </div>
      )}

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid #334155' }}>
              <th style={{ padding: '12px 16px' }}>Timestamp</th>
              <th style={{ padding: '12px 16px' }}>Event Type</th>
              <th style={{ padding: '12px 16px' }}>Patient / Subject</th>
              <th style={{ padding: '12px 16px' }}>Actor (User ID)</th>
              <th style={{ padding: '12px 16px' }}>Hash Signature</th>
            </tr>
          </thead>
          <tbody>
            {records.map(record => (
              <tr key={record._id} style={{ borderBottom: '1px solid #334155' }}>
                <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{new Date(record.timestamp).toLocaleString()}</td>
                <td style={{ padding: '12px 16px', fontWeight: 'bold', color: record.eventType.includes('ALARM') ? '#ef4444' : '#38bdf8' }}>{record.eventType}</td>
                <td style={{ padding: '12px 16px' }}>{record.patientId || 'N/A'}</td>
                <td style={{ padding: '12px 16px' }}>{record.userId || 'SYSTEM'}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748b' }}>{record.currentHash.substring(0, 16)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No audit records found. Navigate the portal to generate some events.</div>}
      </div>
    </div>
  );
};

export default AuditDashboard;
