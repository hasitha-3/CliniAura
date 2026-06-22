import React, { useState } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

const EHRManager = ({ patientId, patientName, patientAge, patientGender }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', msg: string }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus({ type: 'error', msg: 'Please select a PDF file first.' });
      return;
    }
    
    if (file.type !== 'application/pdf') {
      setStatus({ type: 'error', msg: 'Only PDF files are supported.' });
      return;
    }

    setUploading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('patient_id', patientId);
    if (patientAge) formData.append('age', patientAge);
    if (patientGender) formData.append('gender', patientGender);
    if (patientName) formData.append('name', patientName);

    const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
    const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token || '';
    const apiKey = localStorage.getItem('medgemma_api_key') || '';

    try {
      const res = await fetch(`${API_URL}/api/ehr/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Key': apiKey
        },
        body: formData
      });

      const data = await res.json();
      
      if (res.ok) {
        setStatus({ type: 'success', msg: data.message });
        setFile(null);
        // Reset file input
        document.getElementById('ehr-upload-input').value = '';
      } else {
        setStatus({ type: 'error', msg: data.error || 'Upload failed' });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: 'Network error uploading EHR' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = () => {
    const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
    window.open(`${API_URL}/api/ehr/download/${patientId}`, '_blank');
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', marginTop: '20px', background: 'rgba(0, 194, 224, 0.03)' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', marginBottom: '16px' }}>
        <FileText size={20} color="var(--cyan)" />
        Electronic Health Record (EHR)
      </h3>
      
      {status && (
        <div style={{ 
          padding: '10px 14px', 
          borderRadius: '8px', 
          marginBottom: '16px',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: status.type === 'success' ? 'rgba(0,212,170,0.1)' : 'rgba(255,77,106,0.1)',
          color: status.type === 'success' ? 'var(--teal)' : '#ff4d6a',
          border: `1px solid ${status.type === 'success' ? 'var(--teal)' : '#ff4d6a'}`
        }}>
          {status.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {status.msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Upload New EHR (PDF)
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              id="ehr-upload-input"
              type="file" 
              accept=".pdf" 
              onChange={handleFileChange}
              style={{
                flex: 1,
                padding: '8px',
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontSize: '0.85rem'
              }}
            />
            <button 
              className="btn btn-secondary" 
              onClick={handleUpload}
              disabled={uploading || !file}
              style={{ padding: '8px 16px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: '8px', cursor: (uploading || !file) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
            >
              {uploading ? 'Uploading...' : <><Upload size={16} /> Upload AI</>}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            Uploading an EHR will automatically index the text into the MedGemma Agent RAG Vector Database.
          </p>
        </div>

        <div style={{ width: '1px', background: 'var(--border)', margin: '0 10px' }}></div>

        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', alignItems: 'flex-start' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Retrieve Existing Record
          </label>
          <button 
            className="btn btn-primary" 
            onClick={handleDownload}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}
          >
            <Download size={16} /> Download EHR PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default EHRManager;
