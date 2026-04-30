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

// --- Mongoose Models (Hemodynamic Specialized) ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'DOCTOR', 'PATIENT'], required: true },
  age: Number,
  // Hemodynamic specific parameters for patients
  riskScore: { type: String, enum: ['Low', 'Moderate', 'High', 'Critical'] },
  activeProtocol: String,
  targetMAP: Number,
  baselineCO: Number, // Cardiac Output (L/min)
  baselineSV: Number, // Stroke Volume (mL/beat)
  auditLogs: [{
    timestamp: { type: Date, default: Date.now },
    event: String,
    status: { type: String, enum: ['EFFICIENT', 'DELAYED', 'INEFFICIENT'] }
  }]
});
const User = mongoose.model('User', userSchema);

const vitalSchema = new mongoose.Schema({
  patientId: String,
  heartRate: Number,
  spO2: Number,
  bloodPressureSys: Number,
  bloodPressureDia: Number,
  timestamp: { type: Date, default: Date.now }
});
const Vital = mongoose.model('Vital', vitalSchema);

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role, age, activeProtocol, targetMAP, baselineCO, baselineSV, riskScore } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ 
      username, password: hashedPassword, role, age, 
      activeProtocol, targetMAP, baselineCO, baselineSV, riskScore 
    });
    await user.save();
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
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
app.get('/api/users', async (req, res) => {
  // Returns all users including full audit logs for admin compliance tracking
  const users = await User.find({}, '-password');
  res.json(users);
});

app.get('/api/patients', async (req, res) => {
  const patients = await User.find({ role: 'PATIENT' }, '-password');
  res.json(patients);
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    // Prevent changing secure fields
    delete updateData.password;
    delete updateData.role;
    delete updateData.username;
    delete updateData._id;

    await User.findByIdAndUpdate(id, updateData);
    res.json({ message: 'Settings saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Audit API Routes ---
app.get('/api/audit/report', async (req, res) => {
  try {
    const records = await AuditLedger.find().sort({ timestamp: -1 }).limit(100);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit/verify', async (req, res) => {
  try {
    const result = await AuditLogger.verify();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit/generate-pdf', async (req, res) => {
  try {
    const pdfBytes = await generateCompliancePDF(req.query.wardId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=cliniaura_audit_report.pdf');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Alarm API Routes ---
app.post('/api/alarms/:alarmId/acknowledge', async (req, res) => {
  try {
    const success = await alarmOrchestrator.acknowledgeAlarm(req.params.alarmId, req.user?.id || 'SYSTEM');
    if (success) res.json({ message: 'Acknowledged' });
    else res.status(404).json({ error: 'Alarm not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alarms/burden-report', async (req, res) => {
  try {
    const events = await AlarmEvent.find().sort({ sentAt: -1 }).limit(50);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Socket.io Real-time Vitals Simulation ---
let simulationInterval;
const alarmOrchestrator = new AlarmOrchestrator(io);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('start_monitoring', async (patientId) => {
    console.log('Monitoring patient:', patientId);
    if (simulationInterval) clearInterval(simulationInterval);
    
    simulationInterval = setInterval(async () => {
      // Generate synthetic vitals
      const vitals = {
        patientId,
        heartRate: Math.floor(Math.random() * (110 - 70 + 1)) + 70, // Slight variation
        spO2: Math.floor(Math.random() * (100 - 92 + 1)) + 92,
        bloodPressureSys: Math.floor(Math.random() * (120 - 85 + 1)) + 85, // Introduce map drops
        bloodPressureDia: Math.floor(Math.random() * (80 - 55 + 1)) + 55,
        timestamp: new Date()
      };
      
      const map = Math.round((vitals.bloodPressureSys + (2 * vitals.bloodPressureDia)) / 3);

      io.emit('vitals_update', { vitals, calculatedMAP: map });

      // Trigger Smart Alarm Orchestrator instead of raw socket events
      if (map < 65) {
        alarmOrchestrator.handleRawAlarm(patientId, 'HYPOTENSION', 'Critical Hypotension Detected (MAP < 65)');
      } else if (vitals.spO2 < 94) {
        alarmOrchestrator.handleRawAlarm(patientId, 'DESATURATION', 'Low Oxygen Saturation (SpO2 < 94%)');
      }
    }, 2000);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    if (simulationInterval) clearInterval(simulationInterval);
  });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cliniaura').then(() => {
  console.log('Connected to MongoDB successfully!');
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.log("MongoDB connection error.", err.message);
  process.exit(1);
});
