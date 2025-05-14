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
  try {
    const { text, userPhone } = req.body;

    if (!text || !userPhone) {
      return res.status(400).json({
        success: false,
        error: { message: "Missing required fields: text and userPhone" }
      });
    }

    // Analyze the transaction text using Gemini
    const analysis = await analyzeTransaction(text, userPhone);

    // Validate the analysis results
    if (!analysis.type || !analysis.amount) {
      return res.status(422).json({
        success: false,
        error: { message: "Could not clearly analyze the transaction" },
        partialAnalysis: analysis
      });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { phone: userPhone }
      });
    }

    // Parse transaction date
    let transactionDate;
    try {
      transactionDate = new Date(analysis.date);
      if (isNaN(transactionDate.getTime())) {
        transactionDate = new Date(); // Fallback to current date if parsing fails
      }
    } catch (error) {
      transactionDate = new Date();
    }

    // Save the general transaction record
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
    }

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
  try {
    const { userPhone } = req.params;

    if (!userPhone) {
      return res.status(400).json({
        success: false,
        error: { message: "User phone number is required" }
      });
    }

    // Find user by phone number
    const user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        date: 'desc'
      }
    });

    return res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error("Error getting transactions:", error);
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
  try {
    const { question, userPhone } = req.body;

    if (!question || !userPhone) {
      return res.status(400).json({
        success: false,
        error: { message: "Missing required fields: question and userPhone" }
      });
    }

    // Find user by phone number
    const user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }

    // Get user transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        date: 'desc'
      }
    });

    if (transactions.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          answer: "You don't have any transactions yet."
        }
      });
    }

    // Use Gemini to analyze the transaction history and answer the question
    const analysis = await queryTransactions(question, transactions, userPhone);

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
  try {
    const { userPhone } = req.params;

    if (!userPhone) {
      return res.status(400).json({
        success: false,
        error: { message: "User phone number is required" }
      });
    }

    // Find user by phone number
    const user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }

    // Get transactions from both specific tables for better data organization
    const debits = await prisma.debit.findMany({
      where: { userId: user.id }
    });

    const credits = await prisma.credit.findMany({
      where: { userId: user.id }
    });

    // Calculate totals
    const totalDebit = debits.reduce((acc, debit) => acc + debit.amount, 0);
    const totalCredit = credits.reduce((acc, credit) => acc + credit.amount, 0);
    const balance = totalCredit - totalDebit;

    // Get category breakdown for debits
    const categoryBreakdown = debits.reduce((acc, debit) => {
      const category = debit.category || 'uncategorized';
      acc[category] = (acc[category] || 0) + debit.amount;
      return acc;
    }, {});

    // Get source breakdown for credits
    const sourceBreakdown = credits.reduce((acc, credit) => {
      const source = credit.source || 'unknown';
      acc[source] = (acc[source] || 0) + credit.amount;
      return acc;
    }, {});

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
  try {
    const { userPhone } = req.params;

    if (!userPhone) {
      return res.status(400).json({
        success: false,
        error: { message: "User phone number is required" }
      });
    }

    // Find user by phone number
    const user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }

    const credits = await prisma.credit.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        date: 'desc'
      }
    });

    return res.status(200).json({
      success: true,
      data: credits
    });
  } catch (error) {
    console.error("Error getting credits:", error);
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
  try {
    const { userPhone } = req.params;

    if (!userPhone) {
      return res.status(400).json({
        success: false,
        error: { message: "User phone number is required" }
      });
    }

    // Find user by phone number
    const user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }

    const debits = await prisma.debit.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        date: 'desc'
      }
    });

    return res.status(200).json({
      success: true,
      data: debits
    });
  } catch (error) {
    console.error("Error getting debits:", error);
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
  try {
    const { userPhone, category } = req.params;

    if (!userPhone || !category) {
      return res.status(400).json({
        success: false,
        error: { message: "User phone number and category are required" }
      });
    }

    // Find user by phone number
    const user = await prisma.user.findUnique({
      where: { phone: userPhone }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found" }
      });
    }

    // Get transactions with the specified category
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

    // If it's a debit category, also get specific debit records
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

    // Calculate total spent in this category
    const totalAmount = debits.reduce((sum, transaction) => sum + transaction.amount, 0);

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
    next(error);
  }
};
