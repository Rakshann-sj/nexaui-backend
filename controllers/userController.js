const User = require('../models/User');

// ─────────────────────────────────────────────────────────────────────
// @desc    Get current user profile
// @route   GET /api/users/me
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Update profile (name / email)
// @route   PUT /api/users/me
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.updateMe = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (email) updates.email = email;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided to update' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, message: 'Profile updated successfully', user });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Change password
// @route   PUT /api/users/me/password
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Deactivate account (soft delete)
// @route   DELETE /api/users/me
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.deleteMe = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isActive: false,
      refreshToken: null,
    });
    res.json({ success: true, message: 'Account has been deactivated successfully' });
  } catch (err) {
    next(err);
  }
};
