const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { proxyRequest, getHistory } = require('../controllers/apiProxyController');
const { protect } = require('../middleware/auth');
const { proxyLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

// All proxy routes require authentication
router.use(protect);

// POST /api/proxy
// Forward an API request to any external URL
router.post(
  '/',
  [
    body('url').notEmpty().withMessage('URL is required'),
    body('method')
      .isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
      .withMessage('Invalid HTTP method'),
  ],
  validate,
  proxyLimiter,
  proxyRequest
);

// GET /api/proxy/history
// Fetch past request logs for the current user
router.get('/history', getHistory);

module.exports = router;
