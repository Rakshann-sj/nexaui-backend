const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { submitContact, getMessages } = require('../controllers/contactController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Strict rate limit for contact form — 5 per hour per IP
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many messages submitted. Please try again in an hour.',
  },
});

// POST /api/contact — public
router.post(
  '/',
  contactLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('subject').optional().trim(),
    body('message')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Message must be at least 10 characters'),
  ],
  validate,
  submitContact
);

// GET /api/contact — protected (admin view)
router.get('/', protect, getMessages);

module.exports = router;
