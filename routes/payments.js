const express = require('express');
const router = express.Router();
const {
  createCheckoutSession,
  handleWebhook,
  getSubscription,
  cancelSubscription,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// POST /api/payments/webhook
// Stripe sends raw body — must be registered BEFORE express.json() (done in server.js)
router.post('/webhook', handleWebhook);

// All routes below require authentication
router.use(protect);

// POST /api/payments/create-checkout
router.post('/create-checkout', createCheckoutSession);

// GET /api/payments/subscription
router.get('/subscription', getSubscription);

// POST /api/payments/cancel
router.post('/cancel', cancelSubscription);

module.exports = router;
