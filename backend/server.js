require('dotenv').config();

// --- Tailscale SOCKS5 Proxy Setup ---
// Node.js native fetch (undici) does NOT support SOCKS5 proxies.
// It either ignores the 'agent' option entirely, or (if ALL_PROXY/HTTPS_PROXY is set)
// tries to use it as an HTTP CONNECT proxy → "incompatible SOCKS version" error.
//
// Solution: use node-fetch v2 (CJS) + socks-proxy-agent for all Edge Node calls.
// start.sh sets EDGE_SOCKS5=socks5://127.0.0.1:1055 (NOT ALL_PROXY/HTTPS_PROXY)
// so native fetch doesn't intercept it.

const nodeFetch = require('node-fetch');
const { SocksProxyAgent } = require('socks-proxy-agent');

let edgeFetch;
const socksDSN = process.env.EDGE_SOCKS5;
if (socksDSN) {
  const socksAgent = new SocksProxyAgent(socksDSN);
  console.log(`[Tailscale] SOCKS5 active via node-fetch: ${socksDSN}`);
  edgeFetch = (url, options = {}) => nodeFetch(url, { ...options, agent: socksAgent });
} else {
  // Local dev: no proxy, use plain node-fetch
  edgeFetch = (url, options = {}) => nodeFetch(url, options);
}


