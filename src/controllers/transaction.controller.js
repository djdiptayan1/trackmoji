// src/controllers/transaction.controller.js
const { PrismaClient } = require("@prisma/client");
const { analyzeTransaction, queryTransactions } = require("../utils/geminiClient");

const prisma = new PrismaClient();

/**
 * Process a new transaction from natural language text
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.processTransaction = async (req, res, next) => {
  console.time('processTransaction');
  console.log(`[ProcessTransaction] Started - ${new Date().toISOString()}`);
  try {
    const { text, userPhone } = req.body;
    console.log(`[ProcessTransaction] Input: text="${text}", userPhone="${userPhone}"`);

    if (!text || !userPhone) {
      console.log('[ProcessTransaction] Missing required fields');
      return res.status(400).json({
        success: false,
        error: { message: "Missing required fields: text and userPhone" }
      });
    }

    // Analyze the transaction text using Gemini
    console.time('analyzeTransaction');
    const analysis = await analyzeTransaction(text, userPhone);
    console.timeEnd('analyzeTransaction');
    console.log(`[ProcessTransaction] Analysis result:`, analysis);

    // Validate the analysis results
    if (!analysis.type || !analysis.amount) {
      console.log('[ProcessTransaction] Invalid analysis result');
      return res.status(422).json({
        success: false,
        error: { message: "Could not clearly analyze the transaction" },
        partialAnalysis: analysis
      });
    }

    // Find or create user
    console.time('findOrCreateUser');
    let user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });

    if (!user) {
      console.log(`[ProcessTransaction] Creating new user for phone: ${userPhone}`);
      user = await prisma.user.create({
        data: { phone: userPhone }
      });
    } else {
      console.log(`[ProcessTransaction] Found existing user: ${user.id}`);
    }
    console.timeEnd('findOrCreateUser');

    // Parse transaction date
    let transactionDate;
    try {
      transactionDate = new Date(analysis.date);
      if (isNaN(transactionDate.getTime())) {
        console.log(`[ProcessTransaction] Invalid date format: ${analysis.date}, using current date`);
        transactionDate = new Date(); // Fallback to current date if parsing fails
      }
    } catch (error) {
      console.log(`[ProcessTransaction] Error parsing date: ${error.message}`);
      transactionDate = new Date();
    }

    // Save the general transaction record
    console.time('saveTransaction');
    const transaction = await prisma.transaction.create({
      data: {
        amount: analysis.amount,
        type: analysis.type,
        description: analysis.description || null,
        category: analysis.category || null,
        source: analysis.source || null,
        date: transactionDate,
        userId: user.id
      }
    });
    console.log(`[ProcessTransaction] Created transaction: ${transaction.id}`);

    // Also save to the specific transaction type table (Credit or Debit)
    let specificTransaction;
    if (analysis.type.toLowerCase() === 'credit') {
      specificTransaction = await prisma.credit.create({
        data: {
          amount: analysis.amount,
          source: analysis.source || null,
          description: analysis.description || null,
          date: transactionDate,
          userId: user.id
        }
      });
      console.log(`[ProcessTransaction] Created credit record: ${specificTransaction.id}`);
    } else if (analysis.type.toLowerCase() === 'debit') {
      specificTransaction = await prisma.debit.create({
        data: {
          amount: analysis.amount,
          category: analysis.category || null,
          description: analysis.description || null,
          date: transactionDate,
          userId: user.id
        }
      });
      console.log(`[ProcessTransaction] Created debit record: ${specificTransaction.id}`);
    }
    console.timeEnd('saveTransaction');

    console.log('[ProcessTransaction] Completed successfully');
    console.timeEnd('processTransaction');
    return res.status(201).json({
      success: true,
      data: {
        transaction,
        specificTransaction,
        analysis: {
          confidence: analysis.confidence,
          category: analysis.category,
          source: analysis.source,
          date: transactionDate
        }
      }
    });
  } catch (error) {
    console.error("Error processing transaction:", error);
    console.timeEnd('processTransaction');
    next(error);
  }
};

/**
 * Get all transactions for a user
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getTransactions = async (req, res, next) => {
  console.time('getTransactions');
  console.log(`[GetTransactions] Started - ${new Date().toISOString()}`);
  try {
    const { userPhone } = req.params;
    console.log(`[GetTransactions] Getting transactions for phone: ${userPhone}`);

    if (!userPhone) {
      console.log('[GetTransactions] Missing userPhone parameter');
      return res.status(400).json({
        success: false,
        error: { message: "User phone number is required" }
      });
    }

    // Find user by phone number
    console.time('findUser');
    const user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });
    console.timeEnd('findUser');

    if (!user) {
      console.log(`[GetTransactions] User not found with phone: ${userPhone}`);
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }

    console.log(`[GetTransactions] Found user with ID: ${user.id}`);
    console.time('fetchTransactions');
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        date: 'desc'
      }
    });
    console.timeEnd('fetchTransactions');

    console.log(`[GetTransactions] Found ${transactions.length} transactions`);
    console.timeEnd('getTransactions');
    return res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error("Error getting transactions:", error);
    console.timeEnd('getTransactions');
    next(error);
  }
};

/**
 * Query transactions using natural language
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.queryTransactions = async (req, res, next) => {
  console.time('queryTransactions');
  console.log(`[QueryTransactions] Started - ${new Date().toISOString()}`);
  try {
    const { question, userPhone } = req.body;
    console.log(`[QueryTransactions] Input: question="${question}", userPhone="${userPhone}"`);

    if (!question || !userPhone) {
      console.log('[QueryTransactions] Missing required fields');
      return res.status(400).json({
        success: false,
        error: { message: "Missing required fields: question and userPhone" }
      });
    }

    // Find user by phone number
    console.time('findUserQuery');
    const user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });
    console.timeEnd('findUserQuery');

    if (!user) {
      console.log(`[QueryTransactions] User not found with phone: ${userPhone}`);
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }
    console.log(`[QueryTransactions] Found user with ID: ${user.id}`);

    // Get user transactions
    console.time('fetchTransactionsQuery');
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        date: 'desc'
      }
    });
    console.timeEnd('fetchTransactionsQuery');
    console.log(`[QueryTransactions] Found ${transactions.length} transactions for user: ${user.id}`);

    if (transactions.length === 0) {
      console.log('[QueryTransactions] No transactions found for user, returning early.');
      console.timeEnd('queryTransactions');
      return res.status(200).json({
        success: true,
        data: {
          answer: "You don't have any transactions yet."
        }
      });
    }

    // Use Gemini to analyze the transaction history and answer the question
    console.time('geminiQueryTransactions');
    const analysis = await queryTransactions(question, transactions, userPhone);
    console.timeEnd('geminiQueryTransactions');
    console.log('[QueryTransactions] Gemini analysis result:', analysis);

    console.log('[QueryTransactions] Completed successfully');
    console.timeEnd('queryTransactions');
    return res.status(200).json({
      success: true,
      data: {
        answer: analysis.answer,
        insights: analysis.insights,
        suggestedCategories: analysis.suggestedCategories,
        relevantTransactions: analysis.relevantTransactions || [],
        totalAmount: analysis.totalAmount || 0,
        transactionCount: transactions.length
      }
    });
  } catch (error) {
    console.error("Error querying transactions:", error);
    console.timeEnd('queryTransactions');
    next(error);
  }
};

/**
 * Get transaction summary for a user
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getTransactionSummary = async (req, res, next) => {
  console.time('getTransactionSummary');
  console.log(`[GetTransactionSummary] Started - ${new Date().toISOString()}`);
  try {
    const { userPhone } = req.params;
    console.log(`[GetTransactionSummary] Getting summary for phone: ${userPhone}`);

    if (!userPhone) {
      console.log('[GetTransactionSummary] Missing userPhone parameter');
      return res.status(400).json({
        success: false,
        error: { message: "User phone number is required" }
      });
    }

    // Find user by phone number
    console.time('findUserSummary');
    const user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });
    console.timeEnd('findUserSummary');

    if (!user) {
      console.log(`[GetTransactionSummary] User not found with phone: ${userPhone}`);
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }
    console.log(`[GetTransactionSummary] Found user with ID: ${user.id}`);

    // Get transactions from both specific tables for better data organization
    console.time('fetchDebitsSummary');
    const debits = await prisma.debit.findMany({
      where: { userId: user.id }
    });
    console.timeEnd('fetchDebitsSummary');
    console.log(`[GetTransactionSummary] Found ${debits.length} debit records`);

    console.time('fetchCreditsSummary');
    const credits = await prisma.credit.findMany({
      where: { userId: user.id }
    });
    console.timeEnd('fetchCreditsSummary');
    console.log(`[GetTransactionSummary] Found ${credits.length} credit records`);

    // Calculate totals
    console.time('calculateTotalsSummary');
    const totalDebit = debits.reduce((acc, debit) => acc + debit.amount, 0);
    const totalCredit = credits.reduce((acc, credit) => acc + credit.amount, 0);
    const balance = totalCredit - totalDebit;
    console.timeEnd('calculateTotalsSummary');
    console.log(`[GetTransactionSummary] Totals: Debit=${totalDebit}, Credit=${totalCredit}, Balance=${balance}`);

    // Get category breakdown for debits
    console.time('categoryBreakdownSummary');
    const categoryBreakdown = debits.reduce((acc, debit) => {
      const category = debit.category || 'uncategorized';
      acc[category] = (acc[category] || 0) + debit.amount;
      return acc;
    }, {});
    console.timeEnd('categoryBreakdownSummary');
    console.log('[GetTransactionSummary] Category breakdown:', categoryBreakdown);

    // Get source breakdown for credits
    console.time('sourceBreakdownSummary');
    const sourceBreakdown = credits.reduce((acc, credit) => {
      const source = credit.source || 'unknown';
      acc[source] = (acc[source] || 0) + credit.amount;
      return acc;
    }, {});
    console.timeEnd('sourceBreakdownSummary');
    console.log('[GetTransactionSummary] Source breakdown:', sourceBreakdown);

    console.log('[GetTransactionSummary] Completed successfully');
    console.timeEnd('getTransactionSummary');
    return res.status(200).json({
      success: true,
      data: {
        totalDebit,
        totalCredit,
        balance,
        debitCount: debits.length,
        creditCount: credits.length,
        categoryBreakdown,
        sourceBreakdown
      }
    });
  } catch (error) {
    console.error("Error getting transaction summary:", error);
    console.timeEnd('getTransactionSummary');
    next(error);
  }
};

/**
 * Get user's credit transactions
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getUserCredits = async (req, res, next) => {
  console.time('getUserCredits');
  console.log(`[GetUserCredits] Started - ${new Date().toISOString()}`);
  try {
    const { userPhone } = req.params;
    console.log(`[GetUserCredits] Getting credits for phone: ${userPhone}`);

    if (!userPhone) {
      console.log('[GetUserCredits] Missing userPhone parameter');
      return res.status(400).json({
        success: false,
        error: { message: "User phone number is required" }
      });
    }

    // Find user by phone number
    console.time('findUserCredits');
    const user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });
    console.timeEnd('findUserCredits');

    if (!user) {
      console.log(`[GetUserCredits] User not found with phone: ${userPhone}`);
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }
    console.log(`[GetUserCredits] Found user with ID: ${user.id}`);

    console.time('fetchUserCredits');
    const credits = await prisma.credit.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        date: 'desc'
      }
    });
    console.timeEnd('fetchUserCredits');
    console.log(`[GetUserCredits] Found ${credits.length} credit records`);

    console.log('[GetUserCredits] Completed successfully');
    console.timeEnd('getUserCredits');
    return res.status(200).json({
      success: true,
      data: credits
    });
  } catch (error) {
    console.error("Error getting credits:", error);
    console.timeEnd('getUserCredits');
    next(error);
  }
};

/**
 * Get user's debit transactions
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getUserDebits = async (req, res, next) => {
  console.time('getUserDebits');
  console.log(`[GetUserDebits] Started - ${new Date().toISOString()}`);
  try {
    const { userPhone } = req.params;
    console.log(`[GetUserDebits] Getting debits for phone: ${userPhone}`);

    if (!userPhone) {
      console.log('[GetUserDebits] Missing userPhone parameter');
      return res.status(400).json({
        success: false,
        error: { message: "User phone number is required" }
      });
    }

    // Find user by phone number
    console.time('findUserDebits');
    const user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });
    console.timeEnd('findUserDebits');

    if (!user) {
      console.log(`[GetUserDebits] User not found with phone: ${userPhone}`);
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }
    console.log(`[GetUserDebits] Found user with ID: ${user.id}`);

    console.time('fetchUserDebits');
    const debits = await prisma.debit.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        date: 'desc'
      }
    });
    console.timeEnd('fetchUserDebits');
    console.log(`[GetUserDebits] Found ${debits.length} debit records`);

    console.log('[GetUserDebits] Completed successfully');
    console.timeEnd('getUserDebits');
    return res.status(200).json({
      success: true,
      data: debits
    });
  } catch (error) {
    console.error("Error getting debits:", error);
    console.timeEnd('getUserDebits');
    next(error);
  }
};

/**
 * Get transactions by category
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getTransactionsByCategory = async (req, res, next) => {
  console.time('getTransactionsByCategory');
  console.log(`[GetTransactionsByCategory] Started - ${new Date().toISOString()}`);
  try {
    const { userPhone, category } = req.params;
    console.log(`[GetTransactionsByCategory] Input: userPhone="${userPhone}", category="${category}"`);

    if (!userPhone || !category) {
      console.log('[GetTransactionsByCategory] Missing required fields');
      return res.status(400).json({
        success: false,
        error: { message: "User phone number and category are required" }
      });
    }

    // Find user by phone number
    console.time('findUserByCategory');
    const user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });
    console.timeEnd('findUserByCategory');

    if (!user) {
      console.log(`[GetTransactionsByCategory] User not found with phone: ${userPhone}`);
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }
    console.log(`[GetTransactionsByCategory] Found user with ID: ${user.id}`);

    // Get transactions with the specified category
    console.time('fetchTransactionsByCategory');
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        category: {
          contains: category,
          mode: 'insensitive' // Case-insensitive search
        }
      },
      orderBy: {
        date: 'desc'
      }
    });
    console.timeEnd('fetchTransactionsByCategory');
    console.log(`[GetTransactionsByCategory] Found ${transactions.length} general transactions for category: ${category}`);

    // If it's a debit category, also get specific debit records
    console.time('fetchDebitsByCategory');
    const debits = await prisma.debit.findMany({
      where: {
        userId: user.id,
        category: {
          contains: category,
          mode: 'insensitive'
        }
      },
      orderBy: {
        date: 'desc'
      }
    });
    console.timeEnd('fetchDebitsByCategory');
    console.log(`[GetTransactionsByCategory] Found ${debits.length} debit records for category: ${category}`);

    // Calculate total spent in this category
    console.time('calculateTotalByCategory');
    const totalAmount = debits.reduce((sum, transaction) => sum + transaction.amount, 0);
    console.timeEnd('calculateTotalByCategory');
    console.log(`[GetTransactionsByCategory] Total amount for category ${category}: ${totalAmount}`);

    console.log('[GetTransactionsByCategory] Completed successfully');
    console.timeEnd('getTransactionsByCategory');
    return res.status(200).json({
      success: true,
      data: {
        transactions,
        debits,
        category,
        totalAmount,
        count: transactions.length
      }
    });
  } catch (error) {
    console.error("Error getting transactions by category:", error);
    console.timeEnd('getTransactionsByCategory');
    next(error);
  }
};