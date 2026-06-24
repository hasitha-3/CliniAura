// CliniAura Dummy Data Simulator - Strict Health AI at the Edge Rules Implementation

export const generateDummyPatients = () => [
  {
    _id: "3",
    patientId: "1049",
    username: "RJones_G11",
    name: "Rajesh Jones",
    age: 55,
    gender: "Male",
    primaryDiagnosis: "Pneumonia",
    assignedNurse: "testnurse2",
    assignedDoctor: "testdoctor2",
    role: "PATIENT",
    ward: "General Ward",
    riskScore: "Moderate",
    activeProtocol: "Respiratory Support",
    targetMAP: 70,
    baselineCO: 5.0,
    baselineSV: 70,
    signalQualityIndex: 100,
    batteryLevel: 100,
    deviceType: "Standard Monitor"
  },
  {
    _id: "4",
    patientId: "CLA-2026-00004",
    username: "MWilliams_W2",
    name: "Maria Williams",
    age: 71,
    gender: "Female",
    primaryDiagnosis: "Renal Failure",
    assignedNurse: "testnurse2",
    assignedDoctor: "testdoctor1",
    role: "PATIENT",
    ward: "ICU",
    riskScore: "Medium",
    activeProtocol: "Fluid Resuscitation",
    targetMAP: 75,
    baselineCO: 4.2,
    baselineSV: 58,
    signalQualityIndex: 85, 
    batteryLevel: 65,
    deviceType: "VitalPatch"
  },
  {
    _id: "5",
    patientId: "CLA-2026-00005",
    username: "ASmith_S4",
    name: "Alex Smith",
    age: 29,
    gender: "Male",
    primaryDiagnosis: "Post-op Recovery",
    assignedNurse: "testnurse1",
    assignedDoctor: "testdoctor2",
    role: "PATIENT",
    ward: "General Ward",
    riskScore: "Low",
    activeProtocol: "Standard Observation",
    targetMAP: 80,
    baselineCO: 5.5,
    baselineSV: 75,
    signalQualityIndex: 99, 
    batteryLevel: 90,
    deviceType: "Basic Telemetry"
  }
];

// Helper to add realistic noise
const addNoise = (val, maxDelta) => val + Math.floor(Math.random() * (maxDelta * 2 + 1)) - maxDelta;

export const generateDummyVitals = (patientId, previousVitals = null) => {
  // Simulate occasional realistic artifacts instead of complete sensor failure
  if (patientId === "4" && Math.random() > 0.95) {
     return {
      patientId,
      timestamp: new Date().toISOString(),
      heartRate: 75,
      spO2: 98,
      bloodPressureSys: 120,
      bloodPressureDia: 80,
      respirationRate: 16,
      steps: 0,
      posture: "Unknown",
      fallDetected: false,
      sensorError: false
    };
  }

  const isCritical = patientId === "1";
  const isHigh = patientId === "2";
  
  let hr, spO2, sys, dia, rr;

  if (previousVitals && !previousVitals.sensorError) {
    hr = addNoise(previousVitals.heartRate, 2);
    spO2 = addNoise(previousVitals.spO2, 1);
    sys = addNoise(previousVitals.bloodPressureSys, 3);
    dia = addNoise(previousVitals.bloodPressureDia, 2);
    rr = addNoise(previousVitals.respirationRate, 1);
  } else {
    if (isCritical) {
      // Sepsis/Hemodynamic collapse: Tachycardia, Hypotension, Tachypnea
      hr = 135; spO2 = 91; sys = 85; dia = 45; rr = 26;
    } else if (isHigh) {
      // Deteriorating but not critical: High HR, slight hypotension
      hr = 115; spO2 = 94; sys = 105; dia = 65; rr = 22;
    } else {
      // Normal
      hr = 75; spO2 = 98; sys = 120; dia = 80; rr = 16;
    }
  }

  // Bounds enforcement
  if (spO2 > 100) spO2 = 100;
  if (hr < 40) hr = 40;

  return {
    patientId,
    timestamp: new Date().toISOString(),
    heartRate: hr,
    spO2: spO2,
    bloodPressureSys: sys,
    bloodPressureDia: dia,
    respirationRate: rr,
    steps: previousVitals ? previousVitals.steps + (Math.random() > 0.8 ? 1 : 0) : 1500,
    posture: isCritical ? "Supine" : "Upright",
    fallDetected: isCritical && Math.random() > 0.95 // Small chance of fall for critical
  };
};

