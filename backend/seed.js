/**
 * Cliniaura — Test Account Seeder
 * Run: node seed.js
 * Requires: MONGODB_URI in environment or .env file
 *
 * Creates:
 *   5 patients  (testpatient1–5)
 *   3 doctors   (testdoctor1–3)
 *   1 admin     (testadmin1)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// ── Schema (mirrors your existing User model) ──────────────────────────────
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['patient', 'nurse', 'doctor', 'admin'], required: true },
  name: { type: String, required: true },
  email: { type: String },
  // Patient-specific
  age: Number,
  gender: String,
  diagnosis: String,
  bedId: String,
  ward: String,
  targetMAP: Number,
  baselineCO: Number,
  baselineSV: Number,
  admittedOn: Date,
  // Doctor-specific
  specialisation: String,
  department: String,
  licenseNo: String,
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// ── Seed data ──────────────────────────────────────────────────────────────
const SALT_ROUNDS = 10;

const PATIENTS = [
  {
    username: 'testpatient1',
    password: 'Patient@123',
    role: 'patient',
    name: 'Arjun Mehta',
    email: 'testpatient1@cliniaura.test',
    age: 45,
    gender: 'Male',
    diagnosis: 'Post-op Day 2 — Appendectomy',
    bedId: 'BED-01',
    ward: 'General Surgery Ward',
    targetMAP: 70,
    baselineCO: 5.2,
    baselineSV: 70,
    admittedOn: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  },
  {
    username: 'testpatient2',
    password: 'Patient@123',
    role: 'patient',
    name: 'Priya Nair',
    email: 'testpatient2@cliniaura.test',
    age: 62,
    gender: 'Female',
    diagnosis: 'Hypertensive Crisis — Observation',
    bedId: 'BED-02',
    ward: 'Cardiology Ward',
    targetMAP: 85,
    baselineCO: 4.8,
    baselineSV: 65,
    admittedOn: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    username: 'testpatient3',
    password: 'Patient@123',
    role: 'patient',
    name: 'Venkatesh Rao',
    email: 'testpatient3@cliniaura.test',
    age: 58,
    gender: 'Male',
    diagnosis: 'Community-Acquired Pneumonia',
    bedId: 'BED-03',
    ward: 'Respiratory Ward',
    targetMAP: 72,
    baselineCO: 5.0,
    baselineSV: 68,
    admittedOn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    username: 'testpatient4',
    password: 'Patient@123',
    role: 'patient',
    name: 'Sunita Sharma',
    email: 'testpatient4@cliniaura.test',
    age: 34,
    gender: 'Female',
    diagnosis: 'Post-op Day 1 — C-Section',
    bedId: 'BED-04',
    ward: 'Obstetrics Ward',
    targetMAP: 68,
    baselineCO: 6.1,
    baselineSV: 75,
    admittedOn: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    username: 'testpatient5',
    password: 'Patient@123',
    role: 'patient',
    name: 'Mohammed Irfan',
    email: 'testpatient5@cliniaura.test',
    age: 71,
    gender: 'Male',
    diagnosis: 'Type 2 Diabetes — Diabetic Ketoacidosis',
    bedId: 'BED-05',
    ward: 'Endocrinology Ward',
    targetMAP: 78,
    baselineCO: 4.5,
    baselineSV: 62,
    admittedOn: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
];

const DOCTORS = [
  {
    username: 'testdoctor1',
    password: 'Doctor@123',
    role: 'doctor',
    name: 'Dr. Kavitha Reddy',
    email: 'testdoctor1@cliniaura.test',
    specialisation: 'General Surgery',
    department: 'Surgery',
    licenseNo: 'MCI-TG-001-TEST',
  },
  {
    username: 'testdoctor2',
    password: 'Doctor@123',
    role: 'doctor',
    name: 'Dr. Suresh Anand',
    email: 'testdoctor2@cliniaura.test',
    specialisation: 'Cardiology',
    department: 'Cardiology',
    licenseNo: 'MCI-TG-002-TEST',
  },
  {
    username: 'testdoctor3',
    password: 'Doctor@123',
    role: 'doctor',
    name: 'Dr. Ananya Krishnan',
    email: 'testdoctor3@cliniaura.test',
    specialisation: 'Pulmonology',
    department: 'Respiratory Medicine',
    licenseNo: 'MCI-TG-003-TEST',
  },
];

const ADMINS = [
  {
    username: 'testadmin1',
    password: 'Admin@123',
    role: 'admin',
    name: 'Admin — Test Account',
    email: 'testadmin1@cliniaura.test',
  },
];

