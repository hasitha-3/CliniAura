const http = require('http');

const API_HOST = '127.0.0.1';
const API_PORT = 5000;
const API_PATH = '/api/v1/vitals/snapshot';

// Define realistic patient profiles based on the MedGemma Agent test cases
const profiles = {
  // Stable post-operative recovery (Patient 1)
  stable: {
    patient_id: '1',
    systolic_bp: 122,
    diastolic_bp: 78,
    heart_rate: 74,
    spo2: 98,
    respiration_rate: 14,
    steps: 1200,
    posture: 'Upright',
    fall_detected: false,
    noise: { sbp: 3, dbp: 2, hr: 2, spo2: 1, rr: 1 }
  },
  // Declining SpO2 / Early respiratory concern (Patient 2)
  deteriorating: {
    patient_id: '2',
    systolic_bp: 110,
    diastolic_bp: 70,
    heart_rate: 86,
    spo2: 95, // Will drop over time
    respiration_rate: 18, // Will increase over time
    steps: 500,
    posture: 'Laying',
    fall_detected: false,
    noise: { sbp: 4, dbp: 3, hr: 4, spo2: 1, rr: 2 },
    trend: { sbp: -0.2, dbp: -0.1, hr: 0.5, spo2: -0.1, rr: 0.1 } // Drift applied per tick
  },
  // Patient 3
  pneumonia_recovery: {
    patient_id: 'dummy-patient-3',
    systolic_bp: 130,
    diastolic_bp: 85,
    heart_rate: 92,
    spo2: 96,
    respiration_rate: 22,
    steps: 100,
    posture: 'Sitting',
    fall_detected: false,
    noise: { sbp: 2, dbp: 2, hr: 2, spo2: 1, rr: 1 }
  },
  // Patient 4
  renal_failure: {
    patient_id: 'dummy-patient-4',
    systolic_bp: 145,
    diastolic_bp: 95,
    heart_rate: 88,
    spo2: 98,
    respiration_rate: 16,
    steps: 50,
    posture: 'Laying',
    fall_detected: false,
    noise: { sbp: 5, dbp: 4, hr: 3, spo2: 1, rr: 1 }
  },
  // Patient 5
  post_op: {
    patient_id: '6',
    systolic_bp: 118,
    diastolic_bp: 75,
    heart_rate: 70,
    spo2: 99,
    respiration_rate: 12,
    steps: 300,
    posture: 'Upright',
    fall_detected: false,
    noise: { sbp: 2, dbp: 2, hr: 2, spo2: 1, rr: 1 }
  }
};

let currentState = JSON.parse(JSON.stringify(profiles));

const sendVitals = (profileName) => {
  const state = currentState[profileName];
  const baseProfile = profiles[profileName];
  
  // Apply physiological trends (e.g., patient getting sicker over time)
  if (baseProfile.trend) {
    state.systolic_bp += baseProfile.trend.sbp;
    state.diastolic_bp += baseProfile.trend.dbp;
    state.heart_rate += baseProfile.trend.hr;
    state.spo2 = Math.max(0, state.spo2 + baseProfile.trend.spo2);
    state.respiration_rate += baseProfile.trend.rr;
  }

  // Apply random noise for biological realism
  const noisyState = {
    patient_id: state.patient_id,
    systolic_bp: Math.round(state.systolic_bp + (Math.random() * baseProfile.noise.sbp * 2 - baseProfile.noise.sbp)),
    diastolic_bp: Math.round(state.diastolic_bp + (Math.random() * baseProfile.noise.dbp * 2 - baseProfile.noise.dbp)),
    heart_rate: Math.round(state.heart_rate + (Math.random() * baseProfile.noise.hr * 2 - baseProfile.noise.hr)),
    spo2: Math.min(100, Math.round(state.spo2 + (Math.random() * baseProfile.noise.spo2 * 2 - baseProfile.noise.spo2))),
    respiration_rate: Math.round(state.respiration_rate + (Math.random() * baseProfile.noise.rr * 2 - baseProfile.noise.rr)),
    steps: state.steps + Math.floor(Math.random() * 3),
    posture: state.posture,
    fall_detected: state.fall_detected
  };
  
  state.steps = noisyState.steps;

  const payload = JSON.stringify(noisyState);

  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: API_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log(`[Edge Device] -> Successfully uploaded data for Patient ${noisyState.patient_id} (HR: ${noisyState.heart_rate}, SpO2: ${noisyState.spo2}%)`);
      } else {
        console.log(`[Edge Device] -> Error: Server returned ${res.statusCode}`);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`[Edge Device] Connection error: ${e.message}. Is the backend running?`);
  });

  req.write(payload);
  req.end();
};

console.log('----------------------------------------------------');
console.log('CliniAura Edge Device Simulator Started');
console.log(`Streaming to http://${API_HOST}:${API_PORT}${API_PATH}`);
console.log('----------------------------------------------------');

// Stream data at high frequency (every 1.5 seconds) to simulate real-time monitors
setInterval(() => {
  sendVitals('stable');       // Patient 1
  sendVitals('deteriorating'); // Patient 2
  sendVitals('pneumonia_recovery'); // Patient 3
  sendVitals('renal_failure'); // Patient 4
  sendVitals('post_op'); // Patient 5
}, 1500);
