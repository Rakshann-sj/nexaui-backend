const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
} = require('../controllers/projectController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

// All project routes require authentication
router.use(protect);

// GET  /api/projects
// POST /api/projects
router
  .route('/')
  .get(getProjects)
  .post(
    [
      body('name').trim().notEmpty().withMessage('Project name is required'),
      body('description').optional().trim(),
    ],
    validate,
    createProject
  );

// GET    /api/projects/:id
// PUT    /api/projects/:id
// DELETE /api/projects/:id
router
  .route('/:id')
  .get(getProject)
  .put(
    [
      body('name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Project name cannot be empty'),
      body('description').optional().trim(),
    ],
    validate,
    updateProject
  )
  .delete(deleteProject);

module.exports = router;
