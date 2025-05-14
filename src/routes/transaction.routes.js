// src/routes/transaction.routes.js
const express = require('express');
const transactionController = require('../controllers/transaction.controller');

const router = express.Router();

// Process a natural language transaction
router.post('/', transactionController.processTransaction);

// Query transactions using natural language
router.post('/query', transactionController.queryTransactions);

// Get all transactions for a user
router.get('/:userPhone', transactionController.getTransactions);

// Get transaction summary for a user
router.get('/:userPhone/summary', transactionController.getTransactionSummary);

// Get user's credit transactions
router.get('/:userPhone/credits', transactionController.getUserCredits);

// Get user's debit transactions
router.get('/:userPhone/debits', transactionController.getUserDebits);

// Get transactions by category
router.get('/:userPhone/category/:category', transactionController.getTransactionsByCategory);

module.exports = router;