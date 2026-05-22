const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const sendEmail = require('../config/mailer');

const PLAN_PRICES = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID,
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Create Stripe checkout session
// @route   POST /api/payments/create-checkout
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.createCheckoutSession = async (req, res, next) => {
  try {
    const { plan } = req.body;

    if (!['pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan. Choose pro or enterprise.' });
    }

    if (!PLAN_PRICES[plan]) {
      return res.status(500).json({ success: false, message: `Stripe price ID for ${plan} is not configured.` });
    }

    // Get or create Stripe customer
    let subscription = await Subscription.findOne({ user: req.user._id });
    let customerId;

    if (subscription?.stripeCustomerId) {
      customerId = subscription.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { userId: req.user._id.toString() },
      });
      customerId = customer.id;

      subscription = await Subscription.create({
        user: req.user._id,
        stripeCustomerId: customerId,
        plan: 'starter',
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: PLAN_PRICES[plan], quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/dashboard?payment=success&plan=${plan}`,
      cancel_url: `${process.env.CLIENT_URL}/pricing?payment=cancelled`,
      metadata: { userId: req.user._id.toString(), plan },
      subscription_data: {
        trial_period_days: plan === 'pro' ? 14 : 0,
        metadata: { userId: req.user._id.toString(), plan },
      },
    });

    res.json({ success: true, url: session.url, sessionId: session.id });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Handle Stripe webhook events
// @route   POST /api/payments/webhook
// @access  Public (Stripe-signed)
// ─────────────────────────────────────────────────────────────────────
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      // ── Checkout completed → activate plan ──────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { userId, plan } = session.metadata;

        await Promise.all([
          User.findByIdAndUpdate(userId, { plan }),
          Subscription.findOneAndUpdate(
            { user: userId },
            {
              stripeSubscriptionId: session.subscription,
              plan,
              status: 'active',
            }
          ),
        ]);

        // Notify user of successful upgrade
        const user = await User.findById(userId);
        if (user) {
          sendEmail({
            to: user.email,
            subject: `🎉 You're now on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan!`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
                <h2 style="color:#6c63ff;">Plan Upgraded Successfully!</h2>
                <p>Hi ${user.name}, you now have full access to all <strong>${plan}</strong> features.</p>
                <a href="${process.env.CLIENT_URL}/dashboard"
                   style="display:inline-block;margin-top:16px;padding:12px 28px;background:#6c63ff;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
                  Go to Dashboard
                </a>
              </div>
            `,
          }).catch(console.error);
        }
        break;
      }

      // ── Subscription updated ─────────────────────────────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const dbSub = await Subscription.findOne({ stripeSubscriptionId: sub.id });
        if (dbSub) {
          dbSub.status = sub.status;
          dbSub.currentPeriodEnd = new Date(sub.current_period_end * 1000);
          dbSub.cancelAtPeriodEnd = sub.cancel_at_period_end;
          if (sub.trial_end) dbSub.trialEnd = new Date(sub.trial_end * 1000);
          await dbSub.save();
        }
        break;
      }

      // ── Subscription cancelled → downgrade to starter ────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const dbSub = await Subscription.findOne({ stripeSubscriptionId: sub.id });
        if (dbSub) {
          dbSub.status = 'canceled';
          dbSub.plan = 'starter';
          await dbSub.save();
          await User.findByIdAndUpdate(dbSub.user, { plan: 'starter' });
        }
        break;
      }

      // ── Payment failed ───────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const dbSub = await Subscription.findOne({
          stripeCustomerId: invoice.customer,
        });
        if (dbSub) {
          dbSub.status = 'past_due';
          await dbSub.save();
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
  }

  res.json({ received: true });
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Get current subscription status
// @route   GET /api/payments/subscription
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.getSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({ user: req.user._id });
    res.json({ success: true, subscription: subscription || null });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Cancel subscription at end of billing period
// @route   POST /api/payments/cancel
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({ user: req.user._id });

    if (!subscription?.stripeSubscriptionId) {
      return res.status(404).json({ success: false, message: 'No active subscription found' });
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current billing period.',
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
  } catch (err) {
    next(err);
  }
};
