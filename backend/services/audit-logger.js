const crypto = require('crypto');

let auditLedgerDb = [];

class AuditLogger {
  static async log(eventType, patientId, userId, data, wardId = 'general') {
    try {
      // Fetch the last record to get its hash
      const lastRecord = auditLedgerDb.length > 0 ? auditLedgerDb[auditLedgerDb.length - 1] : null;
      const previousHash = lastRecord ? lastRecord.currentHash : 'GENESIS';

      const timestamp = new Date();
      const dataString = JSON.stringify(data || {});
      
      // Hash formula: SHA256(eventType + patientId + data + timestamp + previousHash)
      const hashContent = `${eventType}${patientId || ''}${dataString}${timestamp.toISOString()}${previousHash}`;
      const currentHash = crypto.createHash('sha256').update(hashContent).digest('hex');

      const auditRecord = {
        eventType,
        patientId,
        userId,
        wardId,
        data,
        timestamp,
        previousHash,
        currentHash
      };

      auditLedgerDb.push(auditRecord);
      return auditRecord;
    } catch (error) {
      console.error('CRITICAL: Audit log failed to write', error);
    }
  }

  static async verify(fromTimestamp = new Date(0), toTimestamp = new Date()) {
    const records = auditLedgerDb.filter(
      r => r.timestamp >= fromTimestamp && r.timestamp <= toTimestamp
    );

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

module.exports = { AuditLogger, getAuditLedger: () => auditLedgerDb };
