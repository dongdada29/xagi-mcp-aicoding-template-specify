const express = require('express');
const TemplateManager = require('../core/template-manager');
const ConfigValidator = require('../core/config-validator');

const router = express.Router();

// GET /templates - List available templates
router.get('/', async(req, res) => {
  try {
    const { registry, type, search } = req.query;

    const templateManager = new TemplateManager();
    const templates = await templateManager.listTemplates({
      registry,
      type,
      search
    });

    res.json({
      templates,
      totalCount: templates.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list templates',
      message: error.message
    });
  }
});

// GET /templates/:templateId - Get template details
router.get('/:templateId', async(req, res) => {
  try {
    const { templateId } = req.params;
    const { version } = req.query;

    const templateManager = new TemplateManager();
    const template = await templateManager.getTemplate(templateId, { version });

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
        message: `Template "${templateId}" not found`
      });
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get template',
      message: error.message
    });
  }
});

// POST /templates/:templateId - Validate template configuration
router.post('/:templateId', async(req, res) => {
  try {
    const { templateId } = req.params;
    const configData = req.body;

    const configValidator = new ConfigValidator();
    const result = await configValidator.validateTemplateConfig(templateId, configData);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to validate template configuration',
      message: error.message
    });
  }
});

module.exports = router;
