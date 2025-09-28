const express = require('express');
const ProjectService = require('../services/project-service');
const ProjectInstance = require('../models/project');

const router = express.Router();

// POST /projects - Create new project
router.post('/', async(req, res) => {
  try {
    const { templateId, templateVersion, config, dryRun = false } = req.body;

    if (!templateId || !config) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'templateId and config are required'
      });
    }

    const projectService = new ProjectService();

    // Convert request format to project service format
    const projectConfig = {
      template: templateId,
      version: templateVersion,
      name: config.projectName,
      path: config.projectPath,
      config: config.configValues || {},
      registry: config.registry,
      authToken: config.authToken,
      dryRun
    };

    const result = await projectService.createProject(projectConfig);

    // Convert result to API format
    const projectInstance = new ProjectInstance();
    const response = {
      id: result.projectId || projectInstance.generateId(),
      projectName: config.projectName,
      projectPath: result.projectPath,
      templateId,
      templateVersion,
      status: result.success ? 'created' : 'failed',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      files: result.files || [],
      error: result.success ? undefined : result.error
    };

    const statusCode = result.success ? 200 : 500;
    res.status(statusCode).json(response);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create project',
      message: error.message
    });
  }
});

// GET /projects/:projectId - Get project status
router.get('/:projectId', async(req, res) => {
  try {
    const { projectId } = req.params;

    const projectInstance = new ProjectInstance();
    const project = await projectInstance.getProject(projectId);

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        message: `Project "${projectId}" not found`
      });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get project',
      message: error.message
    });
  }
});

module.exports = router;