// Strict NEWS2 Scoring Implementation
const calculateNEWS2 = (vitals) => {
  let score = 0;
  // Respiration Rate
  if (vitals.respirationRate <= 8 || vitals.respirationRate >= 25) score += 3;
  else if (vitals.respirationRate >= 21 && vitals.respirationRate <= 24) score += 2;
  else if (vitals.respirationRate >= 9 && vitals.respirationRate <= 11) score += 1;

  // SpO2 (Scale 1)
  if (vitals.spO2 <= 91) score += 3;
  else if (vitals.spO2 >= 92 && vitals.spO2 <= 93) score += 2;
  else if (vitals.spO2 >= 94 && vitals.spO2 <= 95) score += 1;

  // Systolic BP
  if (vitals.bloodPressureSys <= 90 || vitals.bloodPressureSys >= 220) score += 3;
  else if (vitals.bloodPressureSys >= 91 && vitals.bloodPressureSys <= 100) score += 2;
  else if (vitals.bloodPressureSys >= 101 && vitals.bloodPressureSys <= 110) score += 1;

  // Heart Rate
  if (vitals.heartRate <= 40 || vitals.heartRate >= 131) score += 3;
  else if (vitals.heartRate >= 111 && vitals.heartRate <= 130) score += 2;
  else if (vitals.heartRate >= 41 && vitals.heartRate <= 50) score += 1;
  else if (vitals.heartRate >= 91 && vitals.heartRate <= 110) score += 1;

  return score;
};

// qSOFA Scoring (Respiratory rate >= 22, Systolic BP <= 100)
const calculateqSOFA = (vitals) => {
  let score = 0;
  if (vitals.respirationRate >= 22) score += 1;
  if (vitals.bloodPressureSys <= 100) score += 1;
  // Altered mentation is 3rd criteria, assumed false for automated vitals
  return score;
};

export const generateCliniAuraAlert = (patientId, vitals) => {
  if (vitals.sensorError) {
    return {
      id: `alert-${patientId}-${Date.now()}`,
      patientId,
      message: `CRITICAL HARDWARE ALERT: Sensor disconnected or signal lost for patient ${patientId}. Immediate bedside check required.`,
      details: {
        risk_level: "CRITICAL",
        confidence: "High",
        reasoning: "Telemetry stream lost. Unable to retrieve HR, SpO2, and BP.",
        recommended_action: "Check sensor placement and battery.",
        disclaimer: "Hardware alert."
      },
      timestamp: new Date().toISOString()
    };
  }

  const news2 = calculateNEWS2(vitals);
  const qsofa = calculateqSOFA(vitals);
  const map = Math.round((vitals.bloodPressureSys + (2 * vitals.bloodPressureDia)) / 3);

  // CRITICAL: NEWS2 >= 7 OR qSOFA >= 2 OR single NEWS2 parameter = 3
  // HIGH: NEWS2 5-6
  // MEDIUM: NEWS2 3-4

  let riskLevel = "NORMAL";
  if (news2 >= 7 || qsofa >= 2) riskLevel = "CRITICAL";
  else if (news2 >= 5) riskLevel = "HIGH";
  else if (news2 >= 3) riskLevel = "MEDIUM";

  if (riskLevel === "CRITICAL") {
    return {
      id: `alert-${patientId}-${Date.now()}`,
      patientId,
      message: `Health AI at the Edge Alert: NEWS2 Score ${news2}, qSOFA ${qsofa}. Hemodynamic collapse risk. HR ${vitals.heartRate} bpm, MAP ${map} mmHg.`,
      details: {
        risk_level: "CRITICAL",
        confidence: "High",
        reasoning: `Patient exhibits Critical NEWS2 (${news2}) with tachycardia (${vitals.heartRate} bpm) and hypotension (MAP ${map} mmHg). Meets qSOFA criteria (${qsofa}/3) for sepsis.`,
        recommended_action: "Immediate fluid bolus and clinical review. Consider vasopressor initiation.",
        disclaimer: "This is a clinical decision support output. Not a diagnosis."
      },
      timestamp: new Date().toISOString()
    };
  } else if (riskLevel === "HIGH") {
    return {
      id: `alert-${patientId}-${Date.now()}`,
      patientId,
      message: `Health AI at the Edge Alert: NEWS2 Score ${news2}. Early signs of deterioration.`,
      details: {
        risk_level: "HIGH",
        confidence: "Moderate",
        reasoning: `NEWS2 score of ${news2} indicates worsening physiological state.`,
        recommended_action: "Urgent clinical review.",
        disclaimer: "This is a clinical decision support output. Not a diagnosis."
      },
      timestamp: new Date().toISOString()
    };
  }

  return null;
};
