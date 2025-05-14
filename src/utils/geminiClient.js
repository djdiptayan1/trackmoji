const { GoogleGenAI, Type } = require("@google/genai");
require("dotenv").config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_NAME = process.env.GEMINI_MODEL

/**
 * Analyze transaction text to determine its type (debit/credit), amount, category, etc.
 * @param {string} text - Natural language description of the transaction
 * @param {string} userPhone - User's phone number
 * @returns {Promise<Object>} Transaction analysis
 */
async function analyzeTransaction(text, userPhone) {
    try {
        const result = await ai.models.generateContent({
            model: MODEL_NAME,
            // Use a much more detailed prompt to accurately distinguish between credit and debit
            contents: `Analyze this financial transaction: "${text}"

IMPORTANT INSTRUCTION: Pay very close attention to the direction of money flow.

- If someone gave/paid/sent money TO the user, or user received/got/earned money, it's a CREDIT transaction
- If the user spent/paid/gave money, or money went OUT from the user, it's a DEBIT transaction

Examples:
- "received 500 from mom" = CREDIT (money came TO the user)
- "srijit gave rs 1000" = CREDIT (money came TO the user)
- "ram gave 50 rupees" = CREDIT (money came TO the user)
- "spent 25 on coffee" = DEBIT (money went OUT from the user)
- "paid 1000 to landlord" = DEBIT (money went OUT from the user)
- "bought groceries for 500" = DEBIT (money went OUT from the user)

Analyze the transaction carefully and determine the correct type.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        type: {
                            type: Type.STRING,
                            description: "Transaction type: 'debit' or 'credit' (debit means money spent, credit means money received)"
                        },
                        amount: {
                            type: Type.NUMBER,
                            description: "The numerical amount of money involved in the transaction"
                        },
                        description: {
                            type: Type.STRING,
                            description: "A clean description of what the transaction is about"
                        },
                        category: {
                            type: Type.STRING,
                            description: "A category for the transaction (e.g., food, transportation, salary, gift, etc.)"
                        },
                        source: {
                            type: Type.STRING,
                            description: "The source of funds in case of credit, or the recipient in case of debit"
                        },
                        date: {
                            type: Type.STRING,
                            description: "The transaction date in ISO format, inferred if mentioned, otherwise today's date"
                        },
                        confidence: {
                            type: Type.NUMBER,
                            description: "A number between 0 and 1 indicating confidence in this analysis"
                        }
                    },
                    required: ["type", "amount", "description", "category", "source", "date", "confidence"]
                }
            }
        });

        // Access 'text' directly on the result object and parse it
        // Ensure result and result.text are not undefined before parsing
        if (!result || typeof result.text !== 'string') {
            throw new Error("Failed to get a valid text response from the AI model.");
        }
        const jsonResponse = JSON.parse(result.text);

        if (!jsonResponse.date) {
            jsonResponse.date = new Date().toISOString();
        }

        return jsonResponse;
    } catch (error) {
        console.error("Error analyzing transaction:", error);
        return {
            type: "unknown",
            amount: 0,
            description: text,
            category: "unknown",
            source: "unknown",
            date: new Date().toISOString(),
            confidence: 0,
            error: error.message
        };
    }
}

/**
 * Query transaction data using natural language
 * @param {string} question - Natural language question about transactions
 * @param {Array} transactions - List of transaction objects
 * @param {string} userPhone - User's phone number
 * @returns {Promise<Object>} Analysis and answer to the question
 */
async function queryTransactions(question, transactions, userPhone) {
    try {
        const transactionData = JSON.stringify(transactions);

        const result = await ai.models.generateContent({
            model: MODEL_NAME,
            // Use a detailed string for contents with clear instructions
            contents: `
                You are a financial assistant analyzing transaction data.
                
                Question: "${question}"
                
                User's transaction data:
                ${transactionData}
                
                IMPORTANT: Remember that CREDIT transactions mean money coming IN to the user (received money),
                and DEBIT transactions mean money going OUT from the user (spent money).
                
                Based on this transaction data, please answer the question in a structured format.
                Be precise with numbers and calculations. If asked about spending in a specific category,
                time period, or other specific aspect, focus on that.
                
                When calculating balances or totals:
                - Add up all CREDIT transactions (money received)
                - Subtract all DEBIT transactions (money spent)
                - The result is the user's current balance
            `,
            // Use 'config' directly
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        answer: {
                            type: Type.STRING,
                            description: "Detailed answer to the user's question about their financial data"
                        },
                        insights: {
                            type: Type.ARRAY,
                            description: "Financial insights extracted from the data relevant to the question",
                            items: { type: Type.STRING }
                        },
                        suggestedCategories: {
                            type: Type.ARRAY,
                            description: "List of spending categories found in the data",
                            items: { type: Type.STRING }
                        },
                        relevantTransactions: {
                            type: Type.ARRAY,
                            description: "List of transactions that are most relevant to the query",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    amount: { type: Type.NUMBER },
                                    description: { type: Type.STRING },
                                    date: { type: Type.STRING }
                                }
                            }
                        },
                        totalAmount: {
                            type: Type.NUMBER,
                            description: "Total amount related to the query, if applicable"
                        }
                    },
                    required: ["answer"]
                }
            }
        });

        // Access 'text' directly on the result object and parse it
        // Ensure result and result.text are not undefined before parsing
        if (!result || typeof result.text !== 'string') {
            throw new Error("Failed to get a valid text response from the AI model for query.");
        }
        const jsonResponse = JSON.parse(result.text);

        return {
            answer: jsonResponse.answer || "I couldn't analyze your transactions properly.",
            insights: jsonResponse.insights || [],
            suggestedCategories: jsonResponse.suggestedCategories || [],
            relevantTransactions: jsonResponse.relevantTransactions || [],
            totalAmount: jsonResponse.totalAmount || 0
        };
    } catch (error) {
        console.error("Error querying transactions:", error);
        return {
            answer: "Sorry, I encountered an error while analyzing your transactions.",
            error: error.message
        };
    }
}

module.exports = {
    analyzeTransaction,
    queryTransactions
};