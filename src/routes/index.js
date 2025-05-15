const express = require('express');
const healthRoute = require('./health.routes');
const transactionRoute = require('./transaction.routes');
const usersRoute = require('./users.routes');

const router = express.Router();

const apiPrefix = '/api';

router.use(`${apiPrefix}/health`, healthRoute);
router.use(`${apiPrefix}/transactions`, transactionRoute);
router.use(`${apiPrefix}/users`, usersRoute);

module.exports = router;