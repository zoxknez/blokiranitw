// Admin middleware
const ADMIN_IPS = (process.env.ADMIN_IPS || '').split(',').map(s => s.trim()).filter(Boolean);

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const userRole = req.user.role;
  if (userRole !== 'admin') {
    console.warn(`[${req.id}] Non-admin user ${req.user.username} (role: ${userRole}) attempted to access admin route`);
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

function requireAdminIp(req, res, next) {
  if (ADMIN_IPS.length === 0) return next();
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip;
  if (!ADMIN_IPS.includes(ip)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

module.exports = {
  requireAdmin,
  requireAdminIp
};

