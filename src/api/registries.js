const express = require('express');
const TemplateRegistry = require('../models/registry');
const TemplateManager = require('../core/template-manager');

const router = express.Router();

// GET /registries - List configured registries
router.get('/', async(req, res) => {
  try {
    const templateRegistry = new TemplateRegistry();
    const registries = await templateRegistry.listRegistries();

    res.json({
      registries,
      totalCount: registries.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list registries',
      message: error.message
    });
  }
});

// POST /registries/sync - Sync with registries
router.post('/sync', async(req, res) => {
  try {
    const { registry, force = false } = req.body;

    const templateRegistry = new TemplateRegistry();
    const result = await templateRegistry.syncRegistry(registry, { force });

    res.json({
      success: result.success,
      message: result.message,
      syncedTemplates: result.syncedTemplates || 0,
      errors: result.errors || []
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to sync registries',
      message: error.message
    });
  }
});

module.exports = router;
