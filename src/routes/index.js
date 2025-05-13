const express = require('express');
const healthRoute = require('./health.routes');

const router = express.Router();

const apiPrefix = '/api';

router.use(`${apiPrefix}/health`, healthRoute);

module.exports = router;