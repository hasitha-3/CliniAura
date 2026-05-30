const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');

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
let AUDIT_LEDGER = [];
let ALARM_EVENTS = [];

// Seed Data Initialization
const initializeSeedData = () => {
  const patientPass = bcrypt.hashSync('Patient@123', 10);
  const doctorPass = bcrypt.hashSync('Doctor@123', 10);
  const adminPass = bcrypt.hashSync('Admin@123', 10);
  
  USERS = [
    {
      _id: '1', username: 'testpatient1', password: patientPass, role: 'PATIENT', name: 'Arjun Mehta', email: 'testpatient1@cliniaura.test', age: 45,
      riskScore: 'Moderate', activeProtocol: 'Sepsis Resuscitation Bundles', targetMAP: 65, baselineCO: 4.5, baselineSV: 60,
      ward: 'ICU', deviceType: 'VitalPatch', batteryLevel: 95, signalQualityIndex: 98, auditLogs: []
    },
    {
      _id: '2', username: 'testpatient2', password: patientPass, role: 'PATIENT', name: 'Priya Nair', email: 'testpatient2@cliniaura.test', age: 62,
      riskScore: 'High', activeProtocol: 'Cardiac Output Optimization', targetMAP: 70, baselineCO: 4.0, baselineSV: 55,
      ward: 'ICU', deviceType: 'VitalPatch', batteryLevel: 80, signalQualityIndex: 90, auditLogs: []
    },
    { _id: '3', username: 'testdoctor1', password: doctorPass, role: 'DOCTOR', name: 'Dr. Sarah Chen' },
    { _id: '4', username: 'testadmin1', password: adminPass, role: 'ADMIN', name: 'System Admin' }
  ];
  console.log('In-memory database initialized with seed data.');
};
initializeSeedData();

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role, age, activeProtocol, targetMAP, baselineCO, baselineSV, riskScore, ward, deviceType, batteryLevel, signalQualityIndex } = req.body;
    if (USERS.find(u => u.username === username)) return res.status(400).json({ error: 'Username already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      _id: Date.now().toString(),
      username, password: hashedPassword, role, age, 
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
app.get('/api/users', (req, res) => {
  const safeUsers = USERS.map(u => { const { password, ...rest } = u; return rest; });
  res.json(safeUsers);
});

app.get('/api/patients', (req, res) => {
  const safePatients = USERS.filter(u => u.role === 'PATIENT').map(u => { const { password, ...rest } = u; return rest; });
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

// --- Audit API Routes ---
app.get('/api/audit/report', (req, res) => {
  res.json(AUDIT_LEDGER.slice(0, 100));
});

app.get('/api/audit/verify', (req, res) => {
  res.json({ status: 'verified', signature: 'in-memory-mock' });
});

app.get('/api/audit/generate-pdf', async (req, res) => {
  try {
    // Return empty mock buffer for now
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=cliniaura_audit_report.pdf');
    res.send(Buffer.from('mock pdf data'));
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
           io.to('DOCTOR').to('ADMIN').emit('alarm:new', { patientId: vitals.patientId, message: alertMsg, level: agentResponse.alert_level });
        }
      }
    } catch (agentErr) {
      console.warn('MedGemma agent unreachable, skipping AI analysis.', agentErr.message);
    }
    
    res.status(200).json({ status: 'success', message: 'Vitals ingested and broadcasted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to ingest vitals' });
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
    // In a real system, we might join a specific socket room here:
    // socket.join(`patient_${patientId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (In-Memory Database Mode)`);
});
