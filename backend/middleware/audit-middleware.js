const { AuditLogger } = require('../services/audit-logger');

const auditMiddleware = async (req, res, next) => {
  // We want to log the event after the response is sent to capture status codes
  const start = Date.now();
  
  res.on('finish', () => {
    // Only log API routes, ignore static assets if any
    if (req.originalUrl.startsWith('/api/')) {
      const duration = Date.now() - start;
      const userId = req.user ? req.user.id : 'UNAUTHENTICATED';
      
      AuditLogger.log(
        'API_ACCESS',
        req.params?.id || req.body?.patientId || null,
        userId,
        {
          method: req.method,
          route: req.originalUrl,
          statusCode: res.statusCode,
          ip: req.ip || req.connection.remoteAddress,
          durationMs: duration
        }
      );
    }
  });
  
  next();
};

module.exports = auditMiddleware;
