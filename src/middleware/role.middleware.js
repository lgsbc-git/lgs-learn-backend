/**
 * Restricts access by user role
 * Usage: roleMiddleware("admin", "manager")
 */
const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Insufficient permissions",
      });
    }

    next();
  };
};

module.exports = roleMiddleware;
