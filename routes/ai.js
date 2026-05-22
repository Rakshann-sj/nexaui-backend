const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { describeResponse, generateBody, detectError } = require('../controllers/aiController');
const { protect, requirePlan } = require('../middleware/auth');
const validate = require('../middleware/validate');

// AI features: 10 requests per minute per user
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'AI request limit reached. You can make 10 AI requests per minute.',
  },
});

// All AI routes require auth + Pro or Enterprise plan
router.use(protect);
router.use(requirePlan('pro', 'enterprise'));
router.use(aiLimiter);

// POST /api/ai/describe
router.post(
  '/describe',
  [body('responseBody').notEmpty().withMessage('Response body is required')],
  validate,
  describeResponse
);

// POST /api/ai/generate-body
router.post(
  '/generate-body',
  [body('description').trim().notEmpty().withMessage('Description is required')],
  validate,
  generateBody
);

// POST /api/ai/detect-error
router.post(
  '/detect-error',
  [body('response').notEmpty().withMessage('Response data is required')],
  validate,
  detectError
);

module.exports = router;
