const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware: Protect routes — verifies JWT access token
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -refreshToken');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'This account has been deactivated.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: err.name === 'TokenExpiredError'
        ? 'Token has expired. Please log in again.'
        : 'Invalid token. Please log in again.',
    });
  }
};

/**
 * Middleware: Require specific plan(s)
 * Usage: requirePlan('pro', 'enterprise')
 */
const requirePlan = (...plans) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!plans.includes(req.user.plan)) {
      return res.status(403).json({
        success: false,
        message: `This feature requires a ${plans.join(' or ')} plan. Please upgrade your subscription.`,
        currentPlan: req.user.plan,
        requiredPlans: plans,
      });
    }

    next();
  };
};

module.exports = { protect, requirePlan };
