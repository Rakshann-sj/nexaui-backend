const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getMe, updateMe, updatePassword, deleteMe } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

// All user routes require authentication
router.use(protect);

// GET  /api/users/me
router.get('/me', getMe);

// PUT  /api/users/me
router.put(
  '/me',
  [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
  ],
  validate,
  updateMe
);

// PUT  /api/users/me/password
router.put(
  '/me/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ],
  validate,
  updatePassword
);

// DELETE /api/users/me
router.delete('/me', deleteMe);

module.exports = router;
