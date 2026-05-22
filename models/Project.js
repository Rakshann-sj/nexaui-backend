const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [100, 'Project name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtual: count of associated request logs ─────────────────────────
projectSchema.virtual('requestCount', {
  ref: 'RequestLog',
  localField: '_id',
  foreignField: 'project',
  count: true,
});

// ── Index for faster owner lookups ────────────────────────────────────
projectSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema);
