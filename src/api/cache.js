const express = require('express');
const CacheManager = require('../core/cache-manager');

const router = express.Router();

// POST /cache - Clear template cache
router.post('/', async(req, res) => {
  try {
    const { templateId, version } = req.body;
    const cacheManager = new CacheManager();

    let result;
    if (templateId) {
      // Clear specific template from cache
      result = await cacheManager.clearCacheEntry(templateId, version);
    } else {
      // Clear all cache
      result = await cacheManager.clearAllCache();
    }

    res.json({
      clearedEntries: result.clearedCount || 0,
      freedSpace: result.freedSpace || 0
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

// GET /cache - Get cache information
router.get('/', async(req, res) => {
  try {
    const cacheManager = new CacheManager();
    const cacheStats = await cacheManager.getCacheStats();
    const cacheEntries = await cacheManager.listCacheEntries();

    res.json({
      stats: cacheStats,
      entries: cacheEntries
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get cache information',
      message: error.message
    });
  }
});

// DELETE /cache/:id - Delete specific cache entry
router.delete('/:id', async(req, res) => {
  try {
    const { id } = req.params;
    const cacheManager = new CacheManager();

    const result = await cacheManager.clearCacheEntry(id);

    if (result.clearedCount === 0) {
      return res.status(404).json({
        error: 'Cache entry not found',
        message: `Cache entry "${id}" not found`
      });
    }

    res.json({
      clearedEntries: result.clearedCount,
      freedSpace: result.freedSpace
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete cache entry',
      message: error.message
    });
  }
});

module.exports = router;
