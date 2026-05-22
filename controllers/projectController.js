const Project = require('../models/Project');
const RequestLog = require('../models/RequestLog');

// ─────────────────────────────────────────────────────────────────────
// @desc    Get all projects for current user
// @route   GET /api/projects
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ owner: req.user._id })
      .sort('-createdAt')
      .populate('requestCount');

    res.json({ success: true, count: projects.length, projects });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.createProject = async (req, res, next) => {
  try {
    // Starter plan: max 3 projects
    if (req.user.plan === 'starter') {
      const count = await Project.countDocuments({ owner: req.user._id });
      if (count >= 3) {
        return res.status(403).json({
          success: false,
          message: 'Starter plan is limited to 3 projects. Upgrade to Pro for unlimited projects.',
          currentCount: count,
          limit: 3,
        });
      }
    }

    const project = await Project.create({
      name: req.body.name,
      description: req.body.description || '',
      owner: req.user._id,
    });

    res.status(201).json({ success: true, project });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Get single project with its request history
// @route   GET /api/projects/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.getProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const requestHistory = await RequestLog.find({ project: project._id })
      .sort('-createdAt')
      .limit(50)
      .select('method url statusCode responseTime error createdAt');

    res.json({ success: true, project, requestHistory });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Update project name / description
// @route   PUT /api/projects/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.updateProject = async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      updates,
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, message: 'Project updated successfully', project });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Delete project and all its request logs
// @route   DELETE /api/projects/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Clean up all associated request logs
    await RequestLog.deleteMany({ project: project._id });

    res.json({ success: true, message: 'Project and its history deleted successfully' });
  } catch (err) {
    next(err);
  }
};