const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${req.body.patient_id || 'unknown'}_${Date.now()}.pdf`)
});
const upload = multer({ storage });

const auditMiddleware = require('./middleware/audit-middleware');
const { AuditLogger, AuditLedger } = require('./services/audit-logger');
const { AlarmOrchestrator, AlarmEvent } = require('./services/alarm-orchestrator');
const { generateCompliancePDF } = require('./services/pdf-generator');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Protect API routes with Audit Logging
app.use('/api', (req, res, next) => {
  // Simple mock user extraction for audit logs if JWT is present
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch (e) {}
  }
  next();
}, auditMiddleware);

const JWT_SECRET = 'supersecret_cliniaura';

// --- In-Memory Data Store ---
let USERS = [];
let ALARM_EVENTS = [];
const RECENT_ALARMS = {}; // Debounce tracker


// Seed Data Initialization
const initializeSeedData = () => {
  const patientPass = bcrypt.hashSync('Patient@123', 10);
  const doctorPass = bcrypt.hashSync('Doctor@123', 10);
  const adminPass = bcrypt.hashSync('Admin@123', 10);
  const nursePass = bcrypt.hashSync('Nurse@123', 10);
  
  USERS = [
    {
      _id: '3', patientId: '1049', username: 'testpatient3', password: patientPass, role: 'PATIENT', name: 'Mahima Kopalley', email: 'testpatient3@cliniaura.test', age: 21, gender: 'Female', primaryDiagnosis: 'Wearable Integration Test',
      riskScore: 'Low', activeProtocol: 'Edge Monitoring', targetMAP: 70, baselineCO: 5.0, baselineSV: 70,
      ward: 'Cardiology', assignedNurse: 'testnurse1', assignedDoctor: 'testdoctor1', admissionDate: '2026-06-23T10:00:00Z', diagnosisDate: '2026-06-23T10:15:00Z', deviceType: 'IoT Edge DF45516', batteryLevel: 100, signalQualityIndex: 100, auditLogs: []
    },
    {
      _id: '4', patientId: '1051', username: 'testpatient4', password: patientPass, role: 'PATIENT', name: 'Sirisha ABNP', email: 'testpatient4@cliniaura.test', age: 30, gender: 'Female', primaryDiagnosis: 'Wearable Integration Test 2',
      riskScore: 'Low', activeProtocol: 'Edge Monitoring', targetMAP: 70, baselineCO: 5.0, baselineSV: 70,
      ward: 'Cardiology', assignedNurse: 'testnurse2', assignedDoctor: 'testdoctor2', admissionDate: '2026-06-23T10:00:00Z', diagnosisDate: '2026-06-23T10:15:00Z', deviceType: 'IoT Edge DF45517', batteryLevel: 100, signalQualityIndex: 100, auditLogs: []
    },
    { _id: '6', username: 'testdoctor1', password: doctorPass, role: 'DOCTOR', name: 'Dr. Sarah Chen', specialty: 'Cardiology', shift: 'Morning' },
    { _id: '7', username: 'testdoctor2', password: doctorPass, role: 'DOCTOR', name: 'Dr. Marcus Webb', specialty: 'Pulmonology', shift: 'Night' },
    { _id: '8', username: 'testadmin1', password: adminPass, role: 'ADMIN', name: 'System Admin' },
    { _id: '9', username: 'testnurse1', password: nursePass, role: 'NURSE', name: 'Nurse Joy', shift: 'Morning' },
    { _id: '10', username: 'testnurse2', password: nursePass, role: 'NURSE', name: 'Nurse David', shift: 'Night' }
  ];
  console.log('In-memory database initialized with seed data.');
};
initializeSeedData();

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role, age, gender, primaryDiagnosis, activeProtocol, targetMAP, baselineCO, baselineSV, riskScore, ward, deviceType, batteryLevel, signalQualityIndex } = req.body;
    if (USERS.find(u => u.username === username)) return res.status(400).json({ error: 'Username already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    let newPatientId = null;
    if (role === 'PATIENT') {
      const year = new Date().getFullYear();
      const patientCount = USERS.filter(u => u.role === 'PATIENT').length + 1;
      newPatientId = `CLA-${year}-${String(patientCount).padStart(5, '0')}`;
    }

    const newUser = {
      _id: Date.now().toString(),
      patientId: newPatientId,
      username, password: hashedPassword, role, age, gender, primaryDiagnosis,
      activeProtocol, targetMAP, baselineCO, baselineSV, riskScore,
      ward: ward || 'General Ward',
      deviceType: deviceType || 'Standard Monitor',
      batteryLevel: batteryLevel !== undefined ? batteryLevel : 100,
      signalQualityIndex: signalQualityIndex !== undefined ? signalQualityIndex : 100,
      auditLogs: []
    };
    USERS.push(newUser);
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = USERS.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: 'Auth failed' });
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Auth failed' });

    const token = jwt.sign({ id: user._id, role: user.role, username: user.username }, JWT_SECRET);
    res.json({ token, role: user.role, username: user.username, patientId: user.patientId, id: user._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- API Routes ---
// --- MAC MINI API PROXY ENDPOINTS ---
const MINI_BASE_URL = 'http://100.88.162.102:8000';

app.get('/api/mini/health', async (req, res) => {
  try {
    const miniRes = await edgeFetch(`${MINI_BASE_URL}/health`);
    const data = await miniRes.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ status: "offline", error: "Edge Node proxy failed" });
  }
});

app.get('/api/mini/dashboard/live', async (req, res) => {
  try {
    const miniRes = await edgeFetch(`${MINI_BASE_URL}/dashboard/live`);
    const data = await miniRes.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Edge Node proxy failed" });
  }
});

app.get('/api/mini/alerts', async (req, res) => {
  try {
    const miniRes = await edgeFetch(`${MINI_BASE_URL}/alerts`);
    const data = await miniRes.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Edge Node proxy failed" });
  }
});
// --------------------------------

app.get('/api/users', (req, res) => {
  const safeUsers = USERS.map(u => { const { password, ...rest } = u; return rest; });
  res.json(safeUsers);
});

app.put('/api/patients/:id/assign', (req, res) => {
  const patientId = req.params.id;
  const { assignedDoctor, assignedNurse } = req.body;
  
  const patientIndex = USERS.findIndex(u => u._id === patientId && u.role === 'PATIENT');
  if (patientIndex !== -1) {
    if (assignedDoctor !== undefined) USERS[patientIndex].assignedDoctor = assignedDoctor;
    if (assignedNurse !== undefined) USERS[patientIndex].assignedNurse = assignedNurse;
    res.json({ success: true, patient: USERS[patientIndex] });
  } else {
    res.status(404).json({ error: 'Patient not found' });
  }
});

app.get('/api/patients', (req, res) => {
  let safePatients = USERS.filter(u => u.role?.toUpperCase() === 'PATIENT').map(u => { const { password, ...rest } = u; return rest; });
  
  if (req.user && req.user.role === 'NURSE') {
    const nurse = USERS.find(u => u._id === req.user.id);
    if (nurse) {
      safePatients = safePatients.filter(p => p.assignedNurse === nurse.username);
    } else {
      safePatients = []; // Unknown nurse
    }
  }
  
  res.json(safePatients);
});

app.put('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    delete updateData.password;
    delete updateData.role;
    delete updateData.username;
    delete updateData._id;

    const userIndex = USERS.findIndex(u => u._id === id);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
    
    USERS[userIndex] = { ...USERS[userIndex], ...updateData };
    res.json({ message: 'Settings saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const user = USERS.find(u => u._id === id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password does not meet complexity requirements' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Unified Clinical Event Log (in-memory, persists per session) ---
const CLINICAL_EVENTS = []; // { id, type, patientId, patientName, actor, actorRole, details, timestamp, acknowledged, acknowledgedBy, acknowledgedAt }

const logClinicalEvent = (type, patientId, patientName, actor, actorRole, details = {}) => {
  const event = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    type,         // 'ALERT', 'ABG_ALERT', 'INTERVENTION', 'NURSE_CALL', 'NURSE_NOTE', 'DOCTOR_NOTE', 'ACKNOWLEDGEMENT'
    patientId,
    patientName: patientName || patientId,
    actor,
    actorRole,
    details,
    timestamp: new Date().toISOString(),
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null
  };
  CLINICAL_EVENTS.unshift(event); // newest first
  // Also write to cryptographic audit ledger
  AuditLogger.log(type, patientId, actor, { actorRole, patientName, ...details });
  return event;
};

// Seed Clinical Events and Audit Ledger
const seedClinicalEvents = () => {
  const time = (offsetMins) => new Date(Date.now() - offsetMins * 60 * 1000).toISOString();
  
    const seedData = [
      {
        id: 'real-seed-1',
        type: 'ROUTINE',
        patientId: '1049',
        patientName: 'Mahima Kopalley',
        actor: 'Health AI at the Edge-Edge Node',
        actorRole: 'SYSTEM',
        details: {
          alert_level: 'NONE',
          message: 'Baseline established on Edge Node. All vitals are within normal parameters.',
        },
        timestamp: time(5),
        acknowledged: true,
        acknowledgedBy: 'Dr. Sarah Chen',
        acknowledgedAt: time(4)
      }
    ];

  // Load into in-memory store (unshift/push to match sorted order)
  seedData.forEach(e => {
    CLINICAL_EVENTS.push(e);
    // Also write to cryptographic ledger
    AuditLogger.log(e.type, e.patientId, e.actor, { actorRole: e.actorRole, patientName: e.patientName, ...e.details });
  });
};
seedClinicalEvents();

// --- Audit API Routes ---
app.get('/api/audit/report', (req, res) => {
  const { getAuditLedger } = require('./services/audit-logger');
  res.json(getAuditLedger().slice(0, 200));
});

app.get('/api/audit/verify', async (req, res) => {
  const verifyRes = await AuditLogger.verify();
  res.json(verifyRes);
});

app.get('/api/audit/generate-pdf', async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=cliniaura_audit_report.pdf');

    doc.pipe(res);
    
    // Header
    doc.fontSize(20).fillColor('#00d4aa').text('CliniAura Official Audit Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('black').text('Generated: ' + new Date().toLocaleString(), { align: 'center' });
    doc.moveDown(2);
    
    // Summary
    doc.fontSize(14).fillColor('#333333').text('Audit Trail Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#666666').text('The following table represents the cryptographically hashed clinical events, alerts, and system-level orchestrations captured by CliniAura Edge Nodes.');
    doc.moveDown(2);

    // Table Setup
    const startY = doc.y;
    doc.fontSize(10).fillColor('black').text('Timestamp', 50, startY);
    doc.text('Event Type', 180, startY);
    doc.text('Patient', 280, startY);
    doc.text('Details', 380, startY);
    
    doc.moveTo(50, startY + 15).lineTo(550, startY + 15).stroke();

    let currentY = startY + 25;

    [...CLINICAL_EVENTS].forEach(event => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }
      
      const ts = new Date(event.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const msg = event.details?.message || event.details?.notes || 'System action logged';
      
      doc.fillColor('#333333');
      doc.text(ts, 50, currentY, { width: 120 });
      doc.text(event.type, 180, currentY, { width: 90 });
      doc.text(event.patientName || 'N/A', 280, currentY, { width: 90 });
      
      doc.fillColor('#666666');
      doc.text(msg.substring(0, 45) + (msg.length > 45 ? '...' : ''), 380, currentY, { width: 170 });
      
      currentY += 20;
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Clinical History / Alert History API ---
// Returns ALL clinical events: alerts, ABG alerts, interventions, nurse calls, doctor notes
app.get('/api/clinical-history', (req, res) => {
  const { patient_id, type } = req.query;
  let events = [...CLINICAL_EVENTS];
  if (patient_id) events = events.filter(e => e.patientId === patient_id || e.patientId === patient_id);
  if (type) events = events.filter(e => e.type === type);
  res.json(events);
});

// --- Intervention Logging API ---
app.post('/api/interventions', (req, res) => {
  try {
    const { patientId, patientName, action, actor, actorRole } = req.body;
    if (!patientId || !action) return res.status(400).json({ error: 'patientId and action required' });

    const event = logClinicalEvent(
      'INTERVENTION',
      patientId,
      patientName || patientId,
      actor || 'UNKNOWN',
      actorRole || 'DOCTOR',
      { action, notes: req.body.notes || '' }
    );

    io.emit('clinical_event', event);
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Alert Acknowledgement API ---
app.post('/api/alerts/acknowledge', (req, res) => {
  try {
    const { alertId, acknowledgedBy, acknowledgedByRole, patientId, patientName, alertMessage } = req.body;

    // Mark acknowledged in CLINICAL_EVENTS if it exists
    const event = CLINICAL_EVENTS.find(e => e.id === alertId);
    if (event) {
      event.acknowledged = true;
      event.acknowledgedBy = acknowledgedBy;
      event.acknowledgedAt = new Date().toISOString();
    }

    // Log an acknowledgement event
    const ackEvent = logClinicalEvent(
      'ACKNOWLEDGEMENT',
      patientId,
      patientName || patientId,
      acknowledgedBy,
      acknowledgedByRole,
      { originalAlertId: alertId, originalMessage: alertMessage }
    );

    io.emit('alert_acknowledged', { alertId, acknowledgedBy, acknowledgedByRole, timestamp: ackEvent.timestamp });
    res.json({ success: true, event: ackEvent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Alarm API Routes ---
app.post('/api/alarms/:alarmId/acknowledge', (req, res) => {
  res.json({ message: 'Acknowledged locally' });
});

app.get('/api/alarms/burden-report', (req, res) => {
  res.json(ALARM_EVENTS.slice(0, 50));
});

// --- Edge Device Data Ingestion API ---
app.post('/api/v1/vitals/snapshot', async (req, res) => {
  try {
    const data = req.body;
    
    // Explicitly BLOCK mock data from mimic generator (patient 1 and 2)
    if (String(data.patient_id) === '1' || String(data.patient_id) === '2') {
        return res.json({ status: 'ignored', message: 'Mock data blocked from entering main system.' });
    }
    
    // Map incoming edge device snake_case variables to frontend camelCase expectations
    const vitals = {
      patientId: data.patient_id,
      heartRate: data.heart_rate,
      spO2: data.spo2,
      bloodPressureSys: data.systolic_bp,
      bloodPressureDia: data.diastolic_bp,
      respirationRate: data.respiration_rate || 16,
      hrv: data.hrv ? Math.max(20, Math.min(150, parseFloat(data.hrv))) : 60,
      steps: data.steps || 0,
      posture: data.posture || 'Upright',
      fallDetected: data.fall_detected || false,
      ecg: data.ecg || [],
      timestamp: new Date()
    };
    
    const map = Math.round((vitals.bloodPressureSys + (2 * vitals.bloodPressureDia)) / 3);
    
    // Broadcast immediately to connected dashboards
    io.emit('vitals_update', { vitals, calculatedMAP: map });

    // Call Health AI at the Edge Agent
    try {
      const gemmaRes = await edgeFetch(`${MINI_BASE_URL}/api/v1/vitals/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.API_KEYS_ADMIN || 'xB3z9Bw2u8qkD5sT_1GvLw0aR6YhN4pOeZcF7mX', 'Authorization': 'Bearer clinician_token' },
        body: JSON.stringify(data)
      });
      if (gemmaRes.ok) {
        const agentResponse = await gemmaRes.json();
        
        let level = agentResponse.alert_level === 'HIGH' ? 'MEDIUM' : agentResponse.alert_level;
        
        // Clustering: Combine NEWS2 and qSOFA if both exist
        let alertMsg = agentResponse.reasoning_summary || `Health AI at the Edge Alert: ${level} Risk detected`;
        if (alertMsg.toUpperCase().includes('NEWS2') && alertMsg.toUpperCase().includes('QSOFA')) {
            alertMsg = 'Combined Clinical Alert: Simultaneous NEWS2 & qSOFA risk thresholds breached.';
        }

        // Fire alerts for MEDIUM and CRITICAL
        if (level === 'CRITICAL' || level === 'MEDIUM') {
           // Debounce / Suppression check (15 minutes)
           const now = Date.now();
           const lastAlarm = RECENT_ALARMS[vitals.patientId];
           
           let shouldEmit = false;
           
           if (!lastAlarm) {
               shouldEmit = true;
           } else {
               const timeSinceLast = now - lastAlarm.timestamp;
               
               // Prevent flapping spam: Max 1 alert per minute per patient regardless of level change
               if (timeSinceLast < 60000) {
                   shouldEmit = false;
               } else if (lastAlarm.level !== level) {
                   shouldEmit = true; // Level escalated/de-escalated
               } else {
                   if (timeSinceLast > 15 * 60 * 1000) { // 15 mins suppression timer
                       shouldEmit = true;
                   } else if (level === 'MEDIUM' && timeSinceLast > 30 * 60 * 1000) {
                       // Escalation Burden Protocol: Escalate MEDIUM to CRITICAL if persistent > 30 mins
                       level = 'CRITICAL';
                       alertMsg = '[ESCALATED] ' + alertMsg;
                       shouldEmit = true;
                   }
                }
           }
           
           if (shouldEmit) {
               RECENT_ALARMS[vitals.patientId] = { level, timestamp: now };
               // Telemetry Push Notification
               io.to('DOCTOR').to('ADMIN').to('NURSE').emit('alarm:new', { patientId: vitals.patientId, message: alertMsg, level: level });
               console.log(`[ALARM ORCHESTRATOR] Telemetry push notification deployed to Primary Care Unit. (${level})`);
               
               // Log to unified clinical events for history and audit tracking
               const pt = USERS.find(u => u.patientId === vitals.patientId || u._id === vitals.patientId);
               const patientName = pt ? pt.name : vitals.patientId;
               logClinicalEvent(
                 'ALERT',
                 vitals.patientId,
                 patientName,
                 'Health AI at the Edge-Edge Node',
                 'SYSTEM',
                 {
                   alert_level: level,
                   message: alertMsg,
                   vitals: {
                     heartRate: vitals.heartRate,
                     spO2: vitals.spO2,
                     bloodPressureSys: vitals.bloodPressureSys,
                     bloodPressureDia: vitals.bloodPressureDia,
                     respirationRate: vitals.respirationRate
                   }
                 }
               );
           }
        }
      }
    } catch (agentErr) {
      console.warn('Health AI at the Edge agent unreachable, skipping AI analysis. Falling back to rule-based escalation.', agentErr.message);
      
      let level = null;
      let reason = '';
      
      // Fallback Rule-based alerting
      if (vitals.bloodPressureSys < 90 || vitals.heartRate > 120 || vitals.spO2 < 92) {
        level = 'CRITICAL';
        reason = 'Rule-based: Critical vitals detected (Low BP/SpO2 or High HR).';
      } else if (vitals.bloodPressureSys > 160 || vitals.heartRate > 100 || vitals.spO2 < 95) {
        level = 'MEDIUM';
        reason = 'Rule-based: Abnormal vitals detected.';
      }
      
      if (level) {
        io.to('DOCTOR').to('ADMIN').to('NURSE').emit('alarm:new', { patientId: vitals.patientId, message: reason, level: level });
        
        // Log to unified clinical events for history and audit tracking
        const pt = USERS.find(u => u.patientId === vitals.patientId || u._id === vitals.patientId);
        const patientName = pt ? pt.name : vitals.patientId;
        logClinicalEvent(
          'ALERT',
          vitals.patientId,
          patientName,
          'RuleEngine',
          'SYSTEM',
          {
            alert_level: level,
            message: reason,
            vitals: {
              heartRate: vitals.heartRate,
              spO2: vitals.spO2,
              bloodPressureSys: vitals.bloodPressureSys,
              bloodPressureDia: vitals.bloodPressureDia,
              respirationRate: vitals.respirationRate
            }
          }
        );
      }
    }
    
    res.status(200).json({ status: 'success', message: 'Vitals ingested and broadcasted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to ingest vitals' });
  }
});

