const express = require('express');
const checkUserExists = require('../middleware/checkUserExists');
const transactionController = require('../controllers/transaction.controller');

const router = express.Router();

// POST: Process a natural language transaction (userPhone likely in body or headers)
router.post('/', checkUserExists, transactionController.processTransaction);

// POST: Query transactions using natural language
router.post('/query', checkUserExists, transactionController.queryTransactions);

router.get('/', checkUserExists, transactionController.getTransactions);

router.get('/summary', checkUserExists, transactionController.getTransactionSummary);

router.get('/credits', checkUserExists, transactionController.getUserCredits);

router.get('/debits', checkUserExists, transactionController.getUserDebits);

router.get('/category', checkUserExists, transactionController.getTransactionsByCategory);

module.exports = router;
