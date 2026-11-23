function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Autentikasi diperlukan' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Akses ditolak untuk peran "${req.user.role}"` });
    }
    next();
  };
}

module.exports = { requireRole };