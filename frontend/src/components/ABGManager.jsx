import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, Activity, Download, Loader2, Eye } from 'lucide-react';

const MINI_ABG_API = 'http://100.88.162.102:8000';
const MINI_API_KEY = 'xB3z9Bw2u8qkD5sT_1GvLw0aR6YhN4pOeZcF7mX';

const ABGManager = ({ patientId, patientName }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [pdfViewData, setPdfViewData] = useState(null);

  const API_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
  const token = JSON.parse(localStorage.getItem('cliniaura_user'))?.token;

  useEffect(() => {
    if (patientId) fetchHistory();
  }, [patientId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/abg/history?patient_id=${patientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch ABG history', err);
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
    if (!file) { setError('Please select a PDF file first.'); return; }
    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('patient_id', patientId);
    try {
      const res = await fetch(`${API_URL}/api/abg/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout for MedGemma on Mini
    try {
      const fields = uploadResult.extracted_fields || {};
      const payload = {
        patient_id: patientId,
        ph: fields.ph ?? 7.4,
        pao2_mmhg: fields.pao2_mmhg ?? 90,
        paco2_mmhg: fields.paco2_mmhg ?? 40,
        hco3: fields.hco3 ?? 24,
        base_excess: fields.base_excess ?? 0,
        lactate: fields.lactate ?? 1.0,
        fio2: fields.fio2 ?? 0.21,
        na: fields.na ?? 140,
        cl: fields.cl ?? 102,
        chronic_copd: fields.chronic_copd ?? false,
      };
      const res = await fetch(`${API_URL}/api/abg/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setAnalysisResult(data);
      fetchHistory();
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('MedGemma inference timed out (5 min). The Mac Mini may be under heavy load — please try again.');
      } else {
        setError(err.message);
      }
    } finally {
      clearTimeout(timeout);
      setIsAnalyzing(false);
    }
  };

  const getAlertColor = (level) => {
    if (!level) return 'var(--teal)';
    const l = level.toLowerCase();
    if (l === 'critical' || l === 'high') return '#ff4d6a';
    if (l === 'normal') return '#22c55e';
    return 'var(--teal)';
  };

  // ── Print / Download helpers ───────────────────────────────────────────────
  const printLabResults = (data) => {
    const fields = data?.extracted_fields || data || uploadResult?.extracted_fields || {};
    const pt = data?.patient_id || patientId;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>ABG Lab Results - ${patientName}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 30px; line-height: 1.7; color: #222; }
            h1 { color: #1a3a5c; border-bottom: 2px solid #1a3a5c; padding-bottom: 10px; }
            h2 { color: #2563eb; font-size: 1rem; }
            .section { margin-bottom: 20px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .metric { margin-bottom: 8px; }
            .label { font-weight: bold; color: #334155; display: inline-block; min-width: 140px; }
            .footer { margin-top: 30px; font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          </style>
        </head>
        <body>
          <h1>Arterial Blood Gas (ABG) Lab Results</h1>
          <div class="section">
            <div class="metric"><span class="label">Patient ID:</span> ${pt}</div>
            <div class="metric"><span class="label">Patient Name:</span> ${patientName}</div>
            <div class="metric"><span class="label">Date & Time:</span> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</div>
          </div>
          <div class="section">
            <h2>Raw ABG Values</h2>
            <div class="metric"><span class="label">pH:</span> ${fields.ph ?? 'N/A'}</div>
            <div class="metric"><span class="label">PaO2:</span> ${fields.pao2_mmhg ?? 'N/A'} mmHg</div>
            <div class="metric"><span class="label">PaCO2:</span> ${fields.paco2_mmhg ?? 'N/A'} mmHg</div>
            <div class="metric"><span class="label">HCO3:</span> ${fields.hco3 ?? 'N/A'} mEq/L</div>
            <div class="metric"><span class="label">Lactate:</span> ${fields.lactate ?? 'N/A'} mmol/L</div>
            <div class="metric"><span class="label">Base Excess:</span> ${fields.base_excess ?? 'N/A'} mmol/L</div>
            <div class="metric"><span class="label">FiO2:</span> ${fields.fio2 ?? 'N/A'}</div>
            <div class="metric"><span class="label">Na+:</span> ${fields.na ?? 'N/A'} mEq/L</div>
            <div class="metric"><span class="label">Cl-:</span> ${fields.cl ?? 'N/A'} mEq/L</div>
          </div>
          <div class="footer">CliniAura ABG Lab Report — For clinical use only. Always verify with a qualified clinician.</div>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printMedGemmaReport = (reportData) => {
    // Accept data from param (history item) or fall back to current analysisResult
    const d = reportData || analysisResult;
    if (!d) { setError('No analysis data available to download.'); return; }
    const fields = d.extracted_fields || d;
    const alertColor = d.alert_level === 'Critical' ? '#dc2626' : d.alert_level === 'High' ? '#ea580c' : '#16a34a';
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>MedGemma ABG Report - ${patientName}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 30px; line-height: 1.7; color: #222; }
            h1 { color: #1a3a5c; border-bottom: 2px solid #1a3a5c; padding-bottom: 10px; }
            h2 { color: #2563eb; font-size: 1rem; margin-top: 0; }
            .section { margin-bottom: 20px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .alert-box { background: ${alertColor}18; border: 1px solid ${alertColor}; padding: 10px 16px; border-radius: 8px; margin-bottom: 20px; }
            .alert-text { color: ${alertColor}; font-weight: bold; font-size: 1.1rem; }
            .label { font-weight: bold; color: #334155; display: inline-block; min-width: 180px; }
            .footer { margin-top: 30px; font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          </style>
        </head>
        <body>
          <h1>MedGemma ABG Analysis Report</h1>
          <div class="section">
            <div><span class="label">Patient ID:</span> ${d.patient_id || patientId}</div>
            <div><span class="label">Patient Name:</span> ${patientName}</div>
            <div><span class="label">Report Date/Time:</span> ${new Date(d.created_at || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</div>
          </div>
          <div class="alert-box">
            <span class="alert-text">⚠ Alert Level: ${d.alert_level || 'Normal'}</span>
          </div>
          <div class="section">
            <h2>Clinical Summary</h2>
            <p>${d.summary || 'No summary available.'}</p>
          </div>
          <div class="section">
            <h2>AI Insights (MedGemma via Mac Mini)</h2>
            <div><span class="label">Clinical Significance:</span> ${d.clinical_significance || 'N/A'}</div>
            <div><span class="label">Primary Concern:</span> ${d.primary_concern || 'N/A'}</div>
            ${d.contributing_factors ? `<div><span class="label">Contributing Factors:</span> ${Array.isArray(d.contributing_factors) ? d.contributing_factors.join(', ') : d.contributing_factors}</div>` : ''}
            ${d.llm_confidence != null ? `<div><span class="label">AI Confidence:</span> ${(d.llm_confidence * 100).toFixed(0)}%</div>` : ''}
          </div>
          <div class="section">
            <h2>ABG Values</h2>
            <div><span class="label">pH:</span> ${fields.ph ?? d.ph ?? 'N/A'}</div>
            <div><span class="label">PaO2:</span> ${fields.pao2_mmhg ?? d.pao2_mmhg ?? 'N/A'} mmHg</div>
            <div><span class="label">PaCO2:</span> ${fields.paco2_mmhg ?? d.paco2_mmhg ?? 'N/A'} mmHg</div>
            <div><span class="label">HCO3:</span> ${fields.hco3 ?? d.hco3 ?? 'N/A'} mEq/L</div>
            <div><span class="label">Lactate:</span> ${fields.lactate ?? d.lactate ?? 'N/A'} mmol/L</div>
            <div><span class="label">Base Excess:</span> ${fields.base_excess ?? d.base_excess ?? 'N/A'} mmol/L</div>
            <div><span class="label">FiO2:</span> ${fields.fio2 ?? d.fio2 ?? 'N/A'}</div>
            <div><span class="label">Na+:</span> ${fields.na ?? d.na ?? 'N/A'} mEq/L</div>
            <div><span class="label">Cl-:</span> ${fields.cl ?? d.cl ?? 'N/A'} mEq/L</div>
          </div>
          ${d.rule_based_only ? '<p style="color:#92400e; font-size:0.85rem;">⚠ Note: MedGemma inference unavailable — results are rule-based only.</p>' : ''}
          <div class="footer">
            CliniAura MedGemma ABG Report — AI-assisted clinical decision support only. Not a substitute for professional clinical judgment.
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
        <h3 style={{ margin: 0, fontSize: '1rem' }}>ABG Analyzer (MedGemma via Mac Mini)</h3>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px' }} />
          {error}
        </div>
      )}

      {/* Upload Section */}
      {!analysisResult && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="file"
            accept="application/pdf,application/json,.json"
            onChange={handleFileChange}
            style={{ fontSize: '0.8rem', color: 'var(--text)', background: 'var(--bg)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', flex: 1 }}
          />
          <button
            onClick={handleUpload}
            disabled={isUploading || !file}
            style={{ padding: '8px 12px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: '6px', cursor: (isUploading || !file) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', opacity: (isUploading || !file) ? 0.6 : 1 }}
          >
            {isUploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
            Upload
          </button>
        </div>
      )}

      {/* Parsed Data + Analyze Button */}
      {uploadResult && !analysisResult && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--cyan)' }}>
            <CheckCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Lab Data Parsed
          </h4>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            {[
              ['pH', uploadResult.extracted_fields?.ph],
              ['PaO2', uploadResult.extracted_fields?.pao2_mmhg, 'mmHg'],
              ['PaCO2', uploadResult.extracted_fields?.paco2_mmhg, 'mmHg'],
              ['HCO3', uploadResult.extracted_fields?.hco3, 'mEq/L'],
              ['Lactate', uploadResult.extracted_fields?.lactate, 'mmol/L'],
              ['Base Excess', uploadResult.extracted_fields?.base_excess, 'mmol/L'],
              ['FiO2', uploadResult.extracted_fields?.fio2],
              ['Na+', uploadResult.extracted_fields?.na, 'mEq/L'],
              ['Cl-', uploadResult.extracted_fields?.cl, 'mEq/L'],
            ].map(([label, val, unit]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.04)', padding: '6px', borderRadius: '4px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{label}</span><br />
                <strong style={{ color: 'var(--text)' }}>{val ?? 'N/A'}{unit ? ` ${unit}` : ''}</strong>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              style={{ flex: 1, padding: '8px 12px', background: 'rgba(56, 189, 248, 0.2)', color: 'var(--cyan)', border: '1px solid var(--cyan)', borderRadius: '6px', cursor: isAnalyzing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              {isAnalyzing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Activity size={14} />}
              {isAnalyzing ? 'Running MedGemma (up to 30s)...' : 'Run MedGemma Analysis'}
            </button>
            <button
              onClick={() => printLabResults(uploadResult)}
              style={{ padding: '8px 12px', background: '#38bdf8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            >
              <Download size={14} /> Download Lab
            </button>
          </div>
        </div>
      )}

      {/* Analysis Result */}
      {analysisResult && (
        <div style={{ marginTop: '16px', animation: 'fade-up 0.3s ease' }}>
          <div style={{ padding: '12px', background: 'rgba(0, 212, 170, 0.1)', border: `1px solid ${getAlertColor(analysisResult.alert_level)}`, borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, color: 'var(--teal)', fontSize: '0.95rem' }}>Analysis Complete</h4>
              <span style={{ background: getAlertColor(analysisResult.alert_level) + '22', color: getAlertColor(analysisResult.alert_level), padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: `1px solid ${getAlertColor(analysisResult.alert_level)}` }}>
                {analysisResult.alert_level || 'Normal'}
              </span>
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', lineHeight: '1.4' }}>
              <strong>Summary:</strong> {analysisResult.summary || 'N/A'}
            </p>
            {analysisResult.clinical_significance && analysisResult.clinical_significance !== 'N/A' && (
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', lineHeight: '1.4', color: 'var(--cyan)' }}>
                <strong>Clinical Significance:</strong> {analysisResult.clinical_significance}
              </p>
            )}
            {analysisResult.primary_concern && analysisResult.primary_concern !== 'N/A' && (
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', lineHeight: '1.4', color: '#fbbf24' }}>
                <strong>Primary Concern:</strong> {analysisResult.primary_concern}
              </p>
            )}
            {analysisResult.rule_based_only && (
              <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '6px', borderRadius: '4px' }}>
                ⚠ MedGemma inference unavailable — results are rule-based only.
              </p>
            )}

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setPdfViewData({ ...analysisResult, extracted_fields: uploadResult?.extracted_fields })}
                style={{ flex: 1, padding: '6px', background: 'var(--bg2)', border: '1px solid var(--teal)', color: 'var(--teal)', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <Eye size={12} /> View Report PDF
              </button>
              <button
                onClick={() => printLabResults({ extracted_fields: uploadResult?.extracted_fields, patient_id: patientId })}
                style={{ flex: 1, padding: '6px', background: '#38bdf8', border: 'none', color: '#fff', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <Download size={12} /> Download Lab
              </button>
              <button
                onClick={() => printMedGemmaReport(analysisResult)}
                style={{ flex: 1, padding: '6px', background: 'var(--teal)', border: 'none', color: '#fff', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <Download size={12} /> Download Report
              </button>
              <button
                onClick={() => { setAnalysisResult(null); setUploadResult(null); setFile(null); }}
                style={{ width: '100%', marginTop: '8px', padding: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Close / Back to History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && !analysisResult && !uploadResult && (
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <h4 style={{ fontSize: '0.85rem', margin: '0 0 8px 0', color: 'var(--text-muted)' }}>Past ABG History</h4>
          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.filter(item => item.summary && !item.summary.includes('Failed') && !item.summary.includes('aborted')).map((item, idx) => (
              <div key={item.abg_id || item.created_at || idx} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontWeight: 'bold' }}>{new Date(item.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</div>
                    <div style={{ color: 'var(--text)', marginTop: '2px' }}>{item.summary}</div>
                  </div>
                  <span style={{ marginLeft: '8px', background: getAlertColor(item.alert_level) + '22', color: getAlertColor(item.alert_level), padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    {item.alert_level || 'Normal'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setUploadResult({ extracted_fields: item }); setAnalysisResult(item); }}
                    style={{ background: 'transparent', color: 'var(--teal)', border: '1px solid var(--teal)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Eye size={10} /> View
                  </button>
                  <button
                    onClick={() => setPdfViewData(item)}
                    style={{ background: 'var(--bg2)', color: 'var(--cyan)', border: '1px solid var(--cyan)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={10} /> View PDF
                  </button>
                  <button
                    onClick={() => printLabResults(item)}
                    style={{ background: '#38bdf8', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Download size={10} /> Download Lab
                  </button>
                  <button
                    onClick={() => printMedGemmaReport(item)}
                    style={{ background: 'var(--teal)', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Download size={10} /> Download Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF View Modal */}
      {pdfViewData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(5, 10, 16, 0.95)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '100%', maxWidth: '820px', height: '90vh', background: '#fff', borderRadius: '10px', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '16px 20px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1rem' }}>ABG Analysis Report — {patientName}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => printMedGemmaReport(pdfViewData)} style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Download size={12} /> Download
                </button>
                <button onClick={() => setPdfViewData(null)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
              </div>
            </div>
            <div style={{ padding: '40px', overflowY: 'auto', flex: 1, color: '#1e293b', fontFamily: 'Arial, sans-serif', lineHeight: '1.7' }}>
              <h1 style={{ borderBottom: '2px solid #1e293b', paddingBottom: '12px', marginTop: 0, color: '#1a3a5c' }}>MedGemma ABG Analysis Report</h1>
              <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div><strong>Patient ID:</strong> {pdfViewData.patient_id || patientId}</div>
                <div><strong>Patient Name:</strong> {patientName}</div>
                <div><strong>Report Date/Time:</strong> {new Date(pdfViewData.created_at || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</div>
              </div>

              <div style={{ background: (getAlertColor(pdfViewData.alert_level) + '18'), border: `1px solid ${getAlertColor(pdfViewData.alert_level)}`, padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
                <strong style={{ color: getAlertColor(pdfViewData.alert_level), fontSize: '1.1rem' }}>⚠ Alert Level: {pdfViewData.alert_level || 'Normal'}</strong>
              </div>

              <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h2 style={{ color: '#2563eb', fontSize: '1rem', marginTop: 0 }}>ABG Values</h2>
                {[
                  ['pH', pdfViewData.ph],
                  ['PaO2', pdfViewData.pao2_mmhg, 'mmHg'],
                  ['PaCO2', pdfViewData.paco2_mmhg, 'mmHg'],
                  ['HCO3', pdfViewData.hco3, 'mEq/L'],
                  ['Lactate', pdfViewData.lactate, 'mmol/L'],
                  ['Base Excess', pdfViewData.base_excess, 'mmol/L'],
                ].map(([label, val, unit]) => (
                  <div key={label} style={{ marginBottom: '6px' }}><strong style={{ minWidth: '150px', display: 'inline-block' }}>{label}:</strong> {val ?? 'N/A'}{unit ? ` ${unit}` : ''}</div>
                ))}
              </div>

              <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h2 style={{ color: '#2563eb', fontSize: '1rem', marginTop: 0 }}>Clinical Summary</h2>
                <p style={{ margin: 0 }}>{pdfViewData.summary || 'N/A'}</p>
              </div>

              <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h2 style={{ color: '#2563eb', fontSize: '1rem', marginTop: 0 }}>AI Insights (MedGemma via Mac Mini)</h2>
                <div style={{ marginBottom: '8px' }}><strong>Clinical Significance:</strong> {pdfViewData.clinical_significance || 'N/A'}</div>
                <div style={{ marginBottom: '8px' }}><strong>Primary Concern:</strong> {pdfViewData.primary_concern || 'N/A'}</div>
                {pdfViewData.contributing_factors && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Contributing Factors:</strong> {Array.isArray(pdfViewData.contributing_factors) ? pdfViewData.contributing_factors.join(', ') : pdfViewData.contributing_factors}
                  </div>
                )}
                {pdfViewData.llm_confidence != null && (
                  <div><strong>AI Confidence:</strong> {(pdfViewData.llm_confidence * 100).toFixed(0)}%</div>
                )}
              </div>

              {pdfViewData.rule_based_only && (
                <p style={{ color: '#92400e', fontSize: '0.85rem', background: '#fef3c7', padding: '8px', borderRadius: '6px', border: '1px solid #fbbf24' }}>
                  ⚠ Note: MedGemma inference was unavailable at time of analysis. Results shown are rule-based only.
                </p>
              )}

              <p style={{ marginTop: '30px', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                CliniAura MedGemma ABG Report — AI-assisted clinical decision support only. Not a substitute for professional clinical judgment.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ABGManager;
