// Audit logging service
function createAuditService(db) {
  function writeAudit(action, actor, target, detailsObj) {
    try {
      const details = detailsObj ? JSON.stringify(detailsObj).slice(0, 2000) : '';
      db.run("INSERT INTO audit_logs (action, actor, target, details) VALUES (?, ?, ?, ?)", 
        [action, actor || '', target || '', details]
      );
    } catch (e) {
      console.error('Audit log error:', e.message);
    }
  }

  return { writeAudit };
}

module.exports = createAuditService;

