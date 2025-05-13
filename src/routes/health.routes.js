const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

/**
 * @route GET /api/health
 * @description Get health status of the application and system
 * @access Public
 */
router.get('/', healthController.healthCheck);

module.exports = router;