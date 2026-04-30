const mongoose = require('mongoose');
const crypto = require('crypto');

const auditLedgerSchema = new mongoose.Schema({
  eventType: { type: String, required: true },
  patientId: { type: String },
  userId: { type: String },
  wardId: { type: String },
  data: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
  previousHash: { type: String, required: true },
  currentHash: { type: String, required: true }
});

const AuditLedger = mongoose.model('AuditLedger', auditLedgerSchema);

class AuditLogger {
  static async log(eventType, patientId, userId, data, wardId = 'general') {
    try {
      // Fetch the last record to get its hash
      const lastRecord = await AuditLedger.findOne().sort({ _id: -1 }).exec();
      const previousHash = lastRecord ? lastRecord.currentHash : 'GENESIS';

      const timestamp = new Date();
      const dataString = JSON.stringify(data || {});
      
      // Hash formula: SHA256(eventType + patientId + data + timestamp + previousHash)
      const hashContent = `${eventType}${patientId || ''}${dataString}${timestamp.toISOString()}${previousHash}`;
      const currentHash = crypto.createHash('sha256').update(hashContent).digest('hex');

      const auditRecord = new AuditLedger({
        eventType,
        patientId,
        userId,
        wardId,
        data,
        timestamp,
        previousHash,
        currentHash
      });

      await auditRecord.save();
      return auditRecord;
    } catch (error) {
      console.error('CRITICAL: Audit log failed to write', error);
      // In a real system, failing to audit might halt the request depending on strictness.
    }
  }

  static async verify(fromTimestamp = new Date(0), toTimestamp = new Date()) {
    const records = await AuditLedger.find({
      timestamp: { $gte: fromTimestamp, $lte: toTimestamp }
    }).sort({ timestamp: 1 });

    if (records.length === 0) return { valid: true };

    let prevHash = records[0].previousHash;

    for (const record of records) {
      if (record.previousHash !== prevHash) {
        return { valid: false, tamperedAt: record.timestamp, reason: 'Broken Chain' };
      }

      const dataString = JSON.stringify(record.data || {});
      const hashContent = `${record.eventType}${record.patientId || ''}${dataString}${record.timestamp.toISOString()}${record.previousHash}`;
      const recomputedHash = crypto.createHash('sha256').update(hashContent).digest('hex');

      if (recomputedHash !== record.currentHash) {
        return { valid: false, tamperedAt: record.timestamp, reason: 'Hash Mismatch' };
      }

      prevHash = record.currentHash;
    }

    return { valid: true, count: records.length };
  }
}

module.exports = { AuditLogger, AuditLedger };
