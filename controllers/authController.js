const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../config/mailer');

// ── Token Helpers ─────────────────────────────────────────────────────
const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });

const generateRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

// ─────────────────────────────────────────────────────────────────────
// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    const user = await User.create({ name, email, password });

    // Send welcome email (non-blocking)
    sendEmail({
      to: email,
      subject: 'Welcome to NexaUI 🚀',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
          <h2 style="color:#6c63ff;">Welcome to NexaUI, ${name}!</h2>
          <p>Your account is ready. You're on the <strong>Starter Plan</strong>.</p>
          <p>Start testing APIs, building projects, and exploring features today.</p>
          <a href="${process.env.CLIENT_URL}/dashboard"
             style="display:inline-block;margin-top:16px;padding:12px 28px;background:#6c63ff;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
            Go to Dashboard
          </a>
          <p style="margin-top:24px;color:#888;font-size:12px;">If you didn't create this account, please ignore this email.</p>
        </div>
      `,
    }).catch((err) => console.error('Welcome email error:', err.message));

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, plan: user.plan },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +refreshToken');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'This account has been deactivated' });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, plan: user.plan },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Logout user (invalidate refresh token)
// @route   POST /api/auth/logout
// @access  Public
// ─────────────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const user = await User.findOne({ refreshToken }).select('+refreshToken');
      if (user) {
        user.refreshToken = null;
        await user.save({ validateBeforeSave: false });
      }
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
// ─────────────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token mismatch. Please log in again.' });
    }

    const newAccessToken = generateAccessToken(user._id);
    res.json({ success: true, accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Send password reset email
// @route   POST /api/auth/forgot-password
// @access  Public
// ─────────────────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    // Always respond the same to prevent email enumeration
    const genericMsg = 'If that email is registered, a reset link has been sent.';

    if (!user) {
      return res.json({ success: true, message: genericMsg });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'NexaUI — Password Reset Request',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
            <h2 style="color:#6c63ff;">Reset Your Password</h2>
            <p>You requested a password reset. This link expires in <strong>30 minutes</strong>.</p>
            <a href="${resetUrl}"
               style="display:inline-block;margin-top:16px;padding:12px 28px;background:#6c63ff;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
              Reset Password
            </a>
            <p style="margin-top:24px;color:#888;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (emailErr) {
      // Roll back token on email failure
      user.resetPasswordToken = undefined;
      user.resetPasswordExpiry = undefined;
      await user.save({ validateBeforeSave: false });
      return next(new Error('Failed to send reset email. Please try again.'));
    }

    res.json({ success: true, message: genericMsg });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Reset password using token
// @route   POST /api/auth/reset-password/:token
// @access  Public
// ─────────────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpiry');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired',
      });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    user.refreshToken = null; // Invalidate all existing sessions
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });
  } catch (err) {
    next(err);
  }
};
