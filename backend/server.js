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

// Seed Data Initialization
const initializeSeedData = () => {
  const patientPass = bcrypt.hashSync('Patient@123', 10);
  const doctorPass = bcrypt.hashSync('Doctor@123', 10);
  const adminPass = bcrypt.hashSync('Admin@123', 10);
  const nursePass = bcrypt.hashSync('Nurse@123', 10);
  
  USERS = [
    {
      _id: '1', patientId: 'CLA-2026-00001', username: 'testpatient1', password: patientPass, role: 'PATIENT', name: 'Arjun Mehta', email: 'testpatient1@cliniaura.test', age: 45, gender: 'Male', primaryDiagnosis: 'Sepsis',
      riskScore: 'Critical', activeProtocol: 'Sepsis Resuscitation Bundles', targetMAP: 65, baselineCO: 4.5, baselineSV: 60,
      ward: 'ICU', assignedNurse: 'testnurse1', assignedDoctor: 'testdoctor1', admissionDate: '2026-06-01T08:30:00Z', diagnosisDate: '2026-06-02T10:15:00Z', deviceType: 'VitalPatch', batteryLevel: 95, signalQualityIndex: 98, auditLogs: []
    },
    {
      _id: '2', patientId: 'CLA-2026-00002', username: 'testpatient2', password: patientPass, role: 'PATIENT', name: 'Priya Nair', email: 'testpatient2@cliniaura.test', age: 62, gender: 'Female', primaryDiagnosis: 'Post-op Recovery',
      riskScore: 'Low', activeProtocol: 'Standard Observation', targetMAP: 80, baselineCO: 5.5, baselineSV: 75,
      ward: 'General Ward', assignedNurse: 'testnurse1', assignedDoctor: 'testdoctor1', admissionDate: '2026-06-03T14:20:00Z', diagnosisDate: '2026-06-03T15:00:00Z', deviceType: 'Basic Telemetry', batteryLevel: 90, signalQualityIndex: 99, auditLogs: []
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
    res.json({ token, role: user.role, username: user.username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- API Routes ---
// --- NANO API PROXY ENDPOINTS ---
const NANO_BASE_URL = 'http://100.88.162.102:8000';

app.get('/api/nano/health', async (req, res) => {
  try {
    const nanoRes = await fetch(`${NANO_BASE_URL}/health`);
    const data = await nanoRes.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ status: "offline", error: "Nano proxy failed" });
  }
});

app.get('/api/nano/dashboard/live', async (req, res) => {
  try {
    const nanoRes = await fetch(`${NANO_BASE_URL}/dashboard/live`);
    const data = await nanoRes.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Nano proxy failed" });
  }
});

app.get('/api/nano/alerts', async (req, res) => {
  try {
    const nanoRes = await fetch(`${NANO_BASE_URL}/alerts`);
    const data = await nanoRes.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Nano proxy failed" });
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
      id: 'seed-6',
      type: 'ABG_ALERT',
      patientId: 'CLA-2026-00001',
      patientName: 'Arjun Mehta',
      actor: 'MedGemma-Nano',
      actorRole: 'SYSTEM',
      details: {
        alert_level: 'Critical',
        summary: 'Severe metabolic acidosis with high lactate levels, indicating significant tissue hypoperfusion.',
        primary_concern: 'Severe Metabolic Acidosis',
        ph: 7.21,
        pao2_mmhg: 82,
        paco2_mmhg: 31,
        hco3: 12,
        lactate: 4.8
      },
      timestamp: time(40),
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null
    },
    {
      id: 'seed-5',
      type: 'INTERVENTION',
      patientId: 'CLA-2026-00001',
      patientName: 'Arjun Mehta',
      actor: 'testdoctor1',
      actorRole: 'DOCTOR',
      details: { action: 'Fluid Bolus', notes: 'Administered 500mL Normal Saline over 30 mins' },
      timestamp: time(60),
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null
    },
    {
      id: 'seed-4',
      type: 'NURSE_NOTE',
      patientId: 'CLA-2026-00001',
      patientName: 'Arjun Mehta',
      actor: 'testnurse1',
      actorRole: 'NURSE',
      details: { text: 'Responded to patient call. Patient complaining of mild shortness of breath. Adjusted bed position.', callId: '1001', callStatus: 'Active' },
      timestamp: time(85),
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null
    },
    {
      id: 'seed-3',
      type: 'NURSE_CALL',
      patientId: 'CLA-2026-00001',
      patientName: 'Arjun Mehta',
      actor: 'testpatient1',
      actorRole: 'PATIENT',
      details: { message: 'Patient requested nurse assistance', callId: '1001' },
      timestamp: time(90),
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null
    },
    {
      id: 'seed-2',
      type: 'ACKNOWLEDGEMENT',
      patientId: 'CLA-2026-00001',
      patientName: 'Arjun Mehta',
      actor: 'testnurse1',
      actorRole: 'NURSE',
      details: {
        originalAlertId: 'seed-1',
        originalMessage: 'Rule-based: Critical vitals detected (Low BP/SpO2 or High HR).'
      },
      timestamp: time(115),
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null
    },
    {
      id: 'seed-1',
      type: 'ALERT',
      patientId: 'CLA-2026-00001',
      patientName: 'Arjun Mehta',
      actor: 'RuleEngine',
      actorRole: 'SYSTEM',
      details: {
        alert_level: 'CRITICAL',
        message: 'Rule-based: Critical vitals detected (Low BP/SpO2 or High HR).',
        vitals: { heartRate: 124, spO2: 89, bloodPressureSys: 85, bloodPressureDia: 55, respirationRate: 22 }
      },
      timestamp: time(120),
      acknowledged: true,
      acknowledgedBy: 'testnurse1',
      acknowledgedAt: time(115)
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
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=cliniaura_audit_report.pdf');
    res.send(Buffer.from('mock pdf data'));
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
    
    // Map incoming edge device snake_case variables to frontend camelCase expectations
    const vitals = {
      patientId: data.patient_id,
      heartRate: data.heart_rate,
      spO2: data.spo2,
      bloodPressureSys: data.systolic_bp,
      bloodPressureDia: data.diastolic_bp,
      respirationRate: data.respiration_rate || 16,
      steps: data.steps || 0,
      posture: data.posture || 'Upright',
      fallDetected: data.fall_detected || false,
      timestamp: new Date()
    };
    
    const map = Math.round((vitals.bloodPressureSys + (2 * vitals.bloodPressureDia)) / 3);
    
    // Broadcast immediately to connected dashboards
    io.emit('vitals_update', { vitals, calculatedMAP: map });

    // Call MedGemma Agent
    try {
      const gemmaRes = await fetch('http://127.0.0.1:8000/api/v1/vitals/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'dev-key-123', 'Authorization': 'Bearer clinician_token' },
        body: JSON.stringify(data)
      });
      if (gemmaRes.ok) {
        const agentResponse = await gemmaRes.json();
        // Fire alerts for HIGH and CRITICAL
        if (agentResponse.alert_level === 'CRITICAL' || agentResponse.alert_level === 'HIGH') {
           const alertMsg = agentResponse.reasoning_summary || `MedGemma Alert: ${agentResponse.alert_level} Risk detected`;
           io.to('DOCTOR').to('ADMIN').to('NURSE').emit('alarm:new', { patientId: vitals.patientId, message: alertMsg, level: agentResponse.alert_level });
           
           // Log to unified clinical events for history and audit tracking
           const pt = USERS.find(u => u.patientId === vitals.patientId || u._id === vitals.patientId);
           const patientName = pt ? pt.name : vitals.patientId;
           logClinicalEvent(
             'ALERT',
             vitals.patientId,
             patientName,
             'MedGemma-Nano',
             'SYSTEM',
             {
               alert_level: agentResponse.alert_level,
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
    } catch (agentErr) {
      console.warn('MedGemma agent unreachable, skipping AI analysis. Falling back to rule-based escalation.', agentErr.message);
      
      let level = null;
      let reason = '';
      
      // Fallback Rule-based alerting
      if (vitals.bloodPressureSys < 90 || vitals.heartRate > 120 || vitals.spO2 < 92) {
        level = 'CRITICAL';
        reason = 'Rule-based: Critical vitals detected (Low BP/SpO2 or High HR).';
      } else if (vitals.bloodPressureSys > 160 || vitals.heartRate > 100 || vitals.spO2 < 95) {
        level = 'HIGH';
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

    // Proxy the request to MedGemma
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

      // We extract API Key if sent by frontend, otherwise use the Nano MedGemma Admin Key
      const apiKey = req.headers['x-api-key'] || 'xB3z9Bw2u8qkD5sT_1GvLw0aR6YhN4pOeZcF7mX';
      const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : 'clinician_token';

      const agentRes = await fetch('http://100.88.162.102:8000/api/v1/ehr/ingest', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!agentRes.ok) {
        const errorText = await agentRes.text();
        console.warn('MedGemma agent EHR ingest failed:', errorText);
        return res.status(agentRes.status).json({ error: 'MedGemma processing failed', details: errorText });
      }

      const agentData = await agentRes.json();
      
      // Save file reference to patient if they exist
      const pt = USERS.find(u => u._id === req.body.patient_id);
      if (pt) {
        pt.ehrFile = req.file.filename;
      }
      
      res.json({ message: 'EHR Uploaded and indexed by AI successfully', agentData, filename: req.file.filename });

    } catch (agentErr) {
      console.warn('MedGemma unreachable for EHR proxy:', agentErr.message);
      res.status(502).json({ error: 'Failed to contact MedGemma AI agent' });
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
    // Seed default ABG past history to match the clinical event list!
    const time = (offsetMins) => new Date(Date.now() - offsetMins * 60 * 1000).toISOString();
    abgHistoryDB = [
      {
        patient_id: 'CLA-2026-00001',
        ph: 7.21,
        pao2_mmhg: 82,
        paco2_mmhg: 31,
        hco3: 12,
        base_excess: -10,
        lactate: 4.8,
        fio2: 0.21,
        na: 138,
        cl: 104,
        chronic_copd: false,
        summary: 'Severe metabolic acidosis with high lactate levels, indicating significant tissue hypoperfusion.',
        clinical_significance: 'Critical tissue hypoperfusion',
        alert_level: 'Critical',
        primary_concern: 'Severe Metabolic Acidosis',
        created_at: time(40),
        agent_used: 'medgemma-api-v2'
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

    // Proxy PDF to MedGemma-Agent on Nano
    try {
      const fileData = fs.readFileSync(req.file.path);
      const blob = new Blob([fileData], { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', blob, req.file.originalname);

      const agentRes = await fetch(`${NANO_BASE_URL}/api/v1/abg/upload`, {
        method: 'POST',
        headers: { 'X-API-Key': 'xB3z9Bw2u8qkD5sT_1GvLw0aR6YhN4pOeZcF7mX' },
        body: formData,
        signal: AbortSignal.timeout(45000)
      });

      if (agentRes.ok) {
        const data = await agentRes.json();
        return res.json({ success: true, extracted_fields: data.extracted_fields || data });
      } else {
        const errTxt = await agentRes.text();
        console.warn('Agent upload failed:', agentRes.status, errTxt);
        return res.status(502).json({ error: `MedGemma Agent error (${agentRes.status}): ${errTxt.slice(0, 100)}` });
      }
    } catch (e) {
      console.warn('Failed to contact MedGemma for upload:', e.message);
      return res.status(502).json({ error: 'MedGemma Nano Offline — cannot parse PDF. Please ensure the Nano is running medgemma_api_v2.py on port 8000.' });
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

    // Try MedGemma-Agent (full agent, has /api/v1/abg/analyze)
    try {
      const agentRes = await fetch(`${NANO_BASE_URL}/api/v1/abg/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'xB3z9Bw2u8qkD5sT_1GvLw0aR6YhN4pOeZcF7mX'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(300000) // 300s timeout for MedGemma under swap load
      });
      if (agentRes.ok) {
        analysis = await agentRes.json();
        agentUsed = 'medgemma-agent';
        console.log(`[ABG] MedGemma-Agent inference success for ${patientId}`);
      } else {
        const errBody = await agentRes.text();
        console.warn(`[ABG] MedGemma-Agent returned ${agentRes.status}: ${errBody.slice(0,100)}`);
        throw new Error(`Agent error ${agentRes.status}`);
      }
    } catch (e1) {
      // Fallback: Try medgemma_api_v2.py at /api/v1/abg/analyze (our updated route)
      console.log(`[ABG] Falling back to medgemma_api_v2 for ${patientId}: ${e1.message}`);
      try {
        const v2Res = await fetch(`${NANO_BASE_URL}/api/v1/abg/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(300000) // 300s timeout for fallback under swap load
        });
        if (v2Res.ok) {
          analysis = await v2Res.json();
          agentUsed = 'medgemma-api-v2';
          console.log(`[ABG] medgemma_api_v2 inference success for ${patientId}`);
        } else {
          throw new Error(`v2 error ${v2Res.status}`);
        }
      } catch (e2) {
        console.warn(`[ABG] Both Nano APIs failed for ${patientId}:`, e2.message);
        analysis = {
          summary: 'MedGemma Nano is offline — no AI inference available. This is a placeholder result.',
          clinical_significance: 'N/A — Nano offline',
          alert_level: 'Unknown',
          primary_concern: 'N/A — Nano offline',
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
        'MedGemma-Nano',
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`CliniAura Main Server running on port ${PORT}`);
  // Seed Audit Ledger with a couple of mock events to demonstrate functionality
  AuditLogger.log('SYSTEM_STARTUP', 'SYSTEM', 'SYSTEM', { status: 'OK', message: 'Cryptographic ledger initialized' });
  AuditLogger.log('PATIENT_ADMISSION', 'CLA-2026-00001', 'admin_1', { ward: 'ICU', protocol: 'Sepsis Resuscitation' });
  AuditLogger.log('VITAL_ANOMALY', 'CLA-2026-00001', 'SYSTEM', { sensor: 'HeartRate', value: 220, severity: 'CRITICAL' });
});