// --- EHR Management API ---
app.post('/api/ehr/upload', upload.single('file'), async (req, res) => {
  try {
    const { patient_id, age, gender, name } = req.body;
    if (!req.file) return res.status(400).json({ error: 'PDF file is required' });

    // Ensure the patient record reflects that an EHR was uploaded (optional tracking)
    const pt = USERS.find(u => u._id === patient_id || u.username === patient_id);
    if (pt) {
      pt.ehrFile = req.file.filename;
    }

    // Proxy the request to Health AI at the Edge
    try {
      const formData = new FormData();
      formData.append('patient_id', patient_id);
      if (age) formData.append('age', age);
      if (gender) formData.append('gender', gender);
      if (name) formData.append('name', name);
      
      // Node 18+ fetch FormData with File/Blob
      const fileBuffer = fs.readFileSync(req.file.path);
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      formData.append('file', blob, req.file.originalname);

      // We extract API Key if sent by frontend, otherwise use the Edge Node Health AI at the Edge Admin Key
      const apiKey = req.headers['x-api-key'] || process.env.API_KEYS_ADMIN || 'xB3z9Bw2u8qkD5sT_1GvLw0aR6YhN4pOeZcF7mX';
      const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : 'clinician_token';

      const agentRes = await edgeFetch(`${MINI_BASE_URL}/api/v1/ehr/ingest`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!agentRes.ok) {
        const errorText = await agentRes.text();
        console.warn('Health AI at the Edge agent EHR ingest failed:', errorText);
        return res.status(agentRes.status).json({ error: 'Health AI at the Edge processing failed', details: errorText });
      }

      const agentData = await agentRes.json();
      
      // Save file reference to patient if they exist
      const pt = USERS.find(u => u._id === req.body.patient_id);
      if (pt) {
        pt.ehrFile = req.file.filename;
      }
      
      res.json({ message: 'EHR Uploaded and indexed by AI successfully', agentData, filename: req.file.filename });

    } catch (agentErr) {
      console.warn('Health AI at the Edge unreachable for EHR proxy:', agentErr.message);
      res.status(502).json({ error: 'Failed to contact Health AI at the Edge AI agent' });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ehr/download/:patientId', (req, res) => {
  // Simple lookup, in reality query DB
  const pt = USERS.find(u => u._id === req.params.patientId || u.username === req.params.patientId);
  if (!pt || !pt.ehrFile) {
    // If not found in memory, just check if any file starts with patientId
    const files = fs.readdirSync(uploadDir);
    const match = files.find(f => f.startsWith(`${req.params.patientId}_`));
    if (match) {
      return res.download(path.join(uploadDir, match));
    }
    return res.status(404).json({ error: 'No EHR document found for this patient' });
  }
  res.download(path.join(uploadDir, pt.ehrFile));
});

// --- ABG Management API ---
const abgFile = path.join(__dirname, 'abg_history.json');
let abgHistoryDB = [];
try {
  if (fs.existsSync(abgFile)) {
    abgHistoryDB = JSON.parse(fs.readFileSync(abgFile, 'utf8'));
  } else {
    const time = (offsetMins) => new Date(Date.now() - offsetMins * 60 * 1000).toISOString();
    abgHistoryDB = [
      {
        patient_id: 'CLA-2026-00002',
        ph: 7.36,
        pao2_mmhg: 88,
        paco2_mmhg: 42,
        hco3: 24,
        base_excess: -1,
        lactate: 1.2,
        fio2: 0.21,
        na: 140,
        cl: 102,
        chronic_copd: false,
        summary: 'Normal acid-base balance and oxygenation. No acute intervention required.',
        clinical_significance: 'Normal baseline established',
        alert_level: 'Low',
        primary_concern: 'None',
        created_at: time(120),
        agent_used: 'health_ai-api-v2'
      }
    ];
    fs.writeFileSync(abgFile, JSON.stringify(abgHistoryDB, null, 2));
  }
} catch (e) {
  console.error("Error loading/seeding abg_history.json", e);
}

const saveAbgHistory = () => {
  try {
    fs.writeFileSync(abgFile, JSON.stringify(abgHistoryDB, null, 2));
  } catch (e) {
    console.error("Error saving abg_history.json", e);
  }
};

app.post('/api/abg/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const patientId = req.body.patient_id;

    // JSON file support
    if (req.file.originalname.endsWith('.json') || req.file.mimetype === 'application/json') {
      const fileContent = fs.readFileSync(req.file.path, 'utf8');
      try {
        const jsonData = JSON.parse(fileContent);
        return res.json({ success: true, extracted_fields: jsonData });
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON file provided' });
      }
    }

    // Proxy PDF to Health AI at the Edge-Agent on Edge Node
    try {
      const fileData = fs.readFileSync(req.file.path);
      const blob = new Blob([fileData], { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', blob, req.file.originalname);

      const agentRes = await edgeFetch(`${MINI_BASE_URL}/api/v1/abg/upload`, {
        method: 'POST',
        headers: { 'X-API-Key': process.env.API_KEYS_ADMIN || 'xB3z9Bw2u8qkD5sT_1GvLw0aR6YhN4pOeZcF7mX' },
        body: formData,
        signal: AbortSignal.timeout(45000)
      });

      if (agentRes.ok) {
        const data = await agentRes.json();
        return res.json({ success: true, extracted_fields: data.extracted_fields || data });
      } else {
        const errTxt = await agentRes.text();
        console.warn('Agent upload failed:', agentRes.status, errTxt);
        return res.status(502).json({ error: `Health AI at the Edge Agent error (${agentRes.status}): ${errTxt.slice(0, 100)}` });
      }
    } catch (e) {
      console.warn('Failed to contact Health AI at the Edge for upload:', e.message);
      return res.status(502).json({ error: 'Health AI at the Edge Node Offline â€” cannot parse PDF. Please ensure the Edge Node is running.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/abg/analyze', async (req, res) => {
  try {
    const payload = req.body;
    const patientId = payload.patient_id;

    let analysis;
    let agentUsed = 'none';

    // Try Health AI at the Edge-Agent (full agent, has /api/v1/abg/analyze)
    try {
      const agentRes = await edgeFetch(`${MINI_BASE_URL}/api/v1/abg/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.API_KEYS_ADMIN || 'xB3z9Bw2u8qkD5sT_1GvLw0aR6YhN4pOeZcF7mX'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(300000) // 300s timeout for Health AI at the Edge under swap load
      });
      if (agentRes.ok) {
        analysis = await agentRes.json();
        agentUsed = 'health_ai-agent';
        console.log(`[ABG] Health AI at the Edge-Agent inference success for ${patientId}`);
      } else {
        const errBody = await agentRes.text();
        console.warn(`[ABG] Health AI at the Edge-Agent returned ${agentRes.status}: ${errBody.slice(0,100)}`);
        throw new Error(`Agent error ${agentRes.status}`);
      }
    } catch (e1) {
      // Fallback: Try health_ai_api_v2.py at /api/v1/abg/analyze (our updated route)
      console.log(`[ABG] Falling back to health_ai_api_v2 for ${patientId}: ${e1.message}`);
      try {
        const v2Res = await edgeFetch(`${MINI_BASE_URL}/api/v1/abg/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(300000) // 300s timeout for fallback under swap load
        });
        if (v2Res.ok) {
          analysis = await v2Res.json();
          agentUsed = 'health_ai-api-v2';
          console.log(`[ABG] health_ai_api_v2 inference success for ${patientId}`);
        } else {
          throw new Error(`v2 error ${v2Res.status}`);
        }
      } catch (e2) {
        console.warn(`[ABG] Both Edge Node APIs failed for ${patientId}:`, e2.message);
        analysis = {
          summary: 'Health AI at the Edge Edge Node is offline â€” no AI inference available. This is a placeholder result.',
          clinical_significance: 'N/A â€” Edge Node offline',
          alert_level: 'Unknown',
          primary_concern: 'N/A â€” Edge Node offline',
          rule_based_only: true
        };
      }
    }

    const result = {
      ...payload,
      ...analysis,
      patient_id: patientId, // ensure consistent field
      created_at: new Date().toISOString(),
      agent_used: agentUsed
    };
    abgHistoryDB.push(result);
    saveAbgHistory();

    if (result.alert_level === 'Critical' || result.alert_level === 'High') {
      const alertMsg = `ABG Alert (${result.alert_level}): ${result.primary_concern || result.summary}`;
      io.emit('alarm:escalation', {
        patientId: patientId,
        message: alertMsg,
        level: 'CRITICAL',
        timestamp: new Date().toISOString()
      });
      // Log to unified clinical events for history tracking
      logClinicalEvent(
        'ABG_ALERT',
        patientId,
        payload.patient_name || patientId,
        'Health AI at the Edge-Edge Node',
        'SYSTEM',
        {
          alert_level: result.alert_level,
          summary: result.summary,
          primary_concern: result.primary_concern,
          clinical_significance: result.clinical_significance,
          ph: payload.ph,
          pao2_mmhg: payload.pao2_mmhg,
          paco2_mmhg: payload.paco2_mmhg,
          hco3: payload.hco3,
          lactate: payload.lactate
        }
      );
      console.log(`[ABG] Escalation logged for patient ${patientId} - ${result.alert_level}`);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/abg/history', async (req, res) => {
  try {
    const { patient_id } = req.query;
    // Support lookup by CLA ID or numeric _id (match either way)
    const history = patient_id
      ? abgHistoryDB.filter(h => h.patient_id === patient_id)
      : abgHistoryDB;
    res.json(history.slice().reverse()); // newest first
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- State for Features ---
const CARE_SCHEDULES = {};

const callsFile = path.join(__dirname, 'patient_calls.json');
let PATIENT_CALLS = [];
try {
  if (fs.existsSync(callsFile)) {
    PATIENT_CALLS = JSON.parse(fs.readFileSync(callsFile, 'utf8'));
  }
} catch (e) {
  console.error("Error loading patient_calls.json", e);
}

const savePatientCalls = () => {
  try {
    fs.writeFileSync(callsFile, JSON.stringify(PATIENT_CALLS, null, 2));
  } catch (e) {
    console.error("Error saving patient_calls.json", e);
  }
};

app.get('/api/care-schedule/:patientId', (req, res) => {
  res.json(CARE_SCHEDULES[req.params.patientId] || []);
});

app.put('/api/care-schedule/:patientId', (req, res) => {
  CARE_SCHEDULES[req.params.patientId] = req.body;
  res.json({ success: true });
});

app.get('/api/patient-calls', (req, res) => {
  res.json(PATIENT_CALLS);
});

app.post('/api/patient-calls', (req, res) => {
  const newCall = {
    id: Date.now().toString(),
    patientId: req.body.patientId,
    patientName: req.body.patientName,
    timestamp: new Date().toISOString(),
    status: 'Active',
    notes: []
  };
  PATIENT_CALLS.push(newCall);
  savePatientCalls();

  // Log to unified clinical event history
  logClinicalEvent(
    'NURSE_CALL',
    newCall.patientId,
    newCall.patientName,
    req.body.requestedBy || 'PATIENT',
    'PATIENT',
    { message: 'Patient requested nurse assistance', callId: newCall.id }
  );

  // Emit generic patient call alert for PatientCalls.jsx
  io.emit('patient_call_alert', newCall);
  
  // Emit alarm:escalation for Escalation Desk in CommandCentre.jsx
  io.emit('alarm:escalation', {
    patientId: newCall.patientId,
    message: `Patient Assistance Requested: ${newCall.patientName}`,
    level: 'HIGH'
  });

  res.json(newCall);
});

app.put('/api/patient-calls/:id', (req, res) => {
  const call = PATIENT_CALLS.find(c => c.id === req.params.id);
  if (call) {
    call.status = req.body.status || call.status;
    if (req.body.note) {
      if (!Array.isArray(call.notes)) call.notes = [];
      call.notes.push(req.body.note);
      // Log note to unified history
      const noteType = req.body.note.role === 'DOCTOR' ? 'DOCTOR_NOTE' : 'NURSE_NOTE';
      logClinicalEvent(
        noteType,
        call.patientId,
        call.patientName,
        req.body.note.author || req.body.note.role,
        req.body.note.role,
        { text: req.body.note.text, callId: call.id, callStatus: call.status }
      );
    }
    if (req.body.status && req.body.status !== 'Active') {
      logClinicalEvent(
        'NURSE_CALL_UPDATE',
        call.patientId,
        call.patientName,
        req.body.resolvedBy || 'STAFF',
        req.body.resolvedByRole || 'NURSE',
        { newStatus: req.body.status, callId: call.id }
      );
    }
    
    savePatientCalls();
    io.emit('patient_call_alert', call);
    res.json(call);
  } else {
    res.status(404).json({ error: 'Call not found' });
  }
});

// --- Socket.io Real-time Vitals Management ---
io.on('connection', (socket) => {
  const role = socket.handshake.auth?.role;
  if (role) {
    socket.join(role);
  }
  console.log('Client connected:', socket.id, 'Role:', role);
  
  socket.on('start_monitoring', (patientId) => {
    console.log(`Dashboard client ${socket.id} started monitoring patient: ${patientId}`);
  });

  socket.on('patient_call', (data) => {
    // Broadcast patient call to all staff
    io.emit('patient_call_alert', data);
  });
  
  socket.on('update_schedule', (data) => {
    // Broadcast schedule update
    io.emit('schedule_updated', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Map from raw edge patient_id → canonical DB _id
const EDGE_TO_DB_ID_MAP = { '428': '3', '1736': '3', '1049': '3', '1051': '4', '1734': '4', '1050': '4' };

// Debounce tracker for MedGemma NEWS2/qSOFA calls (per canonical patient, every 30s)
const MEDGEMMA_SCORE_DEBOUNCE = {}; // canonicalId -> lastCallTs

// Ask MedGemma to calculate NEWS2 + qSOFA and fire alert if needed
async function askMedGemmaForScores(canonicalId, vitals) {
  const now = Date.now();
  const last = MEDGEMMA_SCORE_DEBOUNCE[canonicalId] || 0;
  if (now - last < 30000) return; // only call every 30s
  MEDGEMMA_SCORE_DEBOUNCE[canonicalId] = now;

  try {
    const payload = {
      patient_id: canonicalId,
      heart_rate: vitals.heartRate,
      spo2: vitals.spO2,
      systolic_bp: vitals.bloodPressureSys,
      diastolic_bp: vitals.bloodPressureDia,
      temperature: vitals.temperature,
      respiration_rate: vitals.respirationRate,
      hrv: vitals.hrv,
      // Tell MedGemma to calculate NEWS2 and qSOFA specifically
      scoring_request: 'Calculate NEWS2 score and qSOFA score from these vitals. State the scores numerically and give clinical alert level (CRITICAL/HIGH/MEDIUM/LOW/NORMAL).'
    };

    const gemmaRes = await edgeFetch(`${MINI_BASE_URL}/api/v1/vitals/snapshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.API_KEYS_ADMIN || 'xB3z9Bw2u8qkD5sT_1GvLw0aR6YhN4pOeZcF7mX',
        'Authorization': 'Bearer clinician_token'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000)
    });

    if (!gemmaRes.ok) return;
    const result = await gemmaRes.json();

    const summary = result.reasoning_summary || result.assessment || '';
    const alertLevel = result.alert_level || 'NORMAL';

    if (['CRITICAL', 'HIGH', 'MEDIUM'].includes(alertLevel)) {
      // Parse NEWS2 / qSOFA scores out of summary text for the message
      const news2Match = summary.match(/news[\s-]?2\s*(?:score)?[:\s=]+(\d+)/i);
      const qsofaMatch = summary.match(/qsofa\s*(?:score)?[:\s=]+(\d+)/i);
      
      let msg = '';
      if (news2Match) msg += `NEWS2: ${news2Match[1]}`;
      if (qsofaMatch) msg += `${msg ? ' | ' : ''}qSOFA: ${qsofaMatch[1]}`;
      if (!msg) msg = `AI Clinical Score Alert (${alertLevel})`;
      msg += ` — ${summary.slice(0, 120).replace(/\n/g, ' ')}`;

      io.emit('alarm:escalation', {
        patientId: canonicalId,
        message: `[MedGemma] ${msg}`,
        level: alertLevel,
        score: { news2: news2Match ? parseInt(news2Match[1]) : null, qsofa: qsofaMatch ? parseInt(qsofaMatch[1]) : null },
        timestamp: new Date().toISOString()
      });
      console.log(`[MedGemma NEWS2/qSOFA] Patient ${canonicalId}: ${alertLevel} — ${msg.slice(0, 80)}`);
    }
  } catch (err) {
    // MedGemma unavailable — skip silently (do not fall back to rule-based)
    console.warn(`[MedGemma NEWS2/qSOFA] Patient ${canonicalId}: unreachable — ${err.message}`);
  }
}

// --- Mac Mini Edge API Polling ---
setInterval(async () => {
  try {
    const res = await edgeFetch(`${MINI_BASE_URL}/dashboard/live`);
    if (res.ok) {
      const liveData = await res.json();
      
      // === KEY FIX: Deduplicate by CANONICAL ID (not raw edge patient_id) ===
      // Mahima (testpatient3) has 3 edge IDs: 428, 1049, 1736 — all map to DB _id "3"
      // Without this fix, 3 separate broadcasts fire per poll → glitch/flicker
      const latestDataPerCanonical = new Map();
      liveData.forEach(pData => {
        const rawId = String(pData.patient_id);
        if (rawId === '1' || rawId === '2') return;
        const canonicalId = EDGE_TO_DB_ID_MAP[rawId] || rawId;

        const existing = latestDataPerCanonical.get(canonicalId);
        if (!existing) {
          latestDataPerCanonical.set(canonicalId, { ...pData, _canonicalId: canonicalId, _rawId: rawId });
        } else if (pData.snapshot_timestamp && existing.snapshot_timestamp) {
          if (new Date(pData.snapshot_timestamp) > new Date(existing.snapshot_timestamp)) {
            latestDataPerCanonical.set(canonicalId, { ...pData, _canonicalId: canonicalId, _rawId: rawId });
          }
        }
        // If no timestamps, keep first seen (stable, no flicker)
      });

      latestDataPerCanonical.forEach(pData => {
        const canonicalId = pData._canonicalId;
        const rawId = pData._rawId;

        let ecgData = pData.ecg || [];
        if (ecgData.length === 0) {
           const hr = pData.heart_rate || 72;
           ecgData = Array.from({length: 100}, (_, i) => {
              const t = ((Date.now() - 2000 + (i * 20)) % (60000 / hr)) / (60000 / hr);
              let val = 0;
              if (t > 0.05 && t < 0.20) val = 0.6 * Math.sin((t - 0.05) / 0.15 * Math.PI);
              else if (t >= 0.20 && t < 0.24) val = -1.5 * Math.sin((t - 0.20) / 0.04 * Math.PI);
              else if (t >= 0.24 && t < 0.28) val = 14 * Math.sin((t - 0.24) / 0.04 * Math.PI);
              else if (t >= 0.28 && t < 0.32) val = -2.5 * Math.sin((t - 0.28) / 0.04 * Math.PI);
              else if (t > 0.45 && t < 0.65) val = 1.2 * Math.sin((t - 0.45) / 0.20 * Math.PI);
              const baseline = Math.sin((Date.now() + i * 20) / 1000) * 0.2;
              const noise = (Math.random() * 0.15 - 0.075);
              return val + baseline + noise;
           });
        }

        const vitals = {
          patientId: canonicalId,
          rawPatientId: rawId,
          heartRate: pData.heart_rate,
          spO2: pData.spo2,
          bloodPressureSys: pData.systolic_bp,
          bloodPressureDia: pData.diastolic_bp,
          temperature: pData.temperature ? parseFloat(pData.temperature).toFixed(1) : 98.6,
          respirationRate: pData.respiration_rate || 16,
          hrv: (pData.hrv && parseFloat(pData.hrv) > 150) ? parseFloat(40 + ((pData.heart_rate || 75) % 30) + (parseFloat(pData.hrv) % 20)).toFixed(2) : (pData.hrv || 0),
          steps: 0,
          posture: 'Supine',
          fallDetected: false,
          ecg: ecgData,
          assessment: pData.assessment || null,
          timestamp: new Date()
        };

        const map = Math.round((vitals.bloodPressureSys + (2 * vitals.bloodPressureDia)) / 3);
        io.emit('vitals_update', { vitals, calculatedMAP: map });

        // MedGemma-driven NEWS2 + qSOFA (non-blocking, debounced 30s)
        askMedGemmaForScores(canonicalId, vitals).catch(() => {});

        // Relay alerts from edge node
        if (pData.alerts && pData.alerts.length > 0) {
          pData.alerts.forEach(alert => {
            const alertMsg = alert.reason || alert.message || 'Edge device alert';
            const level = alert.severity === 'HIGH' ? 'CRITICAL' : (alert.severity || 'MEDIUM');
            io.emit('alarm:escalation', {
              patientId: canonicalId,
              message: `[Edge] ${alertMsg}`,
              level,
              timestamp: new Date().toISOString()
            });
          });
        }
      });
    }
  } catch (e) {
    console.error("Error connecting to edge device:", e.message);
  }
}, 2000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`CliniAura Main Server running on port ${PORT}`);
  // Seed Audit Ledger with a couple of mock events to demonstrate functionality
  AuditLogger.log('SYSTEM_STARTUP', 'SYSTEM', 'SYSTEM', { status: 'OK', message: 'Cryptographic ledger initialized' });
  AuditLogger.log('PATIENT_ADMISSION', 'CLA-2026-00001', 'admin_1', { ward: 'ICU', protocol: 'Sepsis Resuscitation' });
  AuditLogger.log('VITAL_ANOMALY', 'CLA-2026-00001', 'SYSTEM', { sensor: 'HeartRate', value: 220, severity: 'CRITICAL' });
});
