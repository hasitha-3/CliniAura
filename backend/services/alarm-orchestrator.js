const { AuditLogger } = require('./audit-logger');
// Mocking twilio service just in case it errors out
// const { sendTwilioMessage } = require('./twilio-service');
const sendTwilioMessage = (role, msg) => console.log(`[TWILIO MOCK] ${role}: ${msg}`);

let alarmEventsDb = [];

// In-memory queues
const escalationTimeouts = new Map();
const recentAlarms = new Map(); // patientId -> [{type, timestamp, message}]
const suppressedAlarms = new Map(); // patientId_type -> expiryTimestamp

class AlarmOrchestrator {
  constructor(io) {
    this.io = io;
  }

  async handleRawAlarm(patientId, type, message) {
    const now = Date.now();
    const suppressionKey = `${patientId}_${type}`;

    // 1. SUPPRESSION CHECK
    if (suppressedAlarms.has(suppressionKey)) {
      if (now < suppressedAlarms.get(suppressionKey)) {
        console.log(`[ALARM] Suppressed: ${type} for patient ${patientId}`);
        return; // Suppressed
      } else {
        suppressedAlarms.delete(suppressionKey); // Expired
      }
    }

    // 2. CLUSTERING / DEDUPLICATION
    if (!recentAlarms.has(patientId)) {
      recentAlarms.set(patientId, []);
    }
    const patientAlarms = recentAlarms.get(patientId);
    
    // Check if identical alarm exists within last 2 minutes (deduplication)
    const duplicate = patientAlarms.find(a => a.type === type && (now - a.timestamp) < 2 * 60 * 1000);
    if (duplicate) {
      return; // Deduplicated
    }

    patientAlarms.push({ type, timestamp: now, message });

    // Cluster if >= 2 alarms in 5 mins
    const recentCluster = patientAlarms.filter(a => (now - a.timestamp) < 5 * 60 * 1000);
    let finalMessage = message;
    if (recentCluster.length >= 2) {
      finalMessage = `MULTIPLE ALERTS (${recentCluster.length}): ` + recentCluster.map(a => a.type).join(', ');
    }

    const alarmId = `ALM-${Date.now()}-${Math.floor(Math.random()*1000)}`;

    // Save to DB
    const alarmRecord = {
      alarmId,
      patientId,
      type: recentCluster.length >= 2 ? 'CLUSTER' : type,
      message: finalMessage,
      tier: 1,
      sentAt: new Date(),
      escalationCount: 0
    };
    alarmEventsDb.push(alarmRecord);

    AuditLogger.log('ALARM_GENERATED', patientId, 'SYSTEM', { alarmId, type, finalMessage });

    // 3. TIER 1: Notify assigned nurse
    this.io.emit('alarm:new', { alarmId, patientId, message: finalMessage, tier: 1 });

    // Schedule Tier 2 Escalation (3 minutes)
    const tier2Timeout = setTimeout(() => this.escalateToTier2(alarmId), 3 * 60 * 1000);
    escalationTimeouts.set(alarmId, tier2Timeout);
  }

  async escalateToTier2(alarmId) {
    const alarm = alarmEventsDb.find(a => a.alarmId === alarmId && !a.acknowledgedAt);
    if (!alarm) return; // Acknowledged or missing

    alarm.tier = 2;
    alarm.escalationCount += 1;

    console.log(`[ESCALATION] Tier 2 for Alarm ${alarmId}`);
    this.io.emit('alarm:escalation', { alarmId, patientId: alarm.patientId, message: alarm.message, tier: 2 });
    sendTwilioMessage('CHARGE_NURSE', `[TIER 2 ESCALATION] ${alarm.message} (Patient: ${alarm.patientId})`);

    AuditLogger.log('ALARM_ESCALATED', alarm.patientId, 'SYSTEM', { alarmId, tier: 2 });

    // Schedule Tier 3 Escalation (additional 5 minutes, total 8 mins)
    const tier3Timeout = setTimeout(() => this.escalateToTier3(alarmId), 5 * 60 * 1000);
    escalationTimeouts.set(alarmId, tier3Timeout);
  }

  async escalateToTier3(alarmId) {
    const alarm = alarmEventsDb.find(a => a.alarmId === alarmId && !a.acknowledgedAt);
    if (!alarm) return;

    alarm.tier = 3;
    alarm.escalationCount += 1;

    console.log(`[ESCALATION] Tier 3 (DOCTOR) for Alarm ${alarmId}`);
    this.io.emit('alarm:escalation', { alarmId, patientId: alarm.patientId, message: alarm.message, tier: 3 });
    sendTwilioMessage('DOCTOR_ON_CALL', `[CRITICAL TIER 3] ${alarm.message} (Patient: ${alarm.patientId})`);

    AuditLogger.log('ALARM_ESCALATED', alarm.patientId, 'SYSTEM', { alarmId, tier: 3 });
  }

  async acknowledgeAlarm(alarmId, userId, suppressDurationMins = 20) {
    const alarm = alarmEventsDb.find(a => a.alarmId === alarmId);
    if (!alarm) return false;

    alarm.acknowledgedAt = new Date();
    alarm.acknowledgedBy = userId;

    // Cancel pending escalations
    if (escalationTimeouts.has(alarmId)) {
      clearTimeout(escalationTimeouts.get(alarmId));
      escalationTimeouts.delete(alarmId);
    }

    // Suppress future alarms of this type for this patient
    const suppressionKey = `${alarm.patientId}_${alarm.type}`;
    suppressedAlarms.set(suppressionKey, Date.now() + (suppressDurationMins * 60 * 1000));

    AuditLogger.log('ALARM_ACKNOWLEDGED', alarm.patientId, userId, { alarmId, suppressDurationMins });
    this.io.emit('alarm:acknowledged', { alarmId, patientId: alarm.patientId });

    return true;
  }
}

module.exports = { AlarmOrchestrator, getAlarmEvents: () => alarmEventsDb };
