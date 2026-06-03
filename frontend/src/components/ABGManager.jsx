import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, Activity, Download, Loader2 } from 'lucide-react';

const ABGManager = ({ patientId, patientName }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  
  const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/abg/history?patient_id=${patientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch ABG history", err);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setUploadResult(null);
      setAnalysisResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }
    
    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch(`${API_URL}/api/abg/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      setUploadResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadResult) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Send extracted fields to analyze
      const payload = {
        patient_id: patientId,
        ph: uploadResult.extracted_fields?.ph || 7.4,
        pao2_mmhg: uploadResult.extracted_fields?.pao2_mmhg || 90,
        paco2_mmhg: uploadResult.extracted_fields?.paco2_mmhg || 40,
        hco3: uploadResult.extracted_fields?.hco3 || 24,
        base_excess: uploadResult.extracted_fields?.base_excess || 0,
        lactate: uploadResult.extracted_fields?.lactate || 1.0,
      };
      
      const res = await fetch(`${API_URL}/api/abg/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      
      setAnalysisResult(data);
      fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>ABG Analysis Report - ${patientName}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .section { margin-bottom: 20px; }
            .alert { color: #d9534f; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>MedGemma ABG Analysis Report</h1>
          <div class="section">
            <strong>Patient ID:</strong> ${patientId}<br>
            <strong>Patient Name:</strong> ${patientName}<br>
            <strong>Date:</strong> ${new Date().toLocaleString()}
          </div>
          <div class="section">
            <h2>Summary</h2>
            <p>${analysisResult?.summary || ''}</p>
            <p class="alert">Alert Level: ${analysisResult?.alert_level || 'Normal'}</p>
          </div>
          <div class="section">
            <h2>AI Insights (MedGemma)</h2>
            <p><strong>Clinical Significance:</strong> ${analysisResult?.clinical_significance || 'N/A'}</p>
            <p><strong>Primary Concern:</strong> ${analysisResult?.primary_concern || 'N/A'}</p>
          </div>
          <div class="section">
            <small>${analysisResult?.disclaimer || ''}</small>
          </div>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div style={{ background: 'var(--surface2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--teal)' }}>
        <Activity size={18} />
        <h3 style={{ margin: 0, fontSize: '1rem' }}>ABG Analyzer (MedGemma)</h3>
      </div>
      
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px' }} />
          {error}
        </div>
      )}
      
      {!analysisResult && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input 
            type="file" 
            accept="application/pdf"
            onChange={handleFileChange}
            style={{ fontSize: '0.8rem', color: 'var(--text)', background: 'var(--bg)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', flex: 1 }}
          />
          <button 
            onClick={handleUpload}
            disabled={isUploading || !file}
            style={{ padding: '8px 12px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: '6px', cursor: (isUploading || !file) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
          >
            {isUploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
            Upload
          </button>
        </div>
      )}

      {uploadResult && !analysisResult && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--cyan)' }}>PDF Parsed Successfully</h4>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>pH: {uploadResult.extracted_fields?.ph || 'N/A'}</div>
            <div>PaO2: {uploadResult.extracted_fields?.pao2_mmhg || 'N/A'} mmHg</div>
            <div>PaCO2: {uploadResult.extracted_fields?.paco2_mmhg || 'N/A'} mmHg</div>
            <div>HCO3: {uploadResult.extracted_fields?.hco3 || 'N/A'} mEq/L</div>
          </div>
          <button 
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            style={{ padding: '8px 12px', width: '100%', background: 'rgba(56, 189, 248, 0.2)', color: 'var(--cyan)', border: '1px solid var(--cyan)', borderRadius: '6px', cursor: isAnalyzing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            {isAnalyzing ? <Loader2 size={14} className="spin" /> : <Activity size={14} />}
            Run MedGemma Analysis
          </button>
        </div>
      )}

      {analysisResult && (
        <div style={{ marginTop: '16px', animation: 'fade-up 0.3s ease' }}>
          <div style={{ padding: '12px', background: 'rgba(0, 212, 170, 0.1)', border: '1px solid var(--teal)', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--teal)', fontSize: '0.95rem' }}>Analysis Complete</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', lineHeight: '1.4' }}>
              <strong>Summary:</strong> {analysisResult.summary}
            </p>
            {analysisResult.clinical_significance && (
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', lineHeight: '1.4', color: 'var(--cyan)' }}>
                <strong>AI Insight:</strong> {analysisResult.clinical_significance}
              </p>
            )}
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={printReport}
                style={{ flex: 1, padding: '6px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <Download size={12} /> Download Report
              </button>
              <button 
                onClick={() => { setAnalysisResult(null); setUploadResult(null); setFile(null); }}
                style={{ flex: 1, padding: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}
      
      {history.length > 0 && !analysisResult && !uploadResult && (
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <h4 style={{ fontSize: '0.85rem', margin: '0 0 8px 0', color: 'var(--text-muted)' }}>Past ABG History</h4>
          <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {history.map(item => (
              <div key={item.abg_id} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: 'var(--text-dim)', marginBottom: '2px' }}>{new Date(item.created_at).toLocaleString()}</div>
                <div style={{ color: 'var(--text)' }}>{item.summary}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ABGManager;
