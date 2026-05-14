const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { AuditLogger, AuditLedger } = require('./services/audit-logger');
const { AlarmEvent } = require('./services/alarm-orchestrator');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'DOCTOR', 'PATIENT'], required: true },
  age: Number,
  riskScore: { type: String, enum: ['Low', 'Moderate', 'High', 'Critical'] },
  activeProtocol: String,
  targetMAP: Number,
  baselineCO: Number,
  baselineSV: Number,
  ward: { type: String, default: 'General Ward' },
  deviceType: { type: String, default: 'Standard Monitor' },
  batteryLevel: { type: Number, default: 100 },
  signalQualityIndex: { type: Number, default: 100 },
  auditLogs: [{
    timestamp: { type: Date, default: Date.now },
    event: String,
    status: { type: String, enum: ['EFFICIENT', 'DELAYED', 'INEFFICIENT'] }
  }]
});

// Avoid overwriting model if already compiled
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Vital = mongoose.models.Vital || mongoose.model('Vital', new mongoose.Schema({
  patientId: String,
  heartRate: Number,
  spO2: Number,
  bloodPressureSys: Number,
  bloodPressureDia: Number,
  timestamp: { type: Date, default: Date.now }
}));

const setup = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/cliniaura');
    console.log('Connected to DB successfully for seeding');

    // 1. Clear existing collections completely
    await User.deleteMany({});
    await Vital.deleteMany({});
    await AlarmEvent.deleteMany({});
    await AuditLedger.deleteMany({});
    console.log('Cleared existing User, Vital, AlarmEvent, and AuditLedger collections.');

    // Secure password hash supporting complexity constraints
    const hash = await bcrypt.hash('SecurePass123', 10);

    // 2. Pre-populate rich user and patient documents with advanced metadata
    const users = [
      { username: 'Admin Executive', password: hash, role: 'ADMIN' },
      { username: 'Dr. Arindam Sen', password: hash, role: 'DOCTOR' },
      { username: 'Dr. Ritu Varma', password: hash, role: 'DOCTOR' },
      { 
        username: 'Rajesh Kumar', password: hash, role: 'PATIENT',
        age: 62,
        riskScore: 'Critical',
        activeProtocol: 'Sepsis Resuscitation Bundles',
        targetMAP: 65,
        baselineCO: 4.1,
        baselineSV: 55,
        ward: 'Intensive Care',
        deviceType: 'VitalPatch MBS-100',
        batteryLevel: 88,
        signalQualityIndex: 94,
        auditLogs: [
            { event: "Administered 500ml Fluid Bolus following MAP < 65", status: "EFFICIENT" },
            { event: "Initiated Norepinephrine Titration via central access", status: "EFFICIENT" }
        ]
      },
      { 
        username: 'Sita Mahalakshmi', password: hash, role: 'PATIENT',
        age: 54,
        riskScore: 'High',
        activeProtocol: 'Post-Op Hemodynamic Tracking',
        targetMAP: 70,
        baselineCO: 5.2,
        baselineSV: 75,
        ward: 'Step-Down Unit',
        deviceType: 'Masimo Radius-7',
        batteryLevel: 95,
        signalQualityIndex: 98,
        auditLogs: [
            { event: "Arterial line calibrated successfully", status: "EFFICIENT" },
            { event: "Mild transient desaturation recovered on 2L O2", status: "DELAYED" }
        ]
      },
      { 
        username: 'Amit Patel', password: hash, role: 'PATIENT',
        age: 48,
        riskScore: 'Moderate',
        activeProtocol: 'DVT Prophylaxis & Fluid Balance',
        targetMAP: 68,
        baselineCO: 4.8,
        baselineSV: 62,
        ward: 'Intensive Care',
        deviceType: 'VitalPatch MBS-100',
        batteryLevel: 42,
        signalQualityIndex: 85,
        auditLogs: [
            { event: "LMWH dosage administered per schedule", status: "EFFICIENT" }
        ]
      },
      { 
        username: 'Priya Sharma', password: hash, role: 'PATIENT',
        age: 35,
        riskScore: 'Low',
        activeProtocol: 'Standard Ward Spot Checks',
        targetMAP: 70,
        baselineCO: 5.5,
        baselineSV: 80,
        ward: 'General Ward',
        deviceType: 'Omron HEM-R4',
        batteryLevel: 91,
        signalQualityIndex: 96,
        auditLogs: [
            { event: "Initial admission triage vitals logged", status: "EFFICIENT" }
        ]
      },
      { 
        username: 'Anil Deshmukh', password: hash, role: 'PATIENT',
        age: 68,
        riskScore: 'High',
        activeProtocol: 'Enhanced Recovery After Surgery (ERAS)',
        targetMAP: 65,
        baselineCO: 4.5,
        baselineSV: 60,
        ward: 'Step-Down Unit',
        deviceType: 'Masimo Radius-7',
        batteryLevel: 78,
        signalQualityIndex: 91,
        auditLogs: [
            { event: "Early ambulation protocol triggered", status: "EFFICIENT" }
        ]
      }
    ];

    const insertedUsers = await User.insertMany(users);
    console.log('Seeded Users and specialized Patients successfully!');

    // 3. Pre-populate Cryptographically Secure Audit Logs
    // We fetch the inserted patients to map their actual _ids correctly
    const pRajesh = insertedUsers.find(u => u.username === 'Rajesh Kumar');
    const pSita = insertedUsers.find(u => u.username === 'Sita Mahalakshmi');
    const pAmit = insertedUsers.find(u => u.username === 'Amit Patel');

    await AuditLogger.log('ADMISSION_TRIAGE', pRajesh._id.toString(), 'SYSTEM', { severity: 'CRITICAL', source: 'Emergency Dept' }, 'Intensive Care');
    await AuditLogger.log('PROTOCOL_INITIATED', pRajesh._id.toString(), 'Dr. Arindam Sen', { protocol: 'Sepsis Resuscitation Bundles' }, 'Intensive Care');
    await AuditLogger.log('VITAL_STREAM_ACTIVE', pSita._id.toString(), 'SYSTEM', { sampleRateHz: 100, telemetryHub: 'Masimo Radius-7' }, 'Step-Down Unit');
    await AuditLogger.log('ALARM_ACKNOWLEDGED', pAmit._id.toString(), 'Dr. Ritu Varma', { actionTaken: 'Fluid infusion adjusted' }, 'Intensive Care');
    console.log('Pre-populated secure immutable hash chains in AuditLedger.');

    // 4. Pre-populate Multi-Tier Escalation Alarm Events
    const alarms = [
      {
        alarmId: 'ALM-2026-001',
        patientId: pRajesh._id.toString(),
        type: 'HYPOTENSION',
        tier: 3,
        sentAt: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
        message: 'Critical Hypotension Detected (MAP < 65) — Escalated to Tier 3 Doctor on Call',
        escalationCount: 2
      },
      {
        alarmId: 'ALM-2026-002',
        patientId: pSita._id.toString(),
        type: 'DESATURATION',
        tier: 1,
        sentAt: new Date(Date.now() - 4 * 60 * 1000), // 4 mins ago
        message: 'Low Oxygen Saturation (SpO2 < 94%) — Initial Nurse Alert',
        escalationCount: 0
      },
      {
        alarmId: 'ALM-2026-003',
        patientId: pAmit._id.toString(),
        type: 'CLUSTER',
        tier: 2,
        sentAt: new Date(Date.now() - 8 * 60 * 1000),
        acknowledgedAt: new Date(Date.now() - 2 * 60 * 1000),
        acknowledgedBy: 'Dr. Ritu Varma',
        message: 'MULTIPLE ALERTS (2): Tachycardia, MAP Drop — Charge Nurse Acknowledged',
        escalationCount: 1
      }
    ];
    await AlarmEvent.insertMany(alarms);
    console.log('Pre-populated multi-tier AlarmEvents successfully.');

    console.log('\n======================================================');
    console.log('DATABASE SETUP AND ADVANCED SEEDING COMPLETE!');
    console.log('Default credentials for Sign In:');
    console.log('Username: Dr. Arindam Sen  | Password: SecurePass123');
    console.log('Username: Admin Executive  | Password: SecurePass123');
    console.log('Username: Rajesh Kumar     | Password: SecurePass123');
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('CRITICAL ERROR setting up DB:', err);
    process.exit(1);
  }
};

setup();
