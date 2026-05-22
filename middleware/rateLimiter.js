const rateLimit = require('express-rate-limit');
const RequestLog = require('../models/RequestLog');

/**
 * General API limiter — 100 requests per 15 minutes
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again in 15 minutes.',
  },
});

/**
 * Auth routes limiter — 10 requests per 15 minutes
 * Protects against brute-force login attempts
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
  },
});

/**
 * API Proxy limiter — plan-based
 * Free (Starter): 5 requests/minute
 * Pro & Enterprise: unlimited
 */
const proxyLimiter = async (req, res, next) => {
  try {
    if (!req.user) return next();

    // Pro and Enterprise users have no proxy rate limit
    if (req.user.plan !== 'starter') {
      return next();
    }

    // Count requests in the last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const requestCount = await RequestLog.countDocuments({
      user: req.user._id,
      createdAt: { $gte: oneMinuteAgo },
    });

    if (requestCount >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Starter plan allows 5 API requests per minute.',
        hint: 'Upgrade to Pro for unlimited API requests.',
        retryAfter: 60,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { generalLimiter, authLimiter, proxyLimiter };
