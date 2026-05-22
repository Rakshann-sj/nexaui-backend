const mongoose = require('mongoose');

const requestLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    requestHeaders: {
      type: Object,
      default: {},
    },
    requestBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    responseTime: {
      type: Number, // milliseconds
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────
requestLogSchema.index({ user: 1, createdAt: -1 });
requestLogSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model('RequestLog', requestLogSchema);
