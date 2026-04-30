const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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
  auditLogs: [{
    timestamp: { type: Date, default: Date.now },
    event: String,
    status: { type: String, enum: ['EFFICIENT', 'DELAYED', 'INEFFICIENT'] }
  }]
});
const User = mongoose.model('User', userSchema);

const setup = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/cliniaura');
    console.log('Connected to DB');

    await User.deleteMany({});
    
    const hash = await bcrypt.hash('password123', 10);

    const users = [
      { username: 'admin', password: hash, role: 'ADMIN' },
      { username: 'doctor1', password: hash, role: 'DOCTOR' },
      { 
        username: 'patient1', password: hash, role: 'PATIENT',
        age: 65,
        riskScore: 'High',
        activeProtocol: 'Sepsis Resuscitation Bundles',
        targetMAP: 65,
        baselineCO: 4.5,
        baselineSV: 60,
        auditLogs: [
            { event: "Administered 500ml Fluid Bolus following MAP < 65", status: "EFFICIENT" },
            { event: "Initiated Vasopressor Titration", status: "DELAYED" }
        ]
      },
      { 
        username: 'patient2', password: hash, role: 'PATIENT',
        age: 45,
        riskScore: 'Moderate',
        activeProtocol: 'Post-Op Hemodynamic Tracking',
        targetMAP: 70,
        baselineCO: 5.2,
        baselineSV: 75,
        auditLogs: [
            { event: "Admitted to ICU for monitoring", status: "EFFICIENT" }
        ]
      },
    ];

    await User.insertMany(users);
    console.log('Test users created successfully with specialized Hemodynamic properties!');
    
    process.exit(0);
  } catch (err) {
    console.error('Error setting up DB (Is MongoDB running?):', err.message);
    process.exit(1);
  }
};

setup();
